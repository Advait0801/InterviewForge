"""
Per-stage query routing.

Not every stage wants the same retrieval. The Phase 3 measurements showed the
two strong techniques have different shapes:

  reranking   nDCG 0.947, p50 ~900ms  -- best quality, costs an LLM call
  hybrid+RRF  nDCG 0.870, p50 ~260ms  -- cheap, and specifically good at rare
                                         exact terms, which is what BM25 adds

So the policy is not "use the best one everywhere". Stages whose questions turn
on precise vocabulary -- coding and core CS, where a query is "Isabelle/HOL" or
"false sharing" or a named algorithm -- are exactly where sparse matching earns
its keep, and where the cheap path is closest to the expensive one. Stages that
are discursive and semantic -- behavioural, system design -- are where a
reranker's joint scoring pays for itself.

Routing therefore buys most of the quality at a fraction of the average latency,
rather than paying reranker latency on every question.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Dict, Optional


@dataclass(frozen=True)
class Route:
    stage: str
    rerank: bool
    hybrid: bool
    top_k: int
    reason: str


_DEFAULT_TOP_K = int(os.getenv("RAG_TOP_K", "5"))

# stage -> policy
_ROUTES: Dict[str, Route] = {
    "behavioral": Route(
        "behavioral", rerank=True, hybrid=False, top_k=_DEFAULT_TOP_K,
        reason="discursive, semantic queries; joint scoring pays off",
    ),
    "system_design": Route(
        "system_design", rerank=True, hybrid=False, top_k=_DEFAULT_TOP_K,
        reason="broad conceptual queries with many adjacent candidates",
    ),
    "coding": Route(
        "coding", rerank=False, hybrid=True, top_k=_DEFAULT_TOP_K,
        reason="named algorithms and techniques; exact-term matching matters",
    ),
    "core_cs": Route(
        "core_cs", rerank=False, hybrid=True, top_k=_DEFAULT_TOP_K,
        reason="precise terminology (RDMA, false sharing, CAP); BM25 recovers rare terms",
    ),
}

_FALLBACK = Route(
    "default", rerank=True, hybrid=False, top_k=_DEFAULT_TOP_K,
    reason="unknown stage; use the highest-quality path",
)


def route_for(stage: Optional[str]) -> Route:
    if not stage:
        return _FALLBACK
    return _ROUTES.get(stage.strip().lower(), _FALLBACK)


def all_routes() -> Dict[str, Route]:
    return dict(_ROUTES)
