"""The interviewer agent (D-067) and per-request usage metering. No model is called."""
import asyncio
import json

import pytest

pytest.importorskip("fastapi.testclient")

from fastapi.testclient import TestClient

from app.interview import agent

BASE = {"company": "google", "stage": "coding"}


class FakeRag:
    def __init__(self, hits=None):
        self.queries = []
        self.hits = hits if hits is not None else [{"text": "Hash maps give O(1) lookups.", "metadata": {}}]

    def retrieve(self, query, *, top_k, where=None, stage=None):
        self.queries.append({"query": query, "where": where, "stage": stage, "top_k": top_k})
        return {"hits": self.hits}


def scripted(*steps):
    """An `invoke` that returns the given steps in order and records each payload."""
    calls = []

    async def invoke(chain, payload):
        calls.append(payload)
        return steps[min(len(calls), len(steps)) - 1]

    invoke.calls = calls
    return invoke


def run(invoke, rag=None, allowed=("probe", "pivot", "advance")):
    return asyncio.run(
        agent.run_agent(rag=rag or FakeRag(), invoke=invoke, chain=None, payload=dict(BASE), allowed=list(allowed))
    )


def test_search_then_decide_feeds_the_observation_back():
    rag = FakeRag()
    invoke = scripted(
        {"tool": "search_context", "query": "hash map lookups"},
        {"tool": "decide", "action": "probe", "question": "Why is lookup O(1)?", "focus": "hashing", "rationale": "vague"},
    )
    out = run(invoke, rag)
    assert out["action"] == "probe" and out["question"] == "Why is lookup O(1)?" and out["fallback"] is False
    assert "Hash maps give O(1) lookups." in invoke.calls[1]["scratchpad"]
    assert out["context"].startswith("Hash maps")
    assert [t["tool"] for t in out["trace"]] == ["search_context", "decide"]
    # Searches never go through the LLM reranker, and stay within the company's stage.
    assert rag.queries[0]["stage"] is None
    assert rag.queries[0]["where"] == {"$and": [{"company": {"$eq": "google"}}, {"stage": {"$eq": "coding"}}]}


def test_the_loop_is_bounded_and_forces_a_decision():
    invoke = scripted({"tool": "search_context", "query": "more"})  # never decides
    out = run(invoke)
    assert len(invoke.calls) == agent.MAX_STEPS
    assert "You must decide now" in invoke.calls[-1]["scratchpad"]
    assert out["action"] == "fallback" and out["fallback"] is True


def test_searches_are_capped():
    invoke = scripted({"tool": "search_context", "query": "q"})
    rag = FakeRag()
    run(invoke, rag)
    assert len(rag.queries) <= agent.MAX_SEARCHES


@pytest.mark.parametrize(
    "decision, reason",
    [
        ({"action": "finish"}, "finish is not allowed now"),
        ({"action": "skip_stage"}, "unknown action"),
        ({"action": "probe", "question": "  "}, "probe without a question"),
        ({"action": "pivot"}, "pivot without a question"),
    ],
)
def test_anything_not_allowed_or_malformed_is_a_fallback(decision, reason):
    out = run(scripted({"tool": "decide", **decision}))
    assert out["action"] == "fallback" and out["fallback"] is True
    assert reason in out["rationale"]


def test_garbage_output_is_skipped_not_trusted():
    invoke = scripted("not json", {"tool": "dance"}, {"tool": "decide", "action": "advance"})
    out = run(invoke)
    assert out["action"] == "advance" and out["question"] == ""
    assert "got 'dance'" in invoke.calls[2]["scratchpad"]


def test_a_pivot_without_a_search_is_grounded_automatically():
    rag = FakeRag()
    out = run(scripted({"tool": "decide", "action": "pivot", "question": "Design a cache.", "focus": "caching"}), rag)
    assert out["action"] == "pivot" and out["context"].startswith("Hash maps")
    assert rag.queries[0]["query"] == "caching"
    assert out["trace"][-1]["automatic"] is True


def test_advance_drops_any_question_the_model_wrote():
    out = run(scripted({"tool": "decide", "action": "advance", "question": "stray"}))
    assert out["action"] == "advance" and out["question"] == ""


# --- the endpoint -------------------------------------------------------------

REQUEST = {
    "company": "google", "stage": "coding", "stage_position": "2 of 4",
    "allowed_actions": ["probe", "advance"], "questions_left": 1,
    "question": "Two sum?", "answer": "Brute force.", "evaluation": {"score": 4},
    "stage_transcript": [{"role": "assistant", "content": "Two sum?"}], "persona": "terse",
}


@pytest.fixture
def client(monkeypatch):
    import app.api.interview as interview

    monkeypatch.setattr(interview, "_get_rag_service", lambda: FakeRag())

    async def fake_invoke(chain, payload, **kw):
        fake_invoke.payloads.append(payload)
        return {"tool": "decide", "action": "probe", "question": "Can you do better?", "focus": "hashing", "rationale": "slow"}

    fake_invoke.payloads = []
    monkeypatch.setattr(interview, "invoke_with_fallback", fake_invoke)
    from app.main import app

    return TestClient(app), fake_invoke


def test_endpoint_passes_the_allowed_moves_and_persona(client):
    http, invoke = client
    body = http.post("/api/interview/agent/turn", json=REQUEST).json()
    assert body["action"] == "probe"
    payload = invoke.payloads[0]
    assert payload["allowed_actions"] == "probe, advance"
    assert payload["questions_left"] == 1
    assert payload["persona_instructions"].startswith("Persona: terse")
    assert "assistant: Two sum?" in payload["stage_transcript"]


@pytest.mark.parametrize("field, value", [("allowed_actions", []), ("allowed_actions", ["teleport"]), ("questions_left", -1)])
def test_endpoint_rejects_malformed_constraints(client, field, value):
    http, _ = client
    assert http.post("/api/interview/agent/turn", json={**REQUEST, field: value}).status_code == 422


# --- usage metering -------------------------------------------------------------


def test_every_response_reports_the_model_calls_it_made(monkeypatch):
    """The backend charges each interview from this header (D-067)."""
    import app.api.interview as interview
    from app.core import observability

    async def two_calls(chain, payload, **kw):
        for _ in range(2):
            with observability.timed("fake", "gemini", "gemini-3.1-flash-lite-preview") as call:
                call.input_tokens, call.output_tokens = 1000, 100
        return {"hint": "Think about lookups."}

    monkeypatch.setattr(interview, "invoke_with_fallback", two_calls)
    from app.main import app

    response = TestClient(app).post(
        "/api/interview/hint", json={"company": "google", "stage": "coding", "question": "q", "level": 1}
    )
    usage = json.loads(response.headers["x-llm-usage"])
    assert usage["calls"] == 2
    assert usage["costUsd"] == pytest.approx(2 * (1000 * 0.10 + 100 * 0.40) / 1_000_000, abs=1e-6)

    # Per request, not per process: the next request starts from zero.
    plain = TestClient(app).get("/health")
    assert json.loads(plain.headers["x-llm-usage"]) == {"calls": 0, "costUsd": 0.0}
