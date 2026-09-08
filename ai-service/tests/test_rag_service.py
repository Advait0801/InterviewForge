"""RAGService with Chroma and the embedder faked out."""
import hashlib
import pytest
from app.rag.service import RAGService


@pytest.fixture
def rag(monkeypatch, fake_collection, fake_embedder):
    monkeypatch.setattr("app.rag.service.get_chroma_collection", lambda: fake_collection)
    monkeypatch.setattr("app.rag.service.EmbeddingService", lambda: fake_embedder)
    service = RAGService()
    service._fake_collection = fake_collection
    service._fake_embedder = fake_embedder
    return service


def test_ingest_returns_zero_for_no_documents(rag):
    assert rag.ingest_documents([]) == {"ingested": 0}


def test_ingest_skips_documents_with_empty_text(rag):
    result = rag.ingest_documents([{"source": "s", "text": "   ", "metadata": {}}])
    assert result == {"ingested": 0}
    assert rag._fake_collection.upserts == []


def test_ingest_chunks_and_upserts(rag):
    result = rag.ingest_documents(
        [{"source": "guide", "text": "Some interview guidance.", "metadata": {"company": "amazon"}}]
    )
    assert result["ingested"] >= 1
    assert len(rag._fake_collection.upserts) == 1


def test_ingest_attaches_source_and_chunk_index_metadata(rag):
    rag.ingest_documents(
        [{"source": "guide", "text": "Some guidance.", "metadata": {"company": "amazon"}}]
    )
    meta = rag._fake_collection.upserts[0]["metadatas"][0]
    assert meta["source"] == "guide"
    assert meta["chunk_index"] == 0
    assert meta["company"] == "amazon"


def test_ids_are_deterministic_sha256_of_source_index_and_text(rag):
    rag.ingest_documents([{"source": "guide", "text": "Stable text.", "metadata": {}}])
    upsert = rag._fake_collection.upserts[0]
    expected = hashlib.sha256(
        f"guide::0::{upsert['documents'][0]}".encode("utf-8")
    ).hexdigest()
    assert upsert["ids"][0] == expected


def test_reingesting_identical_content_produces_identical_ids(rag):
    doc = {"source": "guide", "text": "Stable text.", "metadata": {}}
    rag.ingest_documents([doc])
    rag.ingest_documents([doc])
    first, second = rag._fake_collection.upserts
    # Idempotency: same content -> same ids -> upsert overwrites, no duplicates.
    assert first["ids"] == second["ids"]


def test_changing_content_changes_the_id(rag):
    rag.ingest_documents([{"source": "guide", "text": "Original text.", "metadata": {}}])
    rag.ingest_documents([{"source": "guide", "text": "Different text.", "metadata": {}}])
    first, second = rag._fake_collection.upserts
    assert first["ids"] != second["ids"]


def test_retrieve_shapes_hits_from_the_collection(monkeypatch, fake_embedder, hit_factory):
    collection = __import__("conftest", fromlist=["FakeCollection"]).FakeCollection(
        hits=[hit_factory(text="ctx one", id_="a"), hit_factory(text="ctx two", id_="b")]
    )
    monkeypatch.setattr("app.rag.service.get_chroma_collection", lambda: collection)
    monkeypatch.setattr("app.rag.service.EmbeddingService", lambda: fake_embedder)
    service = RAGService()

    result = service.retrieve("a query", top_k=2)

    assert result["query"] == "a query"
    assert result["top_k"] == 2
    assert [h["text"] for h in result["hits"]] == ["ctx one", "ctx two"]
    assert all("distance" in h for h in result["hits"])


def test_retrieve_respects_top_k(monkeypatch, fake_embedder, hit_factory):
    collection = __import__("conftest", fromlist=["FakeCollection"]).FakeCollection(
        hits=[hit_factory(id_=str(i)) for i in range(5)]
    )
    monkeypatch.setattr("app.rag.service.get_chroma_collection", lambda: collection)
    monkeypatch.setattr("app.rag.service.EmbeddingService", lambda: fake_embedder)
    service = RAGService()

    assert len(service.retrieve("q", top_k=2)["hits"]) == 2


def test_retrieve_embeds_the_query_exactly_once(rag):
    rag.retrieve("a query", top_k=3)
    assert rag._fake_embedder.calls[-1] == ["a query"]
