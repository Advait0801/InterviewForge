"""
The hybrid retrieval path, with the network faked.

The behaviour that matters is the read-through cache: a low-confidence query
fetches, writes back, and re-retrieves -- and the *second* identical query is
served locally with no fetch at all. A fallback that always fires is just live
search with extra steps, so both directions are asserted.
"""
import pytest

from app.ingest import limits as L
from app.ingest.limits import FetchLimiter
from app.interview import orchestrator as orch


class FakeRAG:
    """Retrieval whose quality improves once documents are written back."""

    def __init__(self, initial_hits=None):
        self._hits = list(initial_hits or [])
        self.ingested_docs = []
        self.retrieve_calls = 0

    def retrieve(self, query, *, top_k, where=None, stage=None):
        self.retrieve_calls += 1
        return {
            "query": query, "top_k": top_k, "where": where,
            "stage": stage, "hits": self._hits[:top_k],
        }

    def ingest_documents(self, docs):
        self.ingested_docs.extend(docs)
        # Simulate the write-back improving retrieval for later queries.
        self._hits = [
            {"id": f"live-{i}", "text": d["text"], "distance": 0.12,
             "metadata": d["metadata"]}
            for i, d in enumerate(docs)
        ] + self._hits
        return {"ingested": len(docs)}


def good_hit(company="amazon"):
    return {"id": "x", "text": "solid context", "distance": 0.18,
            "metadata": {"company": company, "stage": "coding", "source": "s"}}


def weak_hit(company="amazon"):
    return {"id": "y", "text": "unrelated", "distance": 1.2,
            "metadata": {"company": company, "stage": "coding", "source": "s"}}


@pytest.fixture(autouse=True)
def fresh_limiter(monkeypatch):
    monkeypatch.setattr(L, "limiter", FetchLimiter())
    import app.ingest.live as live
    monkeypatch.setattr(live, "limiter", L.limiter)
    yield


def test_confident_retrieval_does_not_trigger_a_fetch(monkeypatch):
    called = {"n": 0}

    def never(*a, **k):
        called["n"] += 1
        return []

    monkeypatch.setattr("app.ingest.live.discover_urls", never)
    rag = FakeRAG([good_hit(), good_hit()])

    result = orch.retrieve_with_live_fallback(
        rag=rag, company="amazon", stage="coding", difficulty="medium", top_k=5
    )

    assert result["confidence"]["confident"] is True
    assert result["live"]["triggered"] is False
    assert called["n"] == 0, "discovery must not run when local grounding is good"


def test_weak_retrieval_triggers_fetch_and_writes_back(monkeypatch):
    monkeypatch.setattr(
        "app.ingest.live.discover_urls",
        lambda q, limit=3: ["https://netflixtechblog.com/a", "https://netflixtechblog.com/b"],
    )

    pages = {
        "https://netflixtechblog.com/a": "Content about scaling services " * 30,
        "https://netflixtechblog.com/b": "Different content on queueing theory " * 30,
    }

    class P:
        def __init__(self, url, text):
            self.url, self.text = url, text
            self.title, self.source_key, self.company = "T", "netflix_tech", None
            self.fetched_at = 1.0

    monkeypatch.setattr("app.ingest.fetch.fetch_page", lambda url: P(url, pages[url]))
    rag = FakeRAG([weak_hit()])

    result = orch.retrieve_with_live_fallback(
        rag=rag, company="amazon", stage="coding", difficulty="medium", top_k=5,
        user_id="u1", session_id="s1",
    )

    assert result["live"]["triggered"] is True
    assert result["live"]["pages_ingested"] == 2
    assert len(rag.ingested_docs) == 2
    # Re-retrieved after write-back, so the new chunks are usable immediately.
    assert result["confidence"]["confident"] is True


def test_written_back_chunks_are_quarantined(monkeypatch):
    monkeypatch.setattr("app.ingest.live.discover_urls",
                        lambda q, limit=3: ["https://netflixtechblog.com/a"])

    class P:
        url = "https://netflixtechblog.com/a"
        text = "Some substantial engineering content here. " * 30
        title, source_key, company, fetched_at = "T", "netflix_tech", None, 1.0

    monkeypatch.setattr("app.ingest.fetch.fetch_page", lambda url: P())
    rag = FakeRAG([weak_hit()])

    orch.retrieve_with_live_fallback(
        rag=rag, company="amazon", stage="coding", difficulty="medium", top_k=5
    )

    meta = rag.ingested_docs[0]["metadata"]
    assert meta["origin"] == "live"
    assert meta["reviewed"] is False, "live content must be reversible"
    assert meta["source_url"].startswith("https://")


def test_second_identical_query_is_served_locally(monkeypatch):
    """The cache actually caches: fetch once, then fast path."""
    discoveries = {"n": 0}

    def discover(q, limit=3):
        discoveries["n"] += 1
        return ["https://netflixtechblog.com/a", "https://dropbox.tech/b"]

    bodies = {
        "https://netflixtechblog.com/a": "Substantial content about distributed systems. " * 30,
        "https://dropbox.tech/b": "A separate discussion of storage and replication. " * 30,
    }

    class P:
        def __init__(self, url):
            self.url, self.text = url, bodies[url]
            self.title, self.source_key, self.company = "T", "netflix_tech", None
            self.fetched_at = 1.0

    monkeypatch.setattr("app.ingest.live.discover_urls", discover)
    monkeypatch.setattr("app.ingest.fetch.fetch_page", lambda url: P(url))
    rag = FakeRAG([weak_hit()])

    kwargs = dict(rag=rag, company="amazon", stage="coding", difficulty="medium", top_k=5)
    first = orch.retrieve_with_live_fallback(**kwargs)
    second = orch.retrieve_with_live_fallback(**kwargs)

    assert first["live"]["triggered"] is True
    assert discoveries["n"] == 1, "the second identical query must not fetch again"
    assert second["confidence"]["confident"] is True
    assert second["live"]["triggered"] is False


def test_urls_outside_the_allowlist_are_skipped(monkeypatch):
    monkeypatch.setattr("app.ingest.live.discover_urls",
                        lambda q, limit=3: ["https://leetcode.com/editorial",
                                            "https://evil.example.com/x"])
    rag = FakeRAG([weak_hit()])

    result = orch.retrieve_with_live_fallback(
        rag=rag, company="amazon", stage="coding", difficulty="medium", top_k=5
    )

    assert rag.ingested_docs == []
    assert len(result["live"]["skipped"]) == 2


def test_a_failing_fetch_degrades_instead_of_raising(monkeypatch):
    monkeypatch.setattr("app.ingest.live.discover_urls",
                        lambda q, limit=3: ["https://netflixtechblog.com/a"])

    def boom(url):
        raise RuntimeError("network on fire")

    monkeypatch.setattr("app.ingest.fetch.fetch_page", boom)
    rag = FakeRAG([weak_hit()])

    result = orch.retrieve_with_live_fallback(
        rag=rag, company="amazon", stage="coding", difficulty="medium", top_k=5
    )

    # The interview continues with whatever local context exists.
    assert result["hits"] == [weak_hit()]
    assert result["live"]["pages_ingested"] == 0


def test_discovery_failure_does_not_break_retrieval(monkeypatch):
    def boom(q, limit=3):
        raise RuntimeError("discovery down")

    monkeypatch.setattr("app.ingest.live.discover_urls", boom)
    rag = FakeRAG([weak_hit()])

    result = orch.retrieve_with_live_fallback(
        rag=rag, company="amazon", stage="coding", difficulty="medium", top_k=5
    )
    assert result["live"]["triggered"] is True
    assert result["hits"]


def test_limits_block_the_fetch(monkeypatch):
    monkeypatch.setattr(L, "GLOBAL_DAILY_MAX", 0)
    called = {"n": 0}
    monkeypatch.setattr("app.ingest.live.discover_urls",
                        lambda q, limit=3: called.update(n=called["n"] + 1) or [])
    rag = FakeRAG([weak_hit()])

    result = orch.retrieve_with_live_fallback(
        rag=rag, company="amazon", stage="coding", difficulty="medium", top_k=5
    )
    assert result["live"]["triggered"] is False
    assert "global daily limit" in result["live"]["reason"]
    assert called["n"] == 0


def test_fallback_can_be_disabled_entirely(monkeypatch):
    monkeypatch.setattr(orch, "LIVE_FALLBACK_ENABLED", False)
    called = {"n": 0}
    monkeypatch.setattr("app.ingest.live.discover_urls",
                        lambda q, limit=3: called.update(n=called["n"] + 1) or [])
    rag = FakeRAG([weak_hit()])

    result = orch.retrieve_with_live_fallback(
        rag=rag, company="amazon", stage="coding", difficulty="medium", top_k=5
    )
    assert result["live"]["reason"] == "live fallback disabled"
    assert called["n"] == 0


def test_near_duplicate_pages_are_only_ingested_once(monkeypatch):
    monkeypatch.setattr("app.ingest.live.discover_urls",
                        lambda q, limit=3: ["https://netflixtechblog.com/a",
                                            "https://dropbox.tech/b"])
    body = "Sharding splits a table across nodes by a key such as user id. " * 20

    class P:
        def __init__(self, url, text):
            self.url, self.text = url, text
            self.title, self.source_key, self.company = "T", "netflix_tech", None
            self.fetched_at = 1.0

    monkeypatch.setattr("app.ingest.fetch.fetch_page",
                        lambda url: P(url, body if "netflix" in url else body + "!"))
    rag = FakeRAG([weak_hit()])

    result = orch.retrieve_with_live_fallback(
        rag=rag, company="amazon", stage="coding", difficulty="medium", top_k=5
    )
    assert result["live"]["pages_ingested"] == 1
    assert any("duplicate" in s["why"] for s in result["live"]["skipped"])
