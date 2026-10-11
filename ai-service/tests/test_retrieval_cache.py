"""
The retrieval cache (Phase 11): tiers, partitions, invalidation, bounds and outages, against
both stores (in-process and Redis via fakeredis). No network, no Chroma, no model.
"""
import json

import fakeredis
import pytest

from app.core import config
from app.rag import cache as cache_module
from app.rag.cache import MemoryStore, RedisStore, RetrievalCache
from app.rag.service import RAGService


class VecEmbedder:
    """Maps known texts to fixed vectors so similarity is under the test's control."""

    active_provider = "openai"

    def __init__(self, table=None):
        self.table = table or {}
        self.calls = []

    def embed(self, texts):
        self.calls.append(list(texts))
        return [list(self.table.get(t, [1.0, 0.0, 0.0])) for t in texts]


def make_store(kind, *, max_entries=50, ttl=600, pmax=8, clock=None):
    sizes = dict(max_entries=max_entries, ttl_seconds=ttl, partition_max=pmax)
    if kind == "memory":
        return MemoryStore(**sizes, **({"clock": clock} if clock else {}))
    return RedisStore(fakeredis.FakeRedis(server=fakeredis.FakeServer()), **sizes)


@pytest.fixture(params=["memory", "redis"])
def kind(request):
    return request.param


def install(monkeypatch, store, **kw):
    c = RetrievalCache(store, **kw)
    monkeypatch.setattr(cache_module, "cache", c)
    return c


@pytest.fixture
def rag_factory(monkeypatch, fake_collection, hit_factory):
    def _make(embedder=None, hits=None):
        fake_collection._hits = hits if hits is not None else [
            hit_factory(text="ctx one", id_="a"), hit_factory(text="ctx two", id_="b"),
        ]
        emb = embedder or VecEmbedder()
        monkeypatch.setattr("app.rag.service.get_chroma_collection", lambda: fake_collection)
        monkeypatch.setattr("app.rag.service.EmbeddingService", lambda: emb)
        monkeypatch.setattr(config, "ROUTING_ENABLED", False)
        monkeypatch.setattr(config, "RERANK_ENABLED", False)
        monkeypatch.setattr(config, "HYBRID_ENABLED", False)
        monkeypatch.setattr(config, "PARENT_WINDOW", 0)
        # The real fusion builds its BM25 index from Chroma; keep the suite off the network.
        monkeypatch.setattr("app.rag.hybrid.fuse_with_bm25", lambda q, hits, k=60: hits)
        service = RAGService()
        service._emb = emb
        return service

    return _make


def count_queries(collection):
    calls = {"n": 0}
    original = collection.query

    def wrapped(*a, **kw):
        calls["n"] += 1
        return original(*a, **kw)

    collection.query = wrapped
    return calls


WHERE = {"$and": [{"company": {"$eq": "amazon"}}, {"stage": {"$eq": "behavioral"}}]}


# --- exact tier ------------------------------------------------------------------------

def test_exact_repeat_skips_embedding_and_chroma(monkeypatch, kind, rag_factory, fake_collection):
    c = install(monkeypatch, make_store(kind))
    rag = rag_factory()
    queries = count_queries(fake_collection)

    first = rag.retrieve("Amazon behavioral interview", top_k=2, where=WHERE)
    second = rag.retrieve("  amazon   BEHAVIORAL interview ", top_k=2, where=WHERE)

    assert first["cache"]["tier"] == "miss"
    assert second["cache"]["tier"] == "exact"
    assert second["hits"] == first["hits"]
    assert second["query"] == "  amazon   BEHAVIORAL interview "
    assert second["cache"]["cachedQuery"] == "Amazon behavioral interview"
    assert queries["n"] == 1
    assert len(rag._emb.calls) == 1, "an exact hit must not embed"
    assert c.stats["exact"] == 1 and c.stats["miss"] == 1


def test_a_served_result_is_a_copy(monkeypatch, kind, rag_factory):
    install(monkeypatch, make_store(kind))
    rag = rag_factory()
    rag.retrieve("q", top_k=2, where=WHERE)
    served = rag.retrieve("q", top_k=2, where=WHERE)
    served["hits"].clear()
    served["confidence"] = {"x": 1}
    again = rag.retrieve("q", top_k=2, where=WHERE)
    assert len(again["hits"]) == 2 and "confidence" not in again


@pytest.mark.parametrize("change", [
    {"where": {"$and": [{"company": {"$eq": "google"}}, {"stage": {"$eq": "behavioral"}}]}},
    {"where": None},
    {"top_k": 1},
    {"stage": "coding"},
])
def test_anything_besides_the_text_that_changes_the_result_is_a_miss(
    monkeypatch, kind, rag_factory, change
):
    install(monkeypatch, make_store(kind))
    rag = rag_factory()
    base = {"top_k": 2, "where": WHERE, "stage": None}
    rag.retrieve("same words", **base)
    monkeypatch.setattr(config, "ROUTING_ENABLED", True)
    if "stage" not in change:
        rag.retrieve("same words", **base)  # routing on with no stage: same partition
    other = rag.retrieve("same words", **{**base, **change})
    assert other["cache"]["tier"] == "miss"


def test_a_different_embedding_model_is_a_different_partition(monkeypatch, kind, rag_factory):
    install(monkeypatch, make_store(kind))
    rag = rag_factory()
    rag.retrieve("q", top_k=2, where=WHERE)
    monkeypatch.setattr(config, "OPENAI_EMBEDDING_MODEL", "text-embedding-3-large")
    assert rag.retrieve("q", top_k=2, where=WHERE)["cache"]["tier"] == "miss"


# --- invalidation ------------------------------------------------------------------------

def test_ingesting_invalidates(monkeypatch, kind, rag_factory):
    install(monkeypatch, make_store(kind))
    rag = rag_factory()
    rag.retrieve("q", top_k=2, where=WHERE)
    rag.ingest_documents([{"source": "new", "text": "fresh chunk", "metadata": {}}])
    assert rag.retrieve("q", top_k=2, where=WHERE)["cache"]["tier"] == "miss"
    assert rag.retrieve("q", top_k=2, where=WHERE)["cache"]["tier"] == "exact"


def test_deleting_a_source_invalidates_but_a_noop_delete_does_not(monkeypatch, kind, rag_factory):
    c = install(monkeypatch, make_store(kind))
    rag = rag_factory()
    removed = {"ids": []}
    rag.collection.get = lambda where=None, **kw: dict(removed)
    rag.collection.delete = lambda ids: None

    rag.retrieve("q", top_k=2, where=WHERE)
    rag.delete_source("nothing-there")
    assert rag.retrieve("q", top_k=2, where=WHERE)["cache"]["tier"] == "exact"

    removed["ids"] = ["x1"]
    rag.delete_source("old")
    assert c.stats["invalidations"] == 1
    assert rag.retrieve("q", top_k=2, where=WHERE)["cache"]["tier"] == "miss"


def test_live_write_back_reaches_the_refreshed_retrieval(monkeypatch, kind, rag_factory, hit_factory):
    """retrieve_with_live_fallback re-retrieves after a write; that must not be served the
    pre-write result from the cache."""
    install(monkeypatch, make_store(kind))
    rag = rag_factory(hits=[hit_factory(text="old", id_="a")])
    rag.retrieve("q", top_k=2, where=WHERE)
    rag._fake = rag.collection
    rag.collection._hits = [hit_factory(text="old", id_="a"), hit_factory(text="new", id_="n")]
    rag.ingest_documents([{"source": "live", "text": "new", "metadata": {}}])
    refreshed = rag.retrieve("q", top_k=2, where=WHERE)
    assert [h["text"] for h in refreshed["hits"]] == ["old", "new"]


def test_two_stores_on_one_redis_share_hits_and_invalidation(monkeypatch, rag_factory):
    server = fakeredis.FakeServer()
    sizes = dict(max_entries=50, ttl_seconds=600, partition_max=8)
    a = RetrievalCache(RedisStore(fakeredis.FakeRedis(server=server), **sizes))
    b = RetrievalCache(RedisStore(fakeredis.FakeRedis(server=server), **sizes))
    rag = rag_factory()
    monkeypatch.setattr(cache_module, "cache", a)
    rag.retrieve("q", top_k=2, where=WHERE)
    monkeypatch.setattr(cache_module, "cache", b)
    assert rag.retrieve("q", top_k=2, where=WHERE)["cache"]["tier"] == "exact"
    a.invalidate()
    assert rag.retrieve("q", top_k=2, where=WHERE)["cache"]["tier"] == "miss"


# --- semantic tier -------------------------------------------------------------------------

def marking_rerank(q, hits, keep):
    for i, h in enumerate(hits):
        h["rerank_position"] = i
    return hits[:keep]


def use_reranker(monkeypatch):
    monkeypatch.setattr(config, "RERANK_ENABLED", True)
    monkeypatch.setattr("app.rag.rerank.rerank", marking_rerank)


def test_semantic_hit_above_threshold_miss_below(monkeypatch, kind, rag_factory, fake_collection):
    install(monkeypatch, make_store(kind), semantic=True, threshold=0.9)
    emb = VecEmbedder({
        "original": [1.0, 0.0, 0.0],
        "paraphrase": [0.95, 0.31, 0.0],   # cosine ~0.95
        "different": [0.6, 0.8, 0.0],      # cosine 0.6
    })
    rag = rag_factory(embedder=emb)
    use_reranker(monkeypatch)
    queries = count_queries(fake_collection)

    rag.retrieve("original", top_k=2, where=WHERE)
    para = rag.retrieve("paraphrase", top_k=2, where=WHERE)
    diff = rag.retrieve("different", top_k=2, where=WHERE)

    assert para["cache"]["tier"] == "semantic"
    assert 0.9 <= para["cache"]["similarity"] < 1.0
    assert para["cache"]["cachedQuery"] == "original"
    assert diff["cache"]["tier"] == "miss"
    assert queries["n"] == 2
    # One embedding per distinct query: a miss reuses the lookup's vector.
    assert emb.calls == [["original"], ["paraphrase"], ["different"]]


def test_semantic_off_never_embeds_for_lookup(monkeypatch, kind, rag_factory):
    install(monkeypatch, make_store(kind), semantic=False)
    emb = VecEmbedder({"a": [1, 0, 0], "b": [1, 0, 0]})
    rag = rag_factory(embedder=emb)
    rag.retrieve("a", top_k=2, where=WHERE)
    assert rag.retrieve("b", top_k=2, where=WHERE)["cache"]["tier"] == "miss"
    assert emb.calls == [["a"], ["b"]]


def test_semantic_never_crosses_partitions(monkeypatch, kind, rag_factory):
    install(monkeypatch, make_store(kind), semantic=True, threshold=0.5)
    rag = rag_factory(embedder=VecEmbedder({"a": [1, 0, 0], "b": [1, 0, 0]}))
    use_reranker(monkeypatch)
    rag.retrieve("a", top_k=2, where=WHERE)
    other = {"$and": [{"company": {"$eq": "meta"}}, {"stage": {"$eq": "behavioral"}}]}
    assert rag.retrieve("b", top_k=2, where=other)["cache"]["tier"] == "miss"


def test_semantic_only_where_a_reranker_sits_behind_the_query(monkeypatch, kind, rag_factory):
    """Without a reranker the embedding is most of retrieval's cost: a semantic hit would save
    nothing, so the tier doesn't run and the lookup embeds nothing."""
    install(monkeypatch, make_store(kind), semantic=True, threshold=0.5)
    emb = VecEmbedder({"a": [1, 0, 0], "b": [1, 0, 0]})
    rag = rag_factory(embedder=emb)
    rag.retrieve("a", top_k=2, where=WHERE)
    assert rag.retrieve("b", top_k=2, where=WHERE)["cache"]["tier"] == "miss"
    assert emb.calls == [["a"], ["b"]]

    use_reranker(monkeypatch)
    rag.retrieve("a", top_k=2, where=WHERE)
    assert rag.retrieve("b", top_k=2, where=WHERE)["cache"]["tier"] == "semantic"


def test_the_shipped_routes_allow_semantic_only_on_reranked_stages(monkeypatch, kind, rag_factory):
    install(monkeypatch, make_store(kind), semantic=True, threshold=0.5)
    rag = rag_factory(embedder=VecEmbedder({"a": [1, 0, 0], "b": [1, 0, 0]}))
    monkeypatch.setattr(config, "ROUTING_ENABLED", True)
    monkeypatch.setattr("app.rag.rerank.rerank", marking_rerank)
    tiers = {}
    for stage in ("behavioral", "system_design", "coding", "core_cs"):
        rag.retrieve("a", top_k=2, where=WHERE, stage=stage)
        tiers[stage] = rag.retrieve("b", top_k=2, where=WHERE, stage=stage)["cache"]["tier"]
    assert tiers == {"behavioral": "semantic", "system_design": "semantic",
                     "coding": "miss", "core_cs": "miss"}


def test_vectors_of_another_dimension_never_match(kind):
    c = RetrievalCache(make_store(kind), semantic=True, threshold=-0.5)
    found = c.lookup("a", "p", lambda q: [1.0, 0.0])
    c.store_result(found, {"hits": []}, [1.0, 0.0])
    assert c.lookup("b", "p", lambda q: [1.0, 0.0, 0.0]).tier == "miss"


# --- what is never cached -------------------------------------------------------------------

def test_a_degraded_rerank_is_cached_only_briefly(monkeypatch, rag_factory):
    """A timed-out rerank is first-stage order: kept for DEGRADED_TTL_SECONDS, not the full
    TTL, so a slow provider doesn't cost every repeat a timeout, and the ranking recovers."""
    now = {"t": 0.0}
    store = make_store("memory", ttl=10_000, clock=lambda: now["t"])
    c = install(monkeypatch, store, clock=lambda: now["t"])
    rag = rag_factory()
    monkeypatch.setattr(config, "RERANK_ENABLED", True)
    monkeypatch.setattr("app.rag.rerank.rerank", lambda q, hits, keep: hits[:keep])
    first = rag.retrieve("q", top_k=2, where=WHERE)
    assert len(first["hits"]) == 2 and c.stats["degraded"] == 1 and c.stats["stored"] == 0
    now["t"] = cache_module.DEGRADED_TTL_SECONDS - 1
    assert rag.retrieve("q", top_k=2, where=WHERE)["cache"]["tier"] == "exact"
    now["t"] = cache_module.DEGRADED_TTL_SECONDS + 1
    assert rag.retrieve("q", top_k=2, where=WHERE)["cache"]["tier"] == "miss"


def test_redis_gives_a_degraded_result_the_short_ttl():
    client = fakeredis.FakeRedis(server=fakeredis.FakeServer())
    c = RetrievalCache(RedisStore(client, max_entries=5, ttl_seconds=10_000, partition_max=4))
    c.store_result(c.lookup("q", "p", lambda q: [1.0]), {"a": 1}, [1.0], degraded=True)
    (key,) = client.keys("ragcache:r:*")
    assert 0 < client.ttl(key) <= cache_module.DEGRADED_TTL_SECONDS


def test_a_successful_rerank_is_cached(monkeypatch, kind, rag_factory):
    install(monkeypatch, make_store(kind))
    rag = rag_factory()
    monkeypatch.setattr(config, "RERANK_ENABLED", True)
    calls = {"n": 0}

    def fake_rerank(q, hits, keep):
        calls["n"] += 1
        out = list(reversed(hits))
        for i, h in enumerate(out):
            h["rerank_position"] = i
        return out[:keep]

    monkeypatch.setattr("app.rag.rerank.rerank", fake_rerank)
    first = rag.retrieve("q", top_k=2, where=WHERE)
    second = rag.retrieve("q", top_k=2, where=WHERE)
    assert second["cache"]["tier"] == "exact" and second["hits"] == first["hits"]
    assert calls["n"] == 1, "a hit must not call the reranker"


def test_oversized_results_are_not_cached(monkeypatch, kind, rag_factory, hit_factory):
    c = install(monkeypatch, make_store(kind), max_entry_bytes=500)
    rag = rag_factory(hits=[hit_factory(text="x" * 2000, id_="a")])
    rag.retrieve("q", top_k=2, where=WHERE)
    assert c.stats["tooLarge"] == 1
    assert rag.retrieve("q", top_k=2, where=WHERE)["cache"]["tier"] == "miss"


# --- bounds ---------------------------------------------------------------------------------

def test_entry_count_is_capped_oldest_first(kind):
    store = make_store(kind, max_entries=3, pmax=10)
    c = RetrievalCache(store)
    for i in range(5):
        found = c.lookup(f"q{i}", "p", lambda q: [1.0])
        c.store_result(found, {"i": i}, [1.0])
    assert store.size() == 3
    assert c.lookup("q0", "p", lambda q: [1.0]).tier == "miss"
    assert c.lookup("q1", "p", lambda q: [1.0]).tier == "miss"
    assert c.lookup("q4", "p", lambda q: [1.0]).result == {"i": 4}


def test_redis_keys_carry_a_ttl_and_dropped_entries_leave_no_keys():
    client = fakeredis.FakeRedis(server=fakeredis.FakeServer())
    store = RedisStore(client, max_entries=2, ttl_seconds=600, partition_max=8)
    c = RetrievalCache(store)
    for i in range(4):
        c.store_result(c.lookup(f"q{i}", "p", lambda q: [1.0]), {"i": i}, [1.0])
    results = client.keys("ragcache:r:*")
    vectors = client.keys("ragcache:e:*")
    assert len(results) == 2 and len(vectors) == 2
    for key in results + vectors + client.keys("ragcache:idx:*"):
        assert 0 < client.ttl(key) <= 600


def test_memory_entries_expire():
    now = {"t": 0.0}
    store = make_store("memory", ttl=10, clock=lambda: now["t"])
    c = RetrievalCache(store, clock=lambda: now["t"])
    c.store_result(c.lookup("q", "p", lambda q: [1.0]), {"a": 1}, [1.0])
    now["t"] = 9
    assert c.lookup("q", "p", lambda q: [1.0]).tier == "exact"
    now["t"] = 11
    assert c.lookup("q", "p", lambda q: [1.0]).tier == "miss"


def test_partition_index_is_trimmed(kind):
    c = RetrievalCache(make_store(kind, pmax=2))
    for i in range(4):
        c.store_result(c.lookup(f"q{i}", "p", lambda q: [1.0]), {"i": i}, [1.0])
    assert len(c.store.candidates("p")) == 2


# --- outages ---------------------------------------------------------------------------------

class BrokenRedis:
    def __init__(self):
        self.calls = 0

    def __getattr__(self, name):
        def fail(*a, **kw):
            self.calls += 1
            raise ConnectionError("redis down")
        return fail


def test_an_unreachable_redis_is_bypassed_with_a_breaker(monkeypatch, rag_factory, fake_collection):
    broken = BrokenRedis()
    now = {"t": 100.0}
    c = install(monkeypatch, RedisStore(broken, max_entries=5, ttl_seconds=60, partition_max=4),
                clock=lambda: now["t"])
    rag = rag_factory()
    queries = count_queries(fake_collection)

    for _ in range(5):
        out = rag.retrieve("q", top_k=2, where=WHERE)
        assert len(out["hits"]) == 2 and out["cache"]["tier"] == "off"
    assert queries["n"] == 5
    assert broken.calls == 1, "the breaker must stop further Redis calls"

    now["t"] += cache_module.BREAKER_SECONDS + 1
    rag.retrieve("q", top_k=2, where=WHERE)
    assert broken.calls == 2
    assert c.snapshot()["errors"] == 2


def test_a_failed_invalidation_is_retried_before_the_next_read(kind):
    now = {"t": 0.0}
    store = make_store(kind)
    c = RetrievalCache(store, clock=lambda: now["t"])
    c.store_result(c.lookup("q", f"p{c.generation()}", lambda q: [1.0]), {"a": 1}, [1.0])

    real_bump = store.bump
    store.bump = lambda: (_ for _ in ()).throw(ConnectionError("down"))
    c.invalidate()
    assert c.generation() is None  # breaker open: no reads at all
    store.bump = real_bump
    now["t"] += cache_module.BREAKER_SECONDS + 1
    assert c.generation() == 1, "the missed bump runs before the next read"


def test_a_failing_embedder_still_raises(monkeypatch, kind, rag_factory):
    """The cache must not swallow a real retrieval failure: the route maps it to a 503."""
    install(monkeypatch, make_store(kind), semantic=True)

    class Boom(VecEmbedder):
        def embed(self, texts):
            raise RuntimeError("provider down")

    rag = rag_factory(embedder=Boom())
    with pytest.raises(RuntimeError):
        rag.retrieve("q", top_k=2, where=WHERE)


def test_disabled_cache_touches_nothing(monkeypatch, rag_factory):
    broken = BrokenRedis()
    install(monkeypatch, RedisStore(broken, max_entries=5, ttl_seconds=60, partition_max=4), enabled=False)
    rag = rag_factory()
    assert rag.retrieve("q", top_k=2, where=WHERE)["cache"]["tier"] == "off"
    rag.ingest_documents([{"source": "s", "text": "t", "metadata": {}}])
    assert broken.calls == 0


# --- scope -----------------------------------------------------------------------------------

def test_resume_retrieval_never_uses_the_cache():
    """Résumé chunks are personal data in per-user collections; they must never be written to
    a shared cache. The store has its own retrieval and imports nothing from the cache."""
    import inspect

    from app.resume import store as resume_store

    assert "rag.cache" not in inspect.getsource(resume_store)
    assert "RAGService" not in inspect.getsource(resume_store)


def test_snapshot_reports_hit_rate(kind):
    c = RetrievalCache(make_store(kind))
    c.store_result(c.lookup("q", "p", lambda q: [1.0]), {"a": 1}, [1.0])
    c.lookup("q", "p", lambda q: [1.0])
    snap = c.snapshot()
    assert snap["hitRate"] == 0.5 and snap["entries"] == 1 and snap["exact"] == 1
    json.dumps(snap)
