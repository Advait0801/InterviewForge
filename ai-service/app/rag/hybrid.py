"""
Hybrid retrieval: dense vectors + BM25, fused with Reciprocal Rank Fusion.

Dense retrieval matches *meaning*, which is why it handles "why does the UI
stutter" finding a document about main-thread work. The flip side is that it is
weak on rare exact tokens -- specific algorithm names, acronyms, product names --
because a term that carries almost all the information gets averaged into a
vector with everything else. BM25 is the opposite: it is exact-term matching
with frequency weighting, and it is very good at precisely what dense retrieval
misses.

RRF combines the two without needing their scores to be comparable, which they
are not (cosine distance vs a BM25 score on an unbounded scale). It uses only
*rank*: score = sum over lists of 1/(k + rank). That property is the reason RRF
is the standard choice here -- no tuning of score normalisation, no assumption
that one system's 0.8 means the same as another's.

BM25 is implemented directly rather than via a dependency: it is ~40 lines, the
corpus is small enough to index in memory, and it stays unit-testable.
"""
from __future__ import annotations

import math
import re
import threading
from typing import Any, Dict, List, Optional, Sequence, Tuple

_TOKEN_RE = re.compile(r"[a-z0-9]+")

K1 = 1.5
B = 0.75


def tokenize(text: str) -> List[str]:
    return _TOKEN_RE.findall(text.lower())


class BM25Index:
    """In-memory BM25 over the whole collection."""

    def __init__(self, doc_ids: Sequence[str], texts: Sequence[str]) -> None:
        self.doc_ids = list(doc_ids)
        self.docs = [tokenize(t) for t in texts]
        self.doc_len = [len(d) for d in self.docs]
        self.avgdl = (sum(self.doc_len) / len(self.doc_len)) if self.doc_len else 0.0

        self.freqs: List[Dict[str, int]] = []
        self.df: Dict[str, int] = {}
        for tokens in self.docs:
            counts: Dict[str, int] = {}
            for token in tokens:
                counts[token] = counts.get(token, 0) + 1
            self.freqs.append(counts)
            for token in counts:
                self.df[token] = self.df.get(token, 0) + 1

        self.n = len(self.docs)

    def idf(self, term: str) -> float:
        df = self.df.get(term, 0)
        if df == 0:
            return 0.0
        # BM25 idf with the +0.5 smoothing that keeps common terms non-negative.
        return math.log(1 + (self.n - df + 0.5) / (df + 0.5))

    def score(self, query: str, index: int) -> float:
        if self.avgdl == 0:
            return 0.0
        total = 0.0
        counts = self.freqs[index]
        length = self.doc_len[index]
        for term in tokenize(query):
            tf = counts.get(term, 0)
            if tf == 0:
                continue
            denom = tf + K1 * (1 - B + B * length / self.avgdl)
            total += self.idf(term) * (tf * (K1 + 1)) / denom
        return total

    def search(self, query: str, *, limit: int) -> List[Tuple[str, float]]:
        scored = [
            (self.doc_ids[i], self.score(query, i))
            for i in range(self.n)
        ]
        scored = [row for row in scored if row[1] > 0]
        scored.sort(key=lambda row: row[1], reverse=True)
        return scored[:limit]


_index_lock = threading.Lock()
_index: Optional[BM25Index] = None
_index_size: int = -1


def get_index(force: bool = False) -> Optional[BM25Index]:
    """Build (and cache) a BM25 index over the current collection.

    Rebuilt when the collection size changes, which covers ingestion and
    re-indexing without needing an explicit invalidation call.
    """
    global _index, _index_size
    from app.rag.chroma_client import get_chroma_collection

    collection = get_chroma_collection()
    try:
        size = collection.count()
    except Exception:
        return None

    with _index_lock:
        if _index is not None and size == _index_size and not force:
            return _index
        try:
            got = collection.get(include=["documents"], limit=200_000)
        except Exception:
            return None
        ids = got.get("ids") or []
        docs = got.get("documents") or []
        if not ids:
            return None
        _index = BM25Index(ids, docs)
        _index_size = size
        return _index


def reciprocal_rank_fusion(
    rankings: Sequence[Sequence[str]], *, k: int = 60
) -> Dict[str, float]:
    """Fuse ranked id lists. Only rank matters, never the original scores."""
    scores: Dict[str, float] = {}
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank + 1)
    return scores


def fuse_with_bm25(
    query: str, dense_hits: List[Dict[str, Any]], *, k: int = 60
) -> List[Dict[str, Any]]:
    """Reorder dense hits by fusing them with a BM25 ranking of the corpus."""
    index = get_index()
    if index is None or not dense_hits:
        return dense_hits

    dense_ids = [str(h.get("id")) for h in dense_hits]
    sparse = index.search(query, limit=max(len(dense_hits), 20))
    sparse_ids = [doc_id for doc_id, _ in sparse]

    fused = reciprocal_rank_fusion([dense_ids, sparse_ids], k=k)

    by_id = {str(h.get("id")): h for h in dense_hits}
    # A BM25-only hit is a document dense retrieval missed entirely -- exactly
    # the recall case hybrid search exists to recover -- so pull its content in.
    missing = [doc_id for doc_id in sparse_ids if doc_id not in by_id]
    if missing:
        from app.rag.chroma_client import get_chroma_collection

        try:
            got = get_chroma_collection().get(
                ids=missing[:20], include=["documents", "metadatas"]
            )
            for doc_id, text, meta in zip(
                got.get("ids") or [], got.get("documents") or [], got.get("metadatas") or []
            ):
                by_id[str(doc_id)] = {
                    "id": doc_id,
                    "text": text,
                    "metadata": meta,
                    "distance": None,
                    "source_stage": "bm25",
                }
        except Exception:
            pass

    ordered = sorted(
        (doc_id for doc_id in fused if doc_id in by_id),
        key=lambda doc_id: fused[doc_id],
        reverse=True,
    )
    out = []
    for doc_id in ordered:
        hit = by_id[doc_id]
        hit["rrf_score"] = fused[doc_id]
        out.append(hit)
    return out
