"""Per-user resume isolation and deletion.

This is the file that gates Phase 5. The failure mode it guards against is one
candidate's resume surfacing in another candidate's interview -- a data breach,
not a wrong answer -- so the tests are written to *attempt* the leak rather than
to confirm the happy path.

The store defends in three independent layers (physical namespace, metadata
filter, egress check). Each is tested separately, because a test that only
exercises all three together cannot tell you that two of them have quietly
stopped working.
"""
import pytest

from app.resume import store as store_mod
from app.resume.store import (
    NAMESPACE_PREFIX,
    ResumeIsolationError,
    ResumeStore,
    is_resume_namespace,
    namespace_for,
)
from tests.fake_chroma import CountingEmbedder, FailingEmbedder, install

USER_A = "11111111-1111-4111-8111-111111111111"
USER_B = "22222222-2222-4222-8222-222222222222"

RESUME_A = {
    "experience": "Staff Engineer at Northwind Freight. Rebuilt the shipment tracking "
                  "pipeline on Apache Kafka, cutting latency from 40s to under 2s.",
    "projects": "Loomweave, a distributed job scheduler in Rust with a Raft control plane.",
    "skills": "Rust, Go, Kafka, PostgreSQL, Kubernetes",
}
RESUME_B = {
    "experience": "Senior iOS Engineer at Tidewater Health. Shipped a HIPAA-compliant "
                  "patient messaging app in Swift used by 90,000 clinicians.",
    "projects": "Harborlight, on-device speech transcription built on CoreML.",
    "skills": "Swift, Objective-C, SwiftUI, CoreML, Metal",
}


@pytest.fixture
def fake(monkeypatch):
    return install(monkeypatch)


@pytest.fixture
def store(fake):
    return ResumeStore(embedder=CountingEmbedder())


@pytest.fixture
def two_users(store):
    store.ingest(USER_A, resume_id="resume-a", text="", sections=RESUME_A)
    store.ingest(USER_B, resume_id="resume-b", text="", sections=RESUME_B)
    return store


@pytest.fixture(autouse=True)
def reset_violation_counter():
    store_mod.ISOLATION_VIOLATIONS = 0
    yield


# --- namespacing ------------------------------------------------------------


def test_namespace_is_derived_from_the_user_and_is_stable():
    assert namespace_for(USER_A) == namespace_for(USER_A)
    assert namespace_for(USER_A) != namespace_for(USER_B)
    assert is_resume_namespace(namespace_for(USER_A))


def test_namespace_does_not_leak_the_raw_user_id():
    """Collection names are visible in admin tooling; the user id should not be."""
    namespace = namespace_for(USER_A)
    assert USER_A not in namespace
    assert namespace.startswith(NAMESPACE_PREFIX)


def test_namespace_is_a_legal_chroma_collection_name():
    # Chroma: 3-63 chars, alphanumeric at both ends, [a-zA-Z0-9._-] within.
    namespace = namespace_for(USER_A)
    assert 3 <= len(namespace) <= 63
    assert namespace[0].isalnum() and namespace[-1].isalnum()
    assert all(c.isalnum() or c in "._-" for c in namespace)


@pytest.mark.parametrize("bad", ["", "   ", None])
def test_the_store_refuses_to_operate_without_a_user(bad):
    """There must be no API through which an unscoped operation is expressible."""
    with pytest.raises(ResumeIsolationError):
        namespace_for(bad)


# --- layer 1: physical separation -------------------------------------------


def test_each_user_gets_their_own_collection(two_users, fake):
    assert sorted(fake.names()) == sorted([namespace_for(USER_A), namespace_for(USER_B)])


def test_every_stored_chunk_belongs_to_exactly_one_user(two_users, fake):
    for row in fake.all_rows():
        owner = row["metadata"]["user_id"]
        assert row["collection"] == namespace_for(owner)


# --- layer 2 + 3: neither user can retrieve the other's chunks --------------


def test_user_a_cannot_retrieve_user_b_content(two_users):
    hits = two_users.retrieve(USER_A, "iOS Swift CoreML patient messaging", top_k=10)
    assert hits, "user A should still get their own chunks back"
    for hit in hits:
        assert hit["metadata"]["user_id"] == USER_A
    blob = " ".join(h["text"] for h in hits)
    for leaked in ("Swift", "CoreML", "Tidewater", "Harborlight", "clinicians"):
        assert leaked not in blob


def test_user_b_cannot_retrieve_user_a_content(two_users):
    """Run in both directions -- a one-sided leak is still a leak."""
    hits = two_users.retrieve(USER_B, "Kafka Rust distributed scheduler Raft", top_k=10)
    assert hits
    for hit in hits:
        assert hit["metadata"]["user_id"] == USER_B
    blob = " ".join(h["text"] for h in hits)
    for leaked in ("Kafka", "Rust", "Loomweave", "Northwind", "Raft"):
        assert leaked not in blob


def test_a_user_with_no_resume_retrieves_nothing_rather_than_someone_elses(two_users):
    assert two_users.retrieve("33333333-3333-4333-8333-333333333333", "Kafka") == []


def test_retrieval_always_carries_the_owning_user_filter(two_users, fake, monkeypatch):
    """Layer 2 must be present even though layer 1 already separates the data."""
    seen = {}
    collection = fake.get_or_create(namespace_for(USER_A))
    original = collection.query

    def spy(**kwargs):
        seen.update(kwargs)
        return original(**kwargs)

    monkeypatch.setattr(collection, "query", spy)
    two_users.retrieve(USER_A, "Kafka", top_k=3)
    assert seen["where"] == {"user_id": {"$eq": USER_A}}


# --- layer 3 on its own: the egress check ----------------------------------


def test_a_foreign_chunk_planted_in_a_namespace_is_dropped_and_counted(two_users, fake):
    """Simulate layers 1 and 2 both failing.

    If a bug ever put another user's chunk into this namespace *and* it passed
    the filter, the egress check is the last thing standing. It must drop the
    chunk, not return it -- failing closed -- and make the event visible.
    """
    collection = fake.get_or_create(namespace_for(USER_A))
    collection.rows["planted"] = {
        "id": "planted",
        "document": "Swift CoreML on-device transcription, Tidewater Health",
        "embedding": [1.0, 2.0, 3.0],
        # Deliberately mislabelled so the `where` filter lets it through.
        "metadata": {"user_id": USER_B, "section": "projects"},
    }

    # Bypass the filter entirely, the way a broken query would.
    original = collection.query
    collection.query = lambda **kw: original(**{**kw, "where": None})

    hits = two_users.retrieve(USER_A, "anything", top_k=10)

    assert all(h["metadata"]["user_id"] == USER_A for h in hits)
    assert "planted" not in [h["id"] for h in hits]
    assert store_mod.ISOLATION_VIOLATIONS == 1


def test_no_isolation_violations_occur_on_the_normal_path(two_users):
    two_users.retrieve(USER_A, "Kafka pipeline", top_k=5)
    two_users.retrieve(USER_B, "Swift app", top_k=5)
    assert store_mod.ISOLATION_VIOLATIONS == 0


# --- deletion ---------------------------------------------------------------


def test_deletion_purges_every_vector_verified_by_direct_query(two_users, fake):
    """Verify by reading the store directly, not by trusting the return value."""
    assert any(r["metadata"]["user_id"] == USER_A for r in fake.all_rows())

    result = two_users.purge(USER_A)

    assert result["deletedChunks"] > 0
    assert result["namespaceDropped"] is True
    # Direct query across the entire fake store: nothing of A's may survive.
    assert not any(r["metadata"]["user_id"] == USER_A for r in fake.all_rows())
    assert two_users.retrieve(USER_A, "Kafka Loomweave Rust", top_k=10) == []
    assert two_users.stats(USER_A).chunk_count == 0


def test_deletion_drops_the_namespace_not_just_the_rows(two_users, fake):
    """An empty collection still naming the user is not what deletion means."""
    two_users.purge(USER_A)
    assert namespace_for(USER_A) not in fake.names()


def test_deleting_one_user_leaves_the_other_untouched(two_users, fake):
    before = two_users.stats(USER_B).chunk_count
    two_users.purge(USER_A)
    assert two_users.stats(USER_B).chunk_count == before
    assert two_users.retrieve(USER_B, "Swift CoreML", top_k=5)


def test_reading_a_user_with_no_resume_does_not_create_a_namespace(store, fake):
    """Found by the end-to-end run.

    `get_or_create_collection` on a read path meant that merely asking whether a
    user had a resume materialised an empty collection named after them.
    """
    store.stats("55555555-5555-4555-8555-555555555555")
    store.retrieve("55555555-5555-4555-8555-555555555555", "anything")
    assert fake.names() == []


def test_verifying_a_deletion_does_not_resurrect_the_namespace(two_users, fake):
    """The DELETE endpoint reads back to prove the purge worked.

    With a creating read path that read-back re-created the collection it had
    just dropped, so the namespace survived the deletion that reported success.
    """
    two_users.purge(USER_A)
    two_users.stats(USER_A)          # what the API does to verify
    two_users.retrieve(USER_A, "Kafka")
    assert namespace_for(USER_A) not in fake.names()


def test_deleting_a_user_with_no_resume_is_a_no_op_not_an_error(store):
    result = store.purge("44444444-4444-4444-8444-444444444444")
    assert result["deletedChunks"] == 0


def test_deletion_is_idempotent(two_users):
    two_users.purge(USER_A)
    again = two_users.purge(USER_A)
    assert again["deletedChunks"] == 0


# --- re-upload replaces rather than accumulates -----------------------------


def test_reingesting_replaces_the_previous_resume(store, fake):
    store.ingest(USER_A, resume_id="resume-a", text="", sections=RESUME_A)
    store.ingest(USER_A, resume_id="resume-a2", text="", sections={
        "experience": "Completely different role at a different company entirely.",
    })

    texts = " ".join(r["document"] for r in fake.all_rows())
    assert "Loomweave" not in texts, "stale chunks would ground questions in an old resume"
    assert "Completely different role" in texts


def test_chunks_are_labelled_with_their_resume_section(store, fake):
    store.ingest(USER_A, resume_id="resume-a", text="", sections=RESUME_A)
    sections = {r["metadata"]["section"] for r in fake.all_rows()}
    assert {"experience", "projects", "skills"} <= sections


def test_stats_reports_only_the_requesting_users_chunks(two_users):
    a = two_users.stats(USER_A)
    b = two_users.stats(USER_B)
    assert a.chunk_count > 0 and b.chunk_count > 0
    assert a.namespace != b.namespace


# --- failure modes ----------------------------------------------------------


def test_an_embedding_failure_raises_rather_than_storing_a_partial_resume(fake):
    store = ResumeStore(embedder=FailingEmbedder())
    with pytest.raises(RuntimeError):
        store.ingest(USER_A, resume_id="resume-a", text="", sections=RESUME_A)
    assert not fake.all_rows()


def test_a_failed_re_upload_leaves_the_previous_resume_intact(fake):
    """Found by the end-to-end run, not by unit tests.

    Re-uploading is a replace, and the first implementation purged before
    embedding -- so a provider outage midway through a re-upload destroyed the
    resume the user already had. Embedding now happens first, so the namespace is
    only replaced once there is something to replace it with.
    """
    good = ResumeStore(embedder=CountingEmbedder())
    good.ingest(USER_A, resume_id="resume-a", text="", sections=RESUME_A)
    before = good.stats(USER_A).chunk_count
    assert before > 0

    broken = ResumeStore(embedder=FailingEmbedder())
    with pytest.raises(RuntimeError):
        broken.ingest(USER_A, resume_id="resume-a2", text="", sections={"experience": "new role"})

    assert good.stats(USER_A).chunk_count == before
    texts = " ".join(r["document"] for r in fake.all_rows())
    assert "Loomweave" in texts


def test_ingesting_empty_sections_stores_nothing(store, fake):
    stats = store.ingest(USER_A, resume_id="r", text="", sections={"experience": "   "})
    assert stats.chunk_count == 0
    assert not fake.all_rows()


def test_retrieval_survives_a_chroma_outage_by_returning_nothing(store, monkeypatch):
    """Losing the resume must degrade the interview, never fail it."""
    monkeypatch.setattr(
        "app.resume.store.get_named_collection",
        lambda name: (_ for _ in ()).throw(RuntimeError("chroma is down")),
    )
    assert store.retrieve(USER_A, "Kafka", top_k=5) == []
