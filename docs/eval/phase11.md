# Phase 11 — Retrieval cache: does it win?

Raw numbers: [`phase11.json`](phase11.json). Harness: `ai-service/app/eval/semantic_cache.py`.
Decision: D-075.

## Question

Can a repeated or near-duplicate query reuse an earlier retrieval result, saving the embedding,
Chroma, BM25 and, on the reranked routes, an LLM call, without serving worse context? The bar
(roadmap): the quality cost must stay inside the ±0.024 nDCG noise band (D-029), and the win must
be real on the traffic the platform actually sends.

## Workload

- The 42 golden queries, then **two hand-written paraphrases of each** (126 queries;
  `app/eval/fixtures/paraphrases.json`), written before any similarity was measured. A
  paraphrase keeps the golden query's labels.
- **Should hit:** a query and its paraphrases (126 pairs).
- **Must not hit:** two golden queries in the same partition (same company/stage filter) with
  disjoint labelled sources, and their paraphrases (747 pairs). Pairs in different partitions
  are never compared, because the cache never compares them.

Each query is retrieved fresh once, then the workload is replayed in order through the real
`RetrievalCache` on the live Redis: a hit serves the cached query's fresh result, a miss serves its
own. Served latency is modelled from measured parts (lookup on Redis, per-query embedding, the
fresh retrieval), so the comparison costs no extra reranker calls.

## Similarity separates cleanly inside a partition

| | min | p10 | median | max |
|---|---|---|---|---|
| should hit (paraphrases) | 0.630 | 0.730 | 0.830 | — |
| must not hit (different intent) | — | — | 0.250 | **0.538** |

The closest different-intent pair: "a custom AI training chip with on-chip network interfaces"
vs "ethernet RDMA transport for large AI training" (0.538). No must-not pair clears any threshold
from 0.54 up.

| threshold | paraphrase pairs that hit | false hits |
|---|---|---|
| 0.70 | 94% | 0 |
| 0.75 | 84% | 0 |
| **0.80** | **65%** | **0** |
| 0.85 | 43% | 0 |
| 0.90 | 18% | 0 |
| 0.95 | 6% | 0 |

**0.80** is the calibrated threshold: 0.26 above the closest different-intent pair, so a margin
remains for traffic the golden set doesn't cover.

## Dense path (the agent's searches): a semantic hit can't win

| | value |
|---|---|
| fresh retrieval, p50 | 214 ms |
| of which the query embedding, p50 | **181 ms** |
| exact-tier lookup, p50 | 0.06 ms |
| a whole `retrieve()` served by the exact tier on live Redis, p50 | 0.27 ms |
| semantic lookup over the partition, p50 | 0.3 ms |
| served p50 at 0.80 (52% hit rate) | 199 ms |
| nDCG served − fresh at 0.80 | +0.0016 |

A semantic hit has to embed the query first, and the embedding is most of what it would save, so
the win is ~15 ms. The tier therefore runs only where a reranker sits behind the query.

## Reranked path (behavioural and system design): a semantic hit wins on every count

First attempt: Gemini (`gemini-3.1-flash-lite-preview`) answered in ~13 s that day, so **all 69
reranker calls hit the 5 s production timeout** and fell back to first-stage order. That run is
kept as `modes.routedTimedOut`. The re-run gave the eval process a 30 s rerank timeout: 0 degraded.

| threshold | hit rate | wrong-intent hits | nDCG served − fresh | reranked p50 served | reranker calls saved (of 69) |
|---|---|---|---|---|---|
| exact only | 0.8% | 0 | 0.000 | 13,630 ms | 1 |
| 0.70 | 65% | 0 | +0.020 | 206 ms | 46 |
| 0.75 | 61% | 0 | +0.020 | 210 ms | 44 |
| **0.80** | **52%** | **0** | **+0.018** | **247 ms** | **38** |
| 0.85 | 37% | 0 | +0.013 | 10,555 ms | 27 |
| 0.90 | 17% | 0 | +0.009 | 12,899 ms | 15 |

Quality goes slightly *up*, not down: a paraphrase is served the ranking of the better-phrased
original. Every delta is inside the noise band.

## Where the real traffic is

- **Interview questions** (`/api/interview/next-question`): the retrieval query is built from
  company, stage and difficulty alone (`previous_answer` stays off, D-066), so a stage's opening
  query is an **exact** repeat for every interview with that company and difficulty. That is at
  most 60 reranked queries (10 companies × 2 reranked stages × 3 difficulties). After the first, each
  one skips the reranker for the cache's TTL.
- **Agent searches**: free text, but dense-only, so the semantic tier doesn't apply (above).
- **The only near-duplicate reranked queries today are one interview stage at different
  difficulties**: cosine 0.94–0.98, and the same dense top-5 in 5 of 6 company/stage pairs
  checked. With the semantic tier on, every difficulty would share whichever context was cached
  first. The difficulty still reaches the question prompt, but retrieval would stop seeing it.
  That's a product change, made to save at most 40 cold reranker calls per 6 hours (~$0.008).

## Result

- **Exact tier: on.** It is the one that wins on real traffic: every repeated interview opening on
  a reranked stage skips a ~1 s (13 s that day) LLM call.
- **Semantic tier: built, calibrated at 0.80, limited to reranked routes, shipped off**
  (`RAG_CACHE_SEMANTIC_ENABLED=false`). It wins per hit (−98% latency, no quality loss), but
  today's traffic would only use it to merge difficulty levels. One env var turns it on when a
  free-text reranked path exists.

Spend: 137 model calls, ~$0.021 (cap $0.50).
