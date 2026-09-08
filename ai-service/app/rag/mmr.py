"""
Maximal Marginal Relevance.

Pure relevance ranking will happily return five chunks that all say the same
thing -- common here, because one article gets split into several adjacent
chunks that are each a good match for the query. The LLM then receives five
near-copies instead of five different pieces of evidence, which wastes context
and can make a partial answer look well supported.

MMR picks greedily, scoring each candidate as

    lambda * relevance(query, doc) - (1 - lambda) * max similarity(doc, already picked)

so a document has to be both relevant *and* different from what is already
selected. lambda=1 is plain relevance; lambda=0 is pure diversity.
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Sequence


def cosine(a: Sequence[float], b: Sequence[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def _relevance(hit: Dict[str, Any]) -> float:
    """Map a hit to a relevance score in roughly [0, 1].

    Distances are cosine distances (lower is better); a hit that arrived only
    from BM25 has no distance, so it is given a neutral score rather than being
    treated as maximally irrelevant.
    """
    distance = hit.get("distance")
    if distance is None:
        return 0.5
    return max(0.0, 1.0 - float(distance))


def _text_similarity(a: str, b: str) -> float:
    """Jaccard over token sets -- used when embeddings are unavailable."""
    ta = set(a.lower().split())
    tb = set(b.lower().split())
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def mmr_select(
    query_vector: Optional[Sequence[float]],
    hits: List[Dict[str, Any]],
    *,
    keep: int,
    lambda_: float = 0.7,
) -> List[Dict[str, Any]]:
    """Greedily pick `keep` hits balancing relevance against redundancy."""
    if keep <= 0 or not hits:
        return []
    if len(hits) <= keep:
        return hits

    remaining = list(hits)
    selected: List[Dict[str, Any]] = []

    while remaining and len(selected) < keep:
        best_hit = None
        best_score = -math.inf
        for candidate in remaining:
            relevance = _relevance(candidate)

            redundancy = 0.0
            for chosen in selected:
                va, vb = candidate.get("embedding"), chosen.get("embedding")
                if va and vb:
                    similarity = cosine(va, vb)
                else:
                    similarity = _text_similarity(
                        str(candidate.get("text", "")), str(chosen.get("text", ""))
                    )
                redundancy = max(redundancy, similarity)

            score = lambda_ * relevance - (1.0 - lambda_) * redundancy
            if score > best_score:
                best_score, best_hit = score, candidate

        if best_hit is None:
            break
        best_hit["mmr_score"] = best_score
        selected.append(best_hit)
        remaining.remove(best_hit)

    return selected
