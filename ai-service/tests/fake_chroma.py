"""A multi-collection Chroma fake.

The existing `FakeCollection` in conftest models one collection, which is enough
for the shared corpus but cannot express the thing Phase 5 has to prove: that
two users' chunks live in different collections and one query cannot reach the
other. This fake keeps a real dict of named collections and honours `where`
filters the way Chroma does, so an isolation test fails if the isolation is
actually broken rather than because the fake refused to return anything.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional


def _matches(metadata: dict, where: Optional[dict]) -> bool:
    if not where:
        return True
    for clause in where.get("$and", [where]):
        for field, cond in clause.items():
            if isinstance(cond, dict):
                if "$eq" in cond and metadata.get(field) != cond["$eq"]:
                    return False
                if "$in" in cond and metadata.get(field) not in cond["$in"]:
                    return False
            elif metadata.get(field) != cond:
                return False
    return True


class FakeNamedCollection:
    def __init__(self, name: str) -> None:
        self.name = name
        self.rows: Dict[str, dict] = {}

    def upsert(self, ids, documents, embeddings, metadatas):
        for i, doc_id in enumerate(ids):
            self.rows[doc_id] = {
                "id": doc_id,
                "document": documents[i],
                "embedding": embeddings[i],
                "metadata": dict(metadatas[i]),
            }

    def get(self, where=None, include=None, limit=None):
        matched = [r for r in self.rows.values() if _matches(r["metadata"], where)]
        if limit is not None:
            matched = matched[:limit]
        return {
            "ids": [r["id"] for r in matched],
            "documents": [r["document"] for r in matched],
            "metadatas": [r["metadata"] for r in matched],
        }

    def query(self, query_embeddings, n_results, include=None, where=None):
        matched = [r for r in self.rows.values() if _matches(r["metadata"], where)][:n_results]
        return {
            "ids": [[r["id"] for r in matched]],
            "documents": [[r["document"] for r in matched]],
            "metadatas": [[r["metadata"] for r in matched]],
            "distances": [[0.1 * (i + 1) for i, _ in enumerate(matched)]],
        }

    def delete(self, ids):
        for doc_id in ids:
            self.rows.pop(doc_id, None)


class FakeChroma:
    def __init__(self) -> None:
        self.collections: Dict[str, FakeNamedCollection] = {}

    def get_or_create(self, name: str) -> FakeNamedCollection:
        return self.collections.setdefault(name, FakeNamedCollection(name))

    def get_if_exists(self, name: str):
        """Non-creating lookup. Modelled faithfully because the difference
        between this and get_or_create is where a real bug lived: a read path
        that creates would leave an empty namespace behind after deletion."""
        return self.collections.get(name)

    def delete_collection(self, name: str) -> bool:
        return self.collections.pop(name, None) is not None

    def names(self) -> List[str]:
        return sorted(self.collections)

    def all_rows(self) -> List[dict]:
        """Every row in every collection -- the direct query an isolation audit
        needs, bypassing the store's own filters entirely."""
        rows: List[dict] = []
        for collection in self.collections.values():
            for row in collection.rows.values():
                rows.append({**row, "collection": collection.name})
        return rows


def install(monkeypatch, module_path: str = "app.resume.store") -> FakeChroma:
    """Point a module's Chroma helpers at a fresh fake."""
    fake = FakeChroma()
    monkeypatch.setattr(f"{module_path}.get_named_collection", fake.get_or_create)
    monkeypatch.setattr(f"{module_path}.get_named_collection_if_exists", fake.get_if_exists)
    monkeypatch.setattr(f"{module_path}.delete_named_collection", fake.delete_collection)
    return fake


class CountingEmbedder:
    """Deterministic embeddings that vary with text, plus a call log.

    Varying with the text matters: an embedder returning a constant vector would
    make every retrieval ranking meaningless and hide ordering bugs.
    """

    def __init__(self) -> None:
        self.calls: List[List[str]] = []

    def embed(self, texts: List[str]) -> List[List[float]]:
        self.calls.append(list(texts))
        return [[float(len(t)), float(sum(map(ord, t[:16])) % 97), 1.0] for t in texts]


class FailingEmbedder:
    def embed(self, texts: Any):
        raise RuntimeError("embedding provider is down")
