"""
Second-stage reranking.

First-stage retrieval is a bi-encoder: query and document are embedded
*separately*, so the score is a similarity between two vectors that never saw
each other. It is fast and it is coarse. A reranker scores the pair *jointly*,
which is far more precise -- so the usual shape is retrieve a wide candidate set
cheaply, then rerank it accurately and keep the best few.

Why an LLM reranker rather than a cross-encoder: `docker-compose.prod.yml` caps
ai-service at 300 MB, and a sentence-transformers cross-encoder pulls torch and
a resident model well past that. The LLM path adds no dependency and no resident
memory, reusing the existing provider fallback. The trade-off is honest and
recorded: a cross-encoder would be faster per query and free at inference, while
this costs one extra call and its latency. If the memory ceiling is ever raised,
`strategy="cross_encoder"` is the slot to fill.

Failure is always non-fatal: any error, timeout or malformed response leaves the
original first-stage order untouched.
"""
from __future__ import annotations

import concurrent.futures
import json
import logging
import os
import re
from typing import Any, Dict, List

log = logging.getLogger(__name__)

RERANK_PROMPT = """You are ranking search results for relevance to a query.

Query: {query}

Candidates (id: excerpt):
{candidates}

Return the ids of the {keep} MOST relevant candidates, best first, as a JSON
array of integers. Judge only relevance to the query. Output only the array."""

EXCERPT_CHARS = int(os.getenv("RERANK_EXCERPT_CHARS", "400"))
# Hard ceiling on the reranker. Measured p50 is ~0.9s but the tail reached 10s,
# which would stall an interview mid-question. Past this the first-stage ranking
# is used instead: a slightly worse ordering is always better than a stalled UI.
TIMEOUT_SECONDS = float(os.getenv("RERANK_TIMEOUT_SECONDS", "5.0"))

# A module-level pool, deliberately NOT a `with` block. ThreadPoolExecutor's
# context manager calls shutdown(wait=True) on exit, which blocks until the
# worker finishes -- so wrapping the call in `with` makes the timeout useless
# and actively worse (measured: p50 976ms but max 20s, because every timed-out
# call was then waited on anyway). Abandoning the future is the whole point.
_POOL = concurrent.futures.ThreadPoolExecutor(
    max_workers=int(os.getenv("RERANK_POOL_WORKERS", "4")),
    thread_name_prefix="rerank",
)


def _parse_order(raw: Any, valid: int) -> List[int]:
    """Pull a list of candidate indices out of whatever the model returned."""
    if isinstance(raw, list):
        items = raw
    else:
        text = getattr(raw, "content", None) or str(raw)
        match = re.search(r"\[[^\]]*\]", str(text), re.S)
        if not match:
            return []
        try:
            items = json.loads(match.group(0))
        except Exception:
            return []

    order: List[int] = []
    for item in items:
        try:
            idx = int(item)
        except (TypeError, ValueError):
            continue
        if 0 <= idx < valid and idx not in order:
            order.append(idx)
    return order


def rerank(query: str, hits: List[Dict[str, Any]], *, keep: int) -> List[Dict[str, Any]]:
    """Reorder hits by joint query-document relevance. Never raises."""
    if len(hits) <= 1 or keep <= 0:
        return hits[:keep] if keep > 0 else hits

    try:
        from app.llm.chains import _get_llm

        candidates = "\n".join(
            f"{i}: {str(h.get('text', ''))[:EXCERPT_CHARS]}" for i, h in enumerate(hits)
        )
        prompt = RERANK_PROMPT.format(query=query, candidates=candidates, keep=keep)

        def _call():
            return _get_llm(None).invoke(prompt)

        future = _POOL.submit(_call)
        try:
            raw = future.result(timeout=TIMEOUT_SECONDS)
        except concurrent.futures.TimeoutError:
            # Abandon the in-flight call rather than waiting on it.
            future.cancel()
            log.warning("rerank exceeded %.1fs; keeping first-stage ranking", TIMEOUT_SECONDS)
            return hits[:keep]

        order = _parse_order(raw, len(hits))
        if not order:
            log.warning("reranker returned no usable order; keeping first-stage ranking")
            return hits[:keep]

        reranked = [hits[i] for i in order]
        # Anything the model omitted keeps its original relative order behind the
        # ranked set, so a partial response can never drop documents entirely.
        chosen = set(order)
        reranked.extend(h for i, h in enumerate(hits) if i not in chosen)
        for rank, hit in enumerate(reranked):
            hit["rerank_position"] = rank
        return reranked[:keep]

    except Exception as exc:
        log.warning("rerank failed (%s); keeping first-stage ranking", type(exc).__name__)
        return hits[:keep]
