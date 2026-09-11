"""Blending resume context with company context at question time.

Two separate concerns here, and they fail differently:

  * **retrieval** -- pull the right part of the resume for the stage being asked
  * **prompting** -- keep "what this company probes for" and "what this candidate
    did" as distinct blocks, so the model cannot attribute one to the other

The second is the subtle one. A merged context blob reliably produces questions
like "tell me about your work on Amazon's recommendation infrastructure" asked of
a candidate who has never worked there.
"""
import pytest

pytest.importorskip("fastapi.testclient")

from fastapi.testclient import TestClient

from app.interview.orchestrator import (
    RESUME_STAGE_QUERIES,
    build_resume_context,
    build_resume_query,
    resume_evidence,
    retrieve_resume_context,
)

USER = "11111111-1111-4111-8111-111111111111"


class StubStore:
    def __init__(self, hits=None, error=None):
        self.hits = hits or []
        self.error = error
        self.queries = []

    def retrieve(self, user_id, query, *, top_k=4):
        self.queries.append((user_id, query, top_k))
        if self.error:
            raise self.error
        return self.hits


def hit(text, section="projects", distance=0.2):
    return {"text": text, "metadata": {"section": section, "user_id": USER}, "distance": distance}


# --- stage-aware retrieval --------------------------------------------------


@pytest.mark.parametrize("stage", ["behavioral", "coding", "system_design", "core_cs"])
def test_every_interview_stage_has_its_own_resume_query(stage):
    """Retrieving the whole resume for every stage buries the one relevant project."""
    assert stage in RESUME_STAGE_QUERIES
    query = build_resume_query(company="amazon", stage=stage)
    assert RESUME_STAGE_QUERIES[stage].split(",")[0] in query


def test_stage_queries_are_actually_different_from_each_other():
    queries = {build_resume_query(company="amazon", stage=s) for s in RESUME_STAGE_QUERIES}
    assert len(queries) == len(RESUME_STAGE_QUERIES)


def test_an_unknown_stage_falls_back_instead_of_raising():
    assert build_resume_query(company="amazon", stage="pair_programming")


def test_resume_query_is_flavoured_by_the_company_focus_areas():
    amazon = build_resume_query(company="amazon", stage="behavioral")
    google = build_resume_query(company="google", stage="behavioral")
    assert amazon != google


# --- degradation ------------------------------------------------------------


def test_no_user_means_no_resume_lookup_at_all():
    store = StubStore(hits=[hit("x")])
    assert retrieve_resume_context(store=store, user_id=None, company="amazon", stage="coding") == []
    assert store.queries == [], "a missing user must not produce a query at all"


def test_a_store_failure_degrades_to_an_unpersonalised_interview():
    """Losing the resume must never fail the request."""
    store = StubStore(error=RuntimeError("chroma down"))
    assert retrieve_resume_context(store=store, user_id=USER, company="amazon", stage="coding") == []


# --- context rendering ------------------------------------------------------


def test_resume_context_labels_each_chunk_with_its_section():
    text = build_resume_context([hit("Built a Raft scheduler", section="projects")])
    assert "[projects]" in text and "Raft scheduler" in text


def test_empty_resume_context_is_empty_not_a_placeholder():
    """An empty string is what makes the caller choose the non-resume chain."""
    assert build_resume_context([]) == ""


def test_evidence_is_compact_and_carries_provenance():
    ev = resume_evidence([hit("x" * 500, section="experience", distance=0.3)])
    assert ev[0]["section"] == "experience"
    assert ev[0]["distance"] == 0.3
    assert len(ev[0]["excerpt"]) <= 180


# --- the API decision: which chain runs -------------------------------------


@pytest.fixture
def api(monkeypatch):
    import app.api.interview as interview

    captured = {}

    async def fake_invoke(chain_factory, payload, **kwargs):
        captured["chain"] = getattr(chain_factory, "__name__", "unknown")
        captured["payload"] = payload
        return {
            "question": "How did you shard Loomweave?",
            "reasoningFocus": "scale",
            "expectedCompetencies": ["distributed systems"],
            "groundedIn": "Loomweave",
        }

    monkeypatch.setattr(interview, "invoke_with_fallback", fake_invoke)
    monkeypatch.setattr(interview, "_get_rag_service", lambda: object())
    monkeypatch.setattr(
        interview,
        "retrieve_with_live_fallback",
        lambda **kw: {
            "hits": [{"text": "Amazon probes for ownership.", "metadata": {}, "distance": 0.3}],
            "confidence": {"confident": True},
            "live": {"triggered": False},
        },
    )

    from app.main import app

    return TestClient(app), captured, interview


def test_resume_chunks_select_the_grounded_chain(api, monkeypatch):
    client, captured, interview = api
    monkeypatch.setattr(
        interview, "_get_resume_store",
        lambda: StubStore(hits=[hit("Loomweave, a Raft-based job scheduler in Rust.")]),
    )

    body = client.post("/api/interview/next-question", json={
        "company": "amazon", "stage": "system_design", "difficulty": "medium",
        "user_id": USER, "resume_grounded": True,
    }).json()

    assert captured["chain"] == "resume_grounded_question_chain"
    assert "Loomweave" in captured["payload"]["resume_context"]
    assert body["resumeGrounded"] is True
    assert body["resumeHits"] == 1
    assert body["groundedIn"] == "Loomweave"


def test_asking_for_grounding_with_no_resume_falls_back_to_the_normal_chain(api, monkeypatch):
    """Grounding follows the retrieved chunks, not the request flag.

    Otherwise a user with no resume gets a prompt instructed to cite a resume it
    cannot see, and the model invents one.
    """
    client, captured, interview = api
    monkeypatch.setattr(interview, "_get_resume_store", lambda: StubStore(hits=[]))

    body = client.post("/api/interview/next-question", json={
        "company": "amazon", "stage": "coding", "difficulty": "medium",
        "user_id": USER, "resume_grounded": True,
    }).json()

    assert captured["chain"] == "structured_question_chain"
    assert "resume_context" not in captured["payload"]
    assert body["resumeGrounded"] is False


def test_resume_grounding_without_a_user_id_never_touches_the_store(api, monkeypatch):
    """user_id and resume_grounded must travel together or the store is unscoped."""
    client, captured, interview = api
    store = StubStore(hits=[hit("someone else's resume")])
    monkeypatch.setattr(interview, "_get_resume_store", lambda: store)

    body = client.post("/api/interview/next-question", json={
        "company": "amazon", "stage": "coding", "difficulty": "medium",
        "resume_grounded": True,
    }).json()

    assert store.queries == []
    assert body["resumeGrounded"] is False
    assert captured["chain"] == "structured_question_chain"


def test_an_unavailable_resume_store_does_not_fail_the_interview(api, monkeypatch):
    client, captured, interview = api
    monkeypatch.setattr(interview, "_get_resume_store", lambda: None)

    response = client.post("/api/interview/next-question", json={
        "company": "amazon", "stage": "coding", "difficulty": "medium",
        "user_id": USER, "resume_grounded": True,
    })

    assert response.status_code == 200
    assert response.json()["resumeGrounded"] is False


def test_company_and_resume_context_stay_in_separate_prompt_variables(api, monkeypatch):
    """Merged into one blob, the model attributes company material to the candidate."""
    client, captured, interview = api
    monkeypatch.setattr(
        interview, "_get_resume_store",
        lambda: StubStore(hits=[hit("Loomweave, a Raft-based job scheduler.")]),
    )

    client.post("/api/interview/next-question", json={
        "company": "amazon", "stage": "system_design", "difficulty": "medium",
        "user_id": USER, "resume_grounded": True,
    })

    payload = captured["payload"]
    assert "Loomweave" in payload["resume_context"]
    assert "Loomweave" not in payload["context"]
    assert "Amazon probes for ownership." in payload["context"]
    assert "Amazon probes for ownership." not in payload["resume_context"]


def test_the_grounded_prompt_forbids_inventing_experience():
    """The rules that stop the model fabricating experience must be in the prompt.

    Asserted on the prompt text itself, because these are the only thing standing
    between "grounded in your resume" and "confidently invented".
    """
    import inspect

    from app.llm.chains import resume_grounded_question_chain

    source = inspect.getsource(resume_grounded_question_chain)
    assert "Never invent experience" in source
    assert "NOT the candidate" in source, "company context must be marked as not theirs"
    assert "groundedIn" in source, "the citation field is what makes grounding checkable"


def test_the_grounded_output_schema_requires_a_citation():
    from app.llm.chains import ResumeGroundedQuestionOutput

    assert "groundedIn" in ResumeGroundedQuestionOutput.model_fields
