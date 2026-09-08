# Phase 3 — query-side retrieval results

42 golden queries, k=5, no metadata filter, 721 chunks. Unlike Phase 2, nothing
here requires re-indexing, so every row was cheap to try and cheap to revert.

Reference for this phase: **nDCG 0.8321 / MRR 0.8532 / hit_rate 0.9048** — the
stable post-Phase-2 measurement (see the noise note below).

## Quality

| Technique | precision_norm | hit_rate | MRR | nDCG@5 | verdict |
|---|---|---|---|---|---|
| baseline (dense only) | 0.8690 | 0.9048 | 0.8532 | 0.8321 | — |
| + hybrid (BM25 + RRF) | 0.9048 | 0.9524 | 0.8929 | 0.8702 | kept, **routed** |
| + MMR | 0.8571 | 0.9048 | 0.8452 | 0.8196 | **reverted** |
| + rerank (no timeout) | 0.9643 | 0.9762 | 0.9524 | 0.9465 | kept, **routed** |
| + hybrid + rerank | 0.9643 | 0.9762 | 0.9286 | 0.9232 | not stacked |
| + rerank (5s timeout) | 0.9286 | 0.9524 | 0.9167 | 0.9028 | — |
| **routing (shipped)** | **0.9286** | **0.9524** | **0.9167** | **0.9009** | **shipped** |

## Latency — the reason routing wins

| Config | p50 | mean | max |
|---|---|---|---|
| dense only | 210ms | 239ms | 403ms |
| + hybrid | 261ms | 261ms | 336ms |
| + MMR | 187ms | 202ms | 257ms |
| + rerank | 905ms | 2329ms | **10140ms** |
| + hybrid + rerank | 2443ms | 2173ms | 3373ms |
| rerank everywhere (5s cap) | 1762ms | 2222ms | 5293ms |
| **routed (shipped)** | **268ms** | **855ms** | **2400ms** |

Routing matches rerank-everywhere on quality (nDCG 0.9009 vs 0.9028, well inside
noise) at **6.6x lower p50 latency**.

## 1. Reranking — kept, but routed rather than global

First-stage retrieval is a bi-encoder: query and document are embedded
separately, so the score compares two vectors that never met. A reranker scores
the pair jointly, which is far more precise. It is the single biggest quality
lever in the phase: nDCG 0.8321 -> 0.9465 uncapped.

**Implemented as an LLM reranker, not a cross-encoder.** `docker-compose.prod.yml`
caps ai-service at `mem_limit: 300m`; sentence-transformers pulls torch plus a
resident model well past that ceiling. The LLM path adds no dependency and no
resident memory. The trade-off is real and recorded: a cross-encoder would be
faster per query and free at inference. `strategy="cross_encoder"` is the slot to
fill if the memory ceiling is ever raised.

**The tail was the problem.** Uncapped, p50 was 905ms but the worst case hit
**10.1 seconds**, which would stall an interview mid-question. A 5s timeout with
fallback to first-stage ordering bounds it.

The timeout costs measurable quality, and the cost is monotonic:

| timeout | nDCG |
|---|---|
| 3s | 0.8959 |
| 5s | 0.9028 |
| 8s | 0.9208 |
| none | 0.9465 |

5s shipped: 8s is only 0.018 better, which is inside the ±0.024 noise band, so
the extra 3 seconds of worst-case latency buys nothing measurable.

## 2. Hybrid search + RRF — kept, routed to term-heavy stages

Dense retrieval matches meaning and is weak on rare exact tokens, because a term
carrying nearly all the information gets averaged into a vector with everything
else. BM25 is exactly the opposite. RRF fuses them using **rank only**, which is
why it needs no score normalisation between two systems whose scores are not
comparable (cosine distance vs an unbounded BM25 score).

Clear standalone win — hit_rate 0.9048 -> 0.9524 — for +51ms.

## 3. MMR — reverted

Measured -0.013 nDCG, inside the noise band but consistently negative.

The honest reading is that **the harness cannot see what MMR is for**. MMR trades
relevance for diversity; every metric here rewards relevance only, so a technique
that deliberately demotes a relevant-but-redundant chunk can only score worse.
Properly evaluating it needs a redundancy metric (how much do the k returned
chunks overlap?) which does not exist yet. Reverted rather than shipped on faith.
The implementation stays behind `MMR_ENABLED=false`.

This is the same instrument-mismatch as small-to-big in Phase 2, and it is worth
noticing that it recurred: three of the six techniques across Phases 2 and 3
could not be judged by ranking metrics.

## 4. Query routing — shipped

The measurements above do not say "use the best technique everywhere". They say
the two survivors have different shapes: reranking is the most accurate and the
most expensive, hybrid is nearly free and specifically good at rare exact terms.

So the policy routes by interview stage:

| Stage | Strategy | Why |
|---|---|---|
| behavioral | rerank | discursive, semantic queries |
| system_design | rerank | broad conceptual queries, many adjacent candidates |
| coding | hybrid | named algorithms and techniques |
| core_cs | hybrid | precise terminology (RDMA, false sharing, CAP) |
| *(unknown)* | rerank | fall back to highest quality |

Result: equal quality to reranking everywhere, at 6.6x lower p50 latency, because
half the questions never pay for an LLM call.

## Note on stacking

`hybrid + rerank` (0.9232) scored **lower** than rerank alone (0.9465) with
identical precision and hit_rate — they find the same documents and differ only
in ordering. The two are substitutes, not complements: both fix first-stage
ranking errors, and applying RRF first perturbs the candidate order the reranker
then works from.

That is the second time this pattern appeared — contextual retrieval and
structural chunking were substitutes in Phase 2. **Stacking individually-good
retrieval techniques is not additive and should always be measured, never
assumed.**

## Measurement noise

Evaluation against a fixed index is bit-identical. Index *construction* is not:
the post-Phase-2 index measured 0.8083 immediately after its rebuild and 0.8321
after a later container restart, from Chroma HNSW nondeterminism. The observed
spread is **±0.024**, wider than the ±0.02 estimated in Phase 2. Differences
smaller than that are not evidence, and every conclusion above respects that
band.
