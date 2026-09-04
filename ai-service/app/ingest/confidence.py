"""
Retrieval confidence: do we actually have good grounding for this query?

This is the gate that decides between the fast local path and an expensive live
fetch, so it has to be wrong in the cheap direction. Two failure modes:

  too eager  -> live fetches on queries we could already answer: wasted money,
                added latency, and unvetted content entering the corpus.
  too lazy   -> the LLM generates from weak context and the fallback never fires,
                which makes the whole hybrid design pointless.

Chroma returns *distances* (lower is better), not similarities. For cosine
distance the range is [0, 2]. Thresholds are env-tunable because the right value
depends on the embedding model, and it changes if the model changes.
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
MAX_TOP_DISTANCE = _float_env("RAG_CONFIDENCE_MAX_TOP_DISTANCE", 0.62)
# Require at least this many hits inside the "usable" band.
MIN_GOOD_HITS = int(_float_env("RAG_CONFIDENCE_MIN_GOOD_HITS", 2))
MAX_GOOD_DISTANCE = _float_env("RAG_CONFIDENCE_MAX_GOOD_DISTANCE", 0.75)


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
