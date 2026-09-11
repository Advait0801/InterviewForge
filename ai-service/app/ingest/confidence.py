"""
Retrieval confidence: do we actually have good grounding for this query?

This is the gate that decides between the fast local path and an expensive live
fetch, so it has to be wrong in the cheap direction. Two failure modes:

  too eager  -> live fetches on queries we could already answer: wasted money,
                added latency, and unvetted content entering the corpus.
  too lazy   -> the LLM generates from weak context and the fallback never fires,
                which makes the whole hybrid design pointless.

Chroma returns *distances* (lower is better), not similarities, and **the
collection uses Chroma's default `l2` space, not cosine**. On unit-normalised
OpenAI embeddings that returns squared euclidean distance, which is exactly
`2 * (1 - cosine_similarity)` -- verified against hand-computed dot products, not
assumed. So the scale here is **twice** cosine distance: a chunk with cosine
similarity 0.71 comes back as 0.58, not 0.29.

That factor of two is not academic. The original thresholds were written for a
[0, 2] cosine-distance scale, and against the real corpus they passed only
**3 of 40** company/stage pairs -- meaning almost every question would have taken
the expensive live path. It went unnoticed because nothing called the gate: the
live fallback was wired into the API only in Phase 5 (D-038).

The defaults below are **calibrated against the corpus**, not chosen by feel.
`app/eval/calibrate_confidence.py` reproduces the sweep: it treats the four
hand-seeded companies as ground-truth "well covered" and the six thin Phase 4
starters as "should fetch", then picks the operating point that never fetches
needlessly for a covered pair. Re-run it whenever the corpus or the embedding
model changes -- both move this scale.

Thresholds stay env-tunable for exactly that reason.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional


def _float_env(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


# Best hit must be at least this close, or we have nothing solid.
# 0.78 is just above the worst top-hit distance measured across all 16
# well-covered company/stage pairs (0.7610), so no covered pair fetches.
MAX_TOP_DISTANCE = _float_env("RAG_CONFIDENCE_MAX_TOP_DISTANCE", 0.78)
# Require at least this many hits inside the "usable" band.
# One, not two: the company+stage filter often returns only 2-3 hits from a
# 721-chunk corpus, so demanding two usable ones drops covered-pair recall from
# 100% to 56-69% -- it fetches for companies that are in fact well covered.
MIN_GOOD_HITS = int(_float_env("RAG_CONFIDENCE_MIN_GOOD_HITS", 1))
MAX_GOOD_DISTANCE = _float_env("RAG_CONFIDENCE_MAX_GOOD_DISTANCE", 0.85)


@dataclass(frozen=True)
class ConfidenceVerdict:
    confident: bool
    reason: str
    top_distance: Optional[float]
    good_hits: int
    company_matched: bool

    def as_dict(self) -> Dict[str, Any]:
        return {
            "confident": self.confident,
            "reason": self.reason,
            "top_distance": self.top_distance,
            "good_hits": self.good_hits,
            "company_matched": self.company_matched,
        }


def assess(
    hits: List[Dict[str, Any]],
    *,
    company: Optional[str] = None,
) -> ConfidenceVerdict:
    """Judge whether retrieved hits are good enough to skip a live fetch."""
    if not hits:
        return ConfidenceVerdict(False, "no hits returned", None, 0, False)

    distances = [h.get("distance") for h in hits if h.get("distance") is not None]
    if not distances:
        # No distances means we cannot judge; assume confident rather than
        # fetching on every query, which would be the expensive failure.
        return ConfidenceVerdict(True, "no distances available, assuming confident", None, len(hits), True)

    top = min(distances)
    good_hits = sum(1 for d in distances if d <= MAX_GOOD_DISTANCE)

    company_matched = True
    if company:
        company_matched = any(
            str(h.get("metadata", {}).get("company", "")).lower() == company.lower()
            for h in hits
        )

    if top > MAX_TOP_DISTANCE:
        return ConfidenceVerdict(
            False, f"best hit too distant ({top:.3f} > {MAX_TOP_DISTANCE})", top, good_hits, company_matched
        )
    if good_hits < MIN_GOOD_HITS:
        return ConfidenceVerdict(
            False,
            f"only {good_hits} hit(s) within {MAX_GOOD_DISTANCE}, need {MIN_GOOD_HITS}",
            top, good_hits, company_matched,
        )
    if company and not company_matched:
        return ConfidenceVerdict(
            False, f"no chunk specific to '{company}'", top, good_hits, False
        )

    return ConfidenceVerdict(True, "sufficient local grounding", top, good_hits, company_matched)
