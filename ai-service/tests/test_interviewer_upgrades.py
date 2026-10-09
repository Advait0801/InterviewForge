"""Interviewer upgrades (D-066): personas, the hint ladder, the grounded challenge.

No model is called: chains are rendered with a fake model, and the endpoints run with
`invoke_with_fallback` replaced.
"""
import hashlib

import pytest

pytest.importorskip("fastapi.testclient")

from fastapi.testclient import TestClient
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app.llm import chains

PAYLOAD = {
    "company": "amazon", "company_style": "S", "stage": "coding", "difficulty": "medium",
    "difficulty_calibration": "C", "context": "CTX", "resume_context": "R", "question": "Q",
    "answer": "A", "evaluation": "{}",
}

# sha256 of each prompt as rendered *before* personas existed (taken on main at c4edcc1).
# The retrieval eval and every recorded judgement were measured against these, so the
# neutral persona must render them byte for byte.
PINNED = {
    "structured_question_chain": "8a2ee8b7e8fe2e295614801f0f087776d40ddf5ee900089901dbcce08e3d9353",
    "resume_grounded_question_chain": "8752acab298aa0b3b944e2c5253a2a0aa20a179009715ac93d24b5b44132d72c",
    "structured_followup_chain": "6ea412e608ae4e75461ad6970cc674d51ae119d441aceb7110941fdf6a4797ee",
    "structured_evaluation_chain": "9f2bb47f76e4149757607824e2fe8474d3c699aa71db22fb41096a21fdeb82d7",
}


def _render(name, monkeypatch, **extra):
    monkeypatch.setattr(chains, "_get_llm", lambda provider=None: FakeListChatModel(responses=["{}"]))
    prompt = getattr(chains, name)(None).first
    values = {k: v for k, v in PAYLOAD.items() if k in prompt.input_variables}
    return prompt.format_messages(**values, **extra)


def _digest(messages):
    return hashlib.sha256("\n---\n".join(f"{m.type}: {m.content}" for m in messages).encode()).hexdigest()


@pytest.mark.parametrize("name", list(PINNED))
def test_neutral_renders_the_prompts_exactly_as_before(name, monkeypatch):
    assert _digest(_render(name, monkeypatch)) == PINNED[name]
    if name != "structured_evaluation_chain":
        for persona in ("neutral", None):
            styled = _render(name, monkeypatch, persona_instructions=chains.persona_instructions(persona))
            assert _digest(styled) == PINNED[name]


INTERVIEWER_CHAINS = [
    "structured_question_chain", "resume_grounded_question_chain", "structured_followup_chain",
    "hint_chain", "challenge_chain",
]


@pytest.mark.parametrize("persona", ["friendly", "terse", "adversarial"])
@pytest.mark.parametrize("name", INTERVIEWER_CHAINS[:3])
def test_a_persona_leads_the_system_message(name, persona, monkeypatch):
    plain = _render(name, monkeypatch)
    styled = _render(name, monkeypatch, persona_instructions=chains.persona_instructions(persona))
    assert len(styled) == len(plain)
    assert styled[0].content == chains.PERSONAS[persona] + "\n\n" + plain[0].content
    assert styled[1:] == plain[1:]
    assert "technical bar exactly the same" in styled[0].content


@pytest.mark.parametrize("persona", ["neutral", "friendly", "terse", "adversarial"])
@pytest.mark.parametrize("name", INTERVIEWER_CHAINS)
def test_exactly_one_system_message_and_it_comes_first(name, persona, monkeypatch):
    """Gemini's client raises on any system message after the first. The first live eval
    run hit exactly that; a fake model doesn't care, so this pins the shape instead."""
    extra = {"level": 1, "level_description": "d", "previous_hints": "None.", "draft": "x"}
    monkeypatch.setattr(chains, "_get_llm", lambda provider=None: FakeListChatModel(responses=["{}"]))
    prompt = getattr(chains, name)(None).first
    values = {k: v for k, v in {**PAYLOAD, **extra}.items() if k in prompt.input_variables}
    messages = prompt.format_messages(**values, persona_instructions=chains.persona_instructions(persona))
    assert [m.type for m in messages].count("system") == 1
    assert messages[0].type == "system"


def test_grading_has_no_persona_slot(monkeypatch):
    """Tone must never move a score."""
    monkeypatch.setattr(chains, "_get_llm", lambda provider=None: FakeListChatModel(responses=["{}"]))
    evaluation = chains.structured_evaluation_chain(None).first
    assert "persona_instructions" not in evaluation.input_variables
    assert "persona_instructions" not in evaluation.partial_variables


# --- endpoints ----------------------------------------------------------------


@pytest.fixture
def interview(monkeypatch):
    import app.api.interview as interview

    calls = []

    async def fake_invoke(chain, payload, **kwargs):
        calls.append((chain.__name__, payload))
        if chain.__name__ == "challenge_verify_chain":
            return interview._verdict
        return interview._fake_result

    interview._fake_result = {}
    interview._verdict = {"false_by_evidence": True, "reason": "the passage says they refill"}
    monkeypatch.setattr(interview, "invoke_with_fallback", fake_invoke)
    monkeypatch.setattr(interview, "_get_rag_service", lambda: object())
    monkeypatch.setattr(interview, "_get_resume_store", lambda: None)
    monkeypatch.setattr(
        interview,
        "retrieve_with_live_fallback",
        lambda **kw: {"hits": [], "confidence": None, "live": {"triggered": False, "reason": "x"}},
    )
    interview._calls = calls
    return interview


@pytest.fixture
def client(interview):
    from app.main import app

    return TestClient(app)


def test_persona_reaches_question_generation_but_not_retrieval(client, interview, monkeypatch):
    seen = {}
    monkeypatch.setattr(
        interview,
        "retrieve_with_live_fallback",
        lambda **kw: seen.update(kw) or {"hits": [], "confidence": None, "live": None},
    )
    interview._fake_result = {"question": "q", "reasoningFocus": "r", "expectedCompetencies": []}

    r = client.post("/api/interview/next-question", json={"company": "amazon", "stage": "coding", "persona": "terse"})

    assert r.status_code == 200
    assert interview._calls[0][1]["persona_instructions"] == chains.PERSONAS["terse"] + "\n\n"
    assert "persona" not in seen


def test_an_unknown_persona_is_rejected(client):
    r = client.post("/api/interview/next-question", json={"company": "amazon", "stage": "coding", "persona": "rude"})
    assert r.status_code == 422


HINT = {"company": "google", "stage": "coding", "question": "Two sum?", "context": "ctx", "level": 2}


def test_hint_sends_the_rung_and_numbers_earlier_hints(client, interview):
    interview._fake_result = {"hint": "  Use a hash map.  "}

    r = client.post("/api/interview/hint", json={**HINT, "previous_hints": ["Think about lookups."], "persona": "friendly"})

    assert r.json() == {"hint": "Use a hash map.", "level": 2}
    name, payload = interview._calls[0]
    assert name == "hint_chain"
    assert payload["level_description"] == chains.HINT_LEVELS[2]
    assert payload["previous_hints"] == "1. Think about lookups."
    assert payload["draft"] == "Nothing written yet."
    assert payload["persona_instructions"] == chains.PERSONAS["friendly"] + "\n\n"


@pytest.mark.parametrize("level", [0, 4])
def test_hint_level_is_one_to_three(client, level):
    assert client.post("/api/interview/hint", json={**HINT, "level": level}).status_code == 422


def test_an_empty_hint_is_an_outage_not_a_blank_message(client, interview):
    interview._fake_result = {"hint": "   "}
    assert client.post("/api/interview/hint", json=HINT).status_code == 503


CONTEXT = "Token buckets refill at a fixed rate. Leaky buckets drain at a constant rate."
ANSWER = "I'd use a token bucket. Token buckets never refill, so bursts are capped forever."
CHALLENGE = {"company": "amazon", "stage": "system_design", "question": "Rate limiter?", "answer": ANSWER, "context": CONTEXT}


def _model_says(interview, **fields):
    interview._fake_result = {
        "contradicts": True,
        "claim": "Token buckets never refill",
        "evidence": "Token buckets refill at a fixed rate.",
        "challenge": "The reference says they refill at a fixed rate. Can you reconcile that?",
        "reason": "direct contradiction",
        **fields,
    }


def test_a_contradiction_quoted_verbatim_on_both_sides_is_a_challenge(client, interview):
    _model_says(interview)
    body = client.post("/api/interview/challenge", json=CHALLENGE).json()
    assert body["challenged"] is True
    assert body["claim"] == "Token buckets never refill"
    assert body["question"].startswith("The reference says")


def test_the_second_look_sees_only_the_two_quotes(client, interview):
    _model_says(interview)
    client.post("/api/interview/challenge", json=CHALLENGE)
    name, payload = interview._calls[1]
    assert name == "challenge_verify_chain"
    assert payload == {"claim": "Token buckets never refill", "evidence": "Token buckets refill at a fixed rate."}


@pytest.mark.parametrize("verdict", [{"false_by_evidence": False, "reason": "a different choice"}, {"false_by_evidence": "yes"}, []])
def test_a_contradiction_the_second_look_does_not_confirm_is_not_a_challenge(client, interview, verdict):
    _model_says(interview)
    interview._verdict = verdict
    body = client.post("/api/interview/challenge", json=CHALLENGE).json()
    assert body["challenged"] is False
    assert body["reason"].startswith("not confirmed")


def test_quotes_survive_case_whitespace_curly_quotes_and_trimmed_punctuation(client, interview):
    _model_says(interview, claim="token  buckets NEVER refill,", evidence="“Token buckets refill at a fixed rate”")
    assert client.post("/api/interview/challenge", json=CHALLENGE).json()["challenged"] is True


@pytest.mark.parametrize(
    "fields, reason",
    [
        ({"claim": "Token buckets always refill twice"}, "claim not found in the answer"),
        ({"evidence": "Token buckets are deprecated."}, "evidence not found in the context"),
        ({"claim": "never"}, "claim not found in the answer"),  # too short to mean anything
        ({"challenge": "  "}, "no challenge question"),
        ({"contradicts": False}, "direct contradiction"),
        ({"contradicts": "true"}, "direct contradiction"),  # only a real boolean counts
    ],
)
def test_anything_unverifiable_is_not_a_challenge(client, interview, fields, reason):
    """Pushing back on a correct answer is the failure that matters; when in doubt, don't."""
    _model_says(interview, **fields)
    body = client.post("/api/interview/challenge", json=CHALLENGE).json()
    assert body["challenged"] is False
    assert body["reason"] == reason
    assert body["claim"] == body["evidence"] == body["question"] == ""


def test_no_context_means_no_challenge_and_no_model_call(client, interview):
    body = client.post("/api/interview/challenge", json={**CHALLENGE, "context": "  "}).json()
    assert body["challenged"] is False
    assert interview._calls == []
