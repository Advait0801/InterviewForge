"""
Deterministic retrieval metrics.

These are pure functions over (ranked retrieved ids, set of relevant ids).
No LLM, no network — so the metrics that Phases 2 and 3 optimise can be re-run
as often as needed at zero API cost.

Everything here treats relevance as binary: a retrieved document is either in
the labelled relevant set or it is not.
"""
from __future__ import annotations

import math
from typing import Dict, Iterable, List, Sequence, Set


def precision_at_k(retrieved: Sequence[str], relevant: Set[str], k: int) -> float:
    """Fraction of the top-k results that are relevant.

    Divides by k, not by len(top_k). Returning fewer than k results is itself a
    retrieval failure and should be penalised, not hidden.
    """
    if k <= 0:
        return 0.0
    top_k = list(retrieved)[:k]
    if not top_k:
        return 0.0
    return sum(1 for doc in top_k if doc in relevant) / k


def precision_at_k_normalized(retrieved: Sequence[str], relevant: Set[str], k: int) -> float:
    """Precision divided by the best precision achievable at this k.

    Raw precision@k is misleading when a query has fewer relevant documents than
    k: with 1 relevant document, precision@5 can never exceed 0.2, so a perfect
    retrieval still scores 0.2 and looks like a failure. Dividing by
    min(k, |relevant|)/k rescales so 1.0 means "as good as possible".
    """
    if k <= 0 or not relevant:
        return 1.0 if not relevant else 0.0
    ceiling = min(len(relevant), k) / k
    if ceiling == 0:
        return 0.0
    return precision_at_k(retrieved, relevant, k) / ceiling


def recall_at_k(retrieved: Sequence[str], relevant: Set[str], k: int) -> float:
    """Fraction of all relevant documents that appear in the top k."""
    if not relevant:
        # No relevant documents labelled: recall is undefined. Treat as perfect
        # so an unlabelled query cannot silently drag the average down.
        return 1.0
    top_k = set(list(retrieved)[:k])
    return len(top_k & relevant) / len(relevant)


def hit_rate_at_k(retrieved: Sequence[str], relevant: Set[str], k: int) -> float:
    """1.0 if at least one relevant document is in the top k, else 0.0."""
    if not relevant:
        return 1.0
    return 1.0 if set(list(retrieved)[:k]) & relevant else 0.0


def reciprocal_rank(retrieved: Sequence[str], relevant: Set[str]) -> float:
    """1/rank of the first relevant result; 0.0 if none is retrieved.

    Rewards putting a relevant document first rather than fifth — which is what
    matters when only the top few chunks reach the LLM prompt.
    """
    if not relevant:
        return 1.0
    for i, doc in enumerate(retrieved, start=1):
        if doc in relevant:
            return 1.0 / i
    return 0.0


def dcg_at_k(retrieved: Sequence[str], relevant: Set[str], k: int) -> float:
    """Discounted cumulative gain with binary relevance."""
    total = 0.0
    for i, doc in enumerate(list(retrieved)[:k], start=1):
        if doc in relevant:
            total += 1.0 / math.log2(i + 1)
    return total


def ndcg_at_k(retrieved: Sequence[str], relevant: Set[str], k: int) -> float:
    """DCG normalised by the best achievable ordering.

    Unlike precision@k this is rank-sensitive: retrieving the same documents in
    a better order scores higher.
    """
    if not relevant:
        return 1.0
    ideal_hits = min(len(relevant), k)
    idcg = sum(1.0 / math.log2(i + 1) for i in range(1, ideal_hits + 1))
    if idcg == 0:
        return 0.0
    return dcg_at_k(retrieved, relevant, k) / idcg


def evaluate_one(retrieved: Sequence[str], relevant: Iterable[str], k: int) -> Dict[str, float]:
    """All metrics for a single query."""
    rel = set(relevant)
    return {
        "precision_at_k": precision_at_k(retrieved, rel, k),
        "precision_norm": precision_at_k_normalized(retrieved, rel, k),
        "recall_at_k": recall_at_k(retrieved, rel, k),
        "hit_rate": hit_rate_at_k(retrieved, rel, k),
        "mrr": reciprocal_rank(retrieved, rel),
        "ndcg_at_k": ndcg_at_k(retrieved, rel, k),
    }


def aggregate(per_query: List[Dict[str, float]]) -> Dict[str, float]:
    """Mean of each metric across queries."""
    if not per_query:
        return {}
    keys = per_query[0].keys()
    return {key: sum(q[key] for q in per_query) / len(per_query) for key in keys}
