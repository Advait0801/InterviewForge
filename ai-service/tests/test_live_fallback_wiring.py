"""The live path must actually be reachable from the API.

Phase 4 built the confidence gate, the live fetch and the write-back, and tested
all three -- but nothing in `app/api/interview.py` ever called them, so the
mechanism was dead in the running system for an entire phase while its unit
tests stayed green (D-038).

Unit tests on `retrieve_with_live_fallback` cannot catch that, because they call
it directly. These tests go through the HTTP endpoint instead, which is the only
level at which "is this feature connected to anything" is a meaningful question.
"""
import pytest

pytest.importorskip("fastapi.testclient")

from fastapi.testclient import TestClient

from app.ingest import confidence as conf


@pytest.fixture
def client(monkeypatch):
    """The interview API with retrieval and the LLM stubbed out."""
    import app.api.interview as interview

    async def fake_invoke(chain, payload, **kwargs):
        return {
            "question": "Describe a system you scaled.",
            "reasoningFocus": "scale",
            "expectedCompetencies": ["design"],
        }

    monkeypatch.setattr(interview, "invoke_with_fallback", fake_invoke)
    monkeypatch.setattr(interview, "_get_rag_service", lambda: object())
    monkeypatch.setattr(interview, "_get_resume_store", lambda: None)

    from app.main import app

    return TestClient(app)


def test_next_question_goes_through_the_live_fallback_path(client, monkeypatch):
    """The endpoint must call the hybrid path, not plain local retrieval."""
    import app.api.interview as interview

    calls = {}

    def fake_live(**kwargs):
        calls.update(kwargs)
        return {
            "hits": [{"text": "ctx", "metadata": {"company": "amazon"}, "distance": 0.3}],
            "confidence": {"confident": True, "reason": "sufficient local grounding"},
            "live": {"triggered": False, "reason": "not attempted"},
        }

    monkeypatch.setattr(interview, "retrieve_with_live_fallback", fake_live)

    response = client.post(
        "/api/interview/next-question",
        json={"company": "amazon", "stage": "behavioral", "difficulty": "medium"},
    )

    assert response.status_code == 200
    assert calls, "next-question did not call retrieve_with_live_fallback at all"
    assert calls["company"] == "amazon"
    assert calls["stage"] == "behavioral"


def test_user_and_session_are_forwarded_so_the_fetch_limiter_can_scope(client, monkeypatch):
    """Without both ids the per-user and per-session fetch caps are unenforceable."""
    import app.api.interview as interview

    calls = {}

    def fake_live(**kwargs):
        calls.update(kwargs)
        return {"hits": [], "confidence": {}, "live": {"triggered": False, "reason": "x"}}

    monkeypatch.setattr(interview, "retrieve_with_live_fallback", fake_live)

    client.post(
        "/api/interview/next-question",
        json={
            "company": "google",
            "stage": "coding",
            "difficulty": "medium",
            "user_id": "user-1",
            "session_id": "session-1",
        },
    )

    assert calls["user_id"] == "user-1"
    assert calls["session_id"] == "session-1"


def test_response_exposes_which_retrieval_path_served_the_question(client, monkeypatch):
    """A read-through cache whose hit/miss is invisible cannot be verified."""
    import app.api.interview as interview

    monkeypatch.setattr(
        interview,
        "retrieve_with_live_fallback",
        lambda **kw: {
            "hits": [{"text": "ctx", "metadata": {}, "distance": 0.3}],
            "confidence": {"confident": False, "reason": "best hit too distant"},
            "live": {"triggered": True, "reason": "ingested 2 page(s)", "chunks_written": 7},
        },
    )

    body = client.post(
        "/api/interview/next-question",
        json={"company": "meta", "stage": "system_design", "difficulty": "medium"},
    ).json()

    assert body["retrievalConfidence"]["confident"] is False
    assert body["liveIngestion"]["triggered"] is True
    assert body["liveIngestion"]["chunks_written"] == 7


# --- the calibrated thresholds themselves -----------------------------------


def test_confidence_thresholds_match_the_calibrated_operating_point():
    """Pin the calibration so a casual edit cannot silently un-tune the gate.

    These are not arbitrary: `python -m app.eval.calibrate_confidence` derives
    them, and at these values every well-covered company/stage pair passes (no
    needless fetch) while every thin one triggers the live path.
    """
    assert conf.MAX_TOP_DISTANCE == pytest.approx(0.78)
    assert conf.MAX_GOOD_DISTANCE == pytest.approx(0.85)
    assert conf.MIN_GOOD_HITS == 1


def test_thresholds_are_on_the_squared_l2_scale_not_cosine():
    """The collection uses Chroma's `l2` space, so distance = 2*(1 - cosine).

    A threshold that made sense on a [0, 2] cosine scale is twice as strict here,
    which is exactly how the gate came to pass only 3 of 40 pairs. If someone
    switches the collection to cosine space, these values must be halved -- this
    test is the marker that says so.
    """
    # A chunk at cosine similarity 0.71 -- clearly relevant -- must pass.
    cosine_similarity = 0.71
    squared_l2 = 2 * (1 - cosine_similarity)
    assert squared_l2 == pytest.approx(0.58, abs=0.01)
    assert squared_l2 <= conf.MAX_TOP_DISTANCE

    verdict = conf.assess(
        [{"text": "t", "metadata": {"company": "amazon"}, "distance": squared_l2}],
        company="amazon",
    )
    assert verdict.confident is True


def test_calibration_scoring_prefers_no_needless_fetch():
    """The sweep's objective function: covered pairs passing is the hard constraint."""
    from app.eval.calibrate_confidence import score

    # Real distances measured against the corpus, not invented: amazon/behavioral
    # and amazon/core_cs are the covered pairs the old thresholds rejected.
    rows = [
        {"company": "amazon", "stage": "behavioral", "seeded": True, "distances": [0.7315, 0.80]},
        {"company": "amazon", "stage": "core_cs", "seeded": True, "distances": [0.7610, 0.83]},
        {"company": "uber", "stage": "coding", "seeded": False, "distances": [0.9097, 0.96]},
        {"company": "adobe", "stage": "system_design", "seeded": False, "distances": [0.9600, 0.99]},
    ]

    covered_pass, covered_total, thin_flagged, thin_total = score(rows, 0.78, 0.85, 1)
    assert (covered_pass, covered_total) == (2, 2)
    assert (thin_flagged, thin_total) == (2, 2)

    # The old, too-strict thresholds reject both well-covered pairs, which is
    # the defect: a needless live fetch on a company the corpus already covers.
    covered_pass, covered_total, _, _ = score(rows, 0.62, 0.75, 2)
    assert covered_pass == 0 and covered_total == 2
