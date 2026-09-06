# Phase 2 — index-side retrieval results

Three techniques, each measured independently against the same cached source
documents. Reproduce any row with:

```bash
docker compose exec ai-service python -m app.ingest.reindex --rebuild   # with the strategy set
docker compose exec ai-service python -m app.eval.run --k 5 --no-filter
```

## Measurement noise — read before comparing rows

Evaluation is **bit-identical** across repeated runs against the same index
(verified: three consecutive runs, all nDCG 0.8083). But rebuilding the index
from the same cached documents does **not** reproduce exactly: two structural
rebuilds scored nDCG 0.8263 and 0.8083, an 0.018 spread, caused by
nondeterminism in Chroma's HNSW index construction.

**So a single-rebuild difference smaller than about ±0.02 is not evidence.**
Both conclusions below sit outside that band, but the structural gain is closer
to it than the raw numbers suggest.

## Results

All against 42 golden queries, k=5, no metadata filter.

| Technique | precision_norm | recall | hit_rate | MRR | nDCG@5 | verdict |
|---|---|---|---|---|---|---|
| character chunking (baseline) | 0.8095 | 0.8095 | 0.8333 | 0.7817 | 0.7712 | — |
| **structural chunking** | **0.8690** | **0.8690** | **0.9048** | **0.8460** | **0.8263** | **kept** |
| + contextual retrieval | 0.7857 | 0.7857 | 0.8333 | 0.7937 | 0.7651 | **reverted** |
| small-to-big (window 1) | no change to ranking by design | | | | | **kept** |

Final shipped configuration — structural chunking + parent window 1, measured on
a fresh rebuild:

| Metric | character | final | delta |
|---|---|---|---|
| precision_norm | 0.8095 | 0.8452 | +0.0357 |
| recall@5 | 0.8095 | 0.8452 | +0.0357 |
| hit_rate@5 | 0.8333 | 0.8810 | +0.0476 |
| MRR | 0.7817 | 0.8294 | +0.0476 |
| nDCG@5 | 0.7712 | 0.8083 | +0.0371 |

## 1. Structural chunking — kept

Splits on markdown headings, then blank-line paragraphs, falling back to
character splitting only *inside* a section that is still oversized. Sections
below a floor are merged with their neighbour so the corpus does not fill with
one-line fragments.

Every metric improved. The reason it matters here and would not have mattered
before Phase 4: the seed corpus was 34 single-idea documents where character
splitting was harmless. Ingested blog articles are 10-30k characters covering
several topics each, so cutting on character counts mixed unrelated sections
into one chunk.

## 2. Small-to-big retrieval — kept, and measured differently

Small-to-big widens each hit to include neighbouring chunks from the same
document. It **cannot** be scored by the retrieval harness: it changes the text
handed to the LLM, not the ranking. Measured delta on every retrieval metric was
exactly 0.0000, as predicted.

So it was measured with an LLM-judged **context sufficiency** rubric instead —
can the retrieved context actually answer the question, 1-5:

| parent window | sufficiency | context size |
|---|---|---|
| 0 | 3.38 | 1.00x |
| **1** | **4.50 (+1.12)** | 2.06x |
| 2 | 4.00 (+0.62) | 2.63x |

**Window 2 scored lower than window 1 on 28% more text.** More context is not
monotonically better — the signal gets diluted. Window 1 shipped.

Caveat: sample of 8 queries, single judge pass. The direction is clear; the exact
magnitude is not tightly bounded.

## 3. Contextual retrieval — reverted

Prepending an LLM-written situating sentence to each chunk before embedding made
retrieval **worse** on every metric: nDCG -0.061, hit_rate -0.071,
precision_norm -0.083. Well outside the noise band.

The likely reason is redundancy with technique 1. Contextual retrieval exists to
restore context that chunking destroyed — but structural chunking already keeps
each section with its heading, so the situating information is largely present
already. The generated sentence then adds near-boilerplate phrasing that dilutes
the chunk's distinctive terms in the embedding, and makes sibling chunks from one
document look more alike rather than less.

**This is the interesting result of the phase:** two techniques that are each
individually sensible are partly substitutes, and stacking them is a net loss.
The published wins for contextual retrieval are measured against naive
fixed-size chunking, which is the baseline it repairs.

The implementation is kept behind `CONTEXTUAL_RETRIEVAL=false` so it can be
re-tested if chunking changes again — it is worth re-running the moment the
corpus contains long unstructured documents without headings.
