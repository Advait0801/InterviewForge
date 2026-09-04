"""
Shared fixtures.

Hard rule for this suite: no test may hit the network, a real Chroma instance,
or an LLM provider. Everything external is faked here.
"""
import pytest


class FakeCollection:
    """Minimal stand-in for a Chroma collection."""

    def __init__(self, hits=None):
        self.upserts = []
        self._hits = hits if hits is not None else []
        self.last_query = None

    def upsert(self, ids, documents, embeddings, metadatas):
        self.upserts.append(
            {
                "ids": ids,
                "documents": documents,
                "embeddings": embeddings,
                "metadatas": metadatas,
            }
        )

    def query(self, query_embeddings, n_results, include, where=None):
        self.last_query = {"n_results": n_results, "where": where}
        # Honour the metadata filter the way Chroma would: when a filter is
        # supplied and nothing matches it, return no hits.
        hits = self._hits
        if where is not None and not self._match_filter(where):
            hits = []
        hits = hits[:n_results]
        return {
            "ids": [[h["id"] for h in hits]],
            "documents": [[h["text"] for h in hits]],
            "metadatas": [[h["metadata"] for h in hits]],
            "distances": [[h["distance"] for h in hits]],
        }

    def _match_filter(self, where):
        clauses = where.get("$and", [where])
        for clause in clauses:
            for field, cond in clause.items():
                wanted = cond.get("$eq")
                if not any(h["metadata"].get(field) == wanted for h in self._hits):
                    return False
        return True


class FakeEmbedder:
    """Deterministic embeddings — no API calls, stable across runs."""

    def __init__(self):
        self.calls = []

    def embed(self, texts):
        self.calls.append(list(texts))
        return [[float(len(t)), 1.0, 0.0] for t in texts]


@pytest.fixture
def fake_collection():
    return FakeCollection()


@pytest.fixture
def fake_embedder():
    return FakeEmbedder()


@pytest.fixture
def hit_factory():
    def _make(text="some context", company="amazon", stage="behavioral", distance=0.1, id_="1"):
        return {
            "id": id_,
            "text": text,
            "metadata": {"company": company, "stage": stage},
            "distance": distance,
        }

    return _make
