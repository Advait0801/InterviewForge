"""The streaming question endpoints (D-065).

The provider is always faked: `astream_with_fallback` is replaced by an async generator
that yields the partial objects LangChain's JSON parser would. The disconnect and
backpressure tests drive the real ASGI app (middleware included) with hand-written
`receive`/`send`, because TestClient can neither drop a connection nor stop reading.
"""
import asyncio
import json

import pytest

pytest.importorskip("fastapi.testclient")

from fastapi.testclient import TestClient

QUESTION = 'Tell me about "a time" you scaled a system.'
REQUEST = {"company": "amazon", "stage": "behavioral", "difficulty": "medium"}
FOLLOWUP_REQUEST = {
    "company": "meta",
    "stage": "coding",
    "question": "q",
    "answer": "a",
    "evaluation": {"score": 5},
}


def _partials(question=QUESTION, extra=None):
    """The growing objects the JSON parser yields while the model writes."""
    out = [{}]
    for i in range(1, len(question) + 1, 7):
        out.append({"question": question[:i]})
    full = {"question": question, "reasoningFocus": "scale", "expectedCompetencies": ["design"]}
    full.update(extra or {})
    out.append(full)
    return out


def _parse(body: str):
    events = []
    for block in body.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.split("\n"))
        data = json.loads(lines["data"])
        assert lines["event"] == data["type"]
        events.append(data)
    return events


class FakeStream:
    """Records how far the consumer pulled and whether the stream was closed early."""

    def __init__(self, partials, fail_at=None, error=None, gate=None):
        self.partials = partials
        self.fail_at = fail_at
        self.error = error or RuntimeError("503 upstream")
        self.gate = gate
        self.pulled = 0
        self.closed_early = False

    async def __call__(self, chain, payload, **kwargs):
        try:
            for index, partial in enumerate(self.partials):
                if self.fail_at == index:
                    raise self.error
                if self.gate is not None and index > 1:  # after the first delta
                    await self.gate.wait()
                self.pulled += 1
                yield partial
                await asyncio.sleep(0)
        except (GeneratorExit, asyncio.CancelledError):
            self.closed_early = True
            raise


RETRIEVED = {
    "hits": [{"text": "ctx", "metadata": {"company": "amazon"}, "distance": 0.3}],
    "confidence": {"confident": True, "reason": "ok", "top_distance": 0.3, "good_hits": 1, "company_matched": True},
    "live": {"triggered": False, "reason": "not attempted"},
}


@pytest.fixture
def interview(monkeypatch):
    import app.api.interview as interview

    monkeypatch.setattr(interview, "_get_rag_service", lambda: object())
    monkeypatch.setattr(interview, "_get_resume_store", lambda: None)
    monkeypatch.setattr(interview, "retrieve_with_live_fallback", lambda **kw: RETRIEVED)
    return interview


@pytest.fixture
def client(interview):
    from app.main import app

    return TestClient(app)


def test_question_text_arrives_as_deltas_then_done(client, interview, monkeypatch):
    monkeypatch.setattr(interview, "astream_with_fallback", FakeStream(_partials()))

    response = client.post("/api/interview/next-question/stream", json=REQUEST)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers["x-accel-buffering"] == "no"
    events = _parse(response.text)
    deltas = [e for e in events if e["type"] == "delta"]
    assert len(deltas) > 3, "the question should arrive in pieces, not at once"
    assert "".join(d["text"] for d in deltas) == QUESTION
    assert events[-1]["type"] == "done"
    assert [e["type"] for e in events].count("done") == 1


def test_done_carries_exactly_the_json_endpoints_body(client, interview, monkeypatch):
    """The backend records `done.result` the way it records the JSON response."""

    async def fake_invoke(chain, payload, **kwargs):
        return _partials()[-1]

    monkeypatch.setattr(interview, "invoke_with_fallback", fake_invoke)
    monkeypatch.setattr(interview, "astream_with_fallback", FakeStream(_partials()))

    plain = client.post("/api/interview/next-question", json=REQUEST).json()
    streamed = _parse(client.post("/api/interview/next-question/stream", json=REQUEST).text)[-1]

    assert streamed["result"] == plain
    from app.api.schemas import NextQuestionResponse

    NextQuestionResponse.model_validate(streamed["result"])


def test_a_provider_failing_before_any_token_is_a_real_http_status(client, interview, monkeypatch):
    """Not a 200 with an error event: the backend maps it like the JSON endpoint's."""
    monkeypatch.setattr(
        interview,
        "astream_with_fallback",
        FakeStream(_partials(), fail_at=0, error=RuntimeError("429 quota exceeded")),
    )
    response = client.post("/api/interview/next-question/stream", json=REQUEST)
    assert response.status_code == 429
    assert "rate limited" in response.json()["detail"]

    monkeypatch.setattr(interview, "astream_with_fallback", FakeStream(_partials(), fail_at=0))
    assert client.post("/api/interview/next-question/stream", json=REQUEST).status_code == 503


def test_bad_company_and_retrieval_outage_fail_before_the_stream(client, interview, monkeypatch):
    fake = FakeStream(_partials())
    monkeypatch.setattr(interview, "astream_with_fallback", fake)
    assert client.post("/api/interview/next-question/stream", json={**REQUEST, "company": "acme"}).status_code == 400

    def chroma_down(**kw):
        raise ConnectionError("chroma refused")

    monkeypatch.setattr(interview, "retrieve_with_live_fallback", chroma_down)
    assert client.post("/api/interview/next-question/stream", json=REQUEST).status_code == 503
    assert fake.pulled == 0, "no model call when retrieval failed"


def test_a_failure_mid_stream_ends_with_an_error_event(client, interview, monkeypatch):
    partials = _partials()
    monkeypatch.setattr(interview, "astream_with_fallback", FakeStream(partials, fail_at=len(partials) // 2))

    events = _parse(client.post("/api/interview/next-question/stream", json=REQUEST).text)

    assert events[-1] == {
        "type": "error",
        "status": 503,
        "detail": "LLM unavailable: 503 upstream",
        "usage": {"calls": 0, "costUsd": 0.0},  # what was spent before failing (D-067)
    }
    assert not any(e["type"] == "done" for e in events)


def test_truncated_output_is_an_error_not_a_done(client, interview, monkeypatch):
    """A stream that stops mid-object would otherwise hand the backend a partial question."""
    monkeypatch.setattr(interview, "astream_with_fallback", FakeStream(_partials()[:-1]))

    events = _parse(client.post("/api/interview/next-question/stream", json=REQUEST).text)

    assert events[-1]["type"] == "error"
    assert events[-1]["status"] == 503


def test_text_that_would_rewrite_what_was_sent_is_skipped(client, interview, monkeypatch):
    """Sent text can't be taken back; `done` stays authoritative."""
    partials = [{"question": "Tell me ab"}, {"question": "Tell me a\\"}, {"question": "Tell me abc"}]
    partials.append({"question": "Tell me abc", "reasoningFocus": "x", "expectedCompetencies": []})
    monkeypatch.setattr(interview, "astream_with_fallback", FakeStream(partials))

    events = _parse(client.post("/api/interview/next-question/stream", json=REQUEST).text)

    assert [e["text"] for e in events if e["type"] == "delta"] == ["Tell me ab", "c"]
    assert events[-1]["result"]["question"] == "Tell me abc"


def test_followup_streams_with_the_same_contract(client, interview, monkeypatch):
    partials = _partials("Why that index?")
    partials[-1] = {"question": "Why that index?", "focus": "indexes", "reason": "vague"}
    monkeypatch.setattr(interview, "astream_with_fallback", FakeStream(partials))

    events = _parse(client.post("/api/interview/generate-followup/stream", json=FOLLOWUP_REQUEST).text)

    assert "".join(e["text"] for e in events if e["type"] == "delta") == "Why that index?"
    assert events[-1]["type"] == "done" and events[-1]["result"] == partials[-1]
    assert events[-1]["usage"] == {"calls": 0, "costUsd": 0.0}  # the fake stream records nothing


# --- the real ASGI stack: disconnect and backpressure ------------------------


async def _drive(app, path, body, *, on_body):
    """Call the ASGI app directly. `on_body(chunk, state)` may set `state['disconnect']`
    or return an awaitable to block `send` (a client that has stopped reading)."""
    state = {"disconnect": asyncio.Event(), "status": None, "chunks": []}
    sent_request = False

    async def receive():
        nonlocal sent_request
        if not sent_request:
            sent_request = True
            return {"type": "http.request", "body": json.dumps(body).encode(), "more_body": False}
        await state["disconnect"].wait()
        return {"type": "http.disconnect"}

    async def send(message):
        if message["type"] == "http.response.start":
            state["status"] = message["status"]
        elif message["type"] == "http.response.body" and message.get("body"):
            state["chunks"].append(message["body"])
            waiter = on_body(message["body"], state)
            if waiter is not None:
                await waiter

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "root_path": "",
        "headers": [(b"content-type", b"application/json"), (b"host", b"test")],
        "client": ("127.0.0.1", 1),
        "server": ("test", 80),
    }
    await asyncio.wait_for(app(scope, receive, send), timeout=5)
    return state


def test_a_client_disconnect_cancels_the_provider_stream(interview, monkeypatch):
    """Through the real middleware stack: leaving mid-question stops generation."""
    from app.main import app

    gate = asyncio.Event()  # the provider never produces past the first partials
    fake = FakeStream(_partials(), gate=gate)
    monkeypatch.setattr(interview, "astream_with_fallback", fake)

    def on_body(chunk, state):
        state["disconnect"].set()  # the client leaves after the first event

    state = asyncio.run(_drive(app, "/api/interview/next-question/stream", REQUEST, on_body=on_body))

    assert state["status"] == 200
    assert fake.closed_early, "the provider stream must be closed when the client leaves"
    assert fake.pulled < len(fake.partials)
    assert not any(b"event: done" in c for c in state["chunks"])


def test_a_client_that_stops_reading_stops_the_provider(interview, monkeypatch):
    """Backpressure: while `send` is blocked, no further partials are pulled."""
    from app.main import app

    fake = FakeStream(_partials())
    monkeypatch.setattr(interview, "astream_with_fallback", fake)
    observed = {}

    async def stall(state):
        await asyncio.sleep(0.2)  # plenty of time for an eager producer to run ahead
        observed["pulled_while_stalled"] = fake.pulled

    def on_body(chunk, state):
        if b"event: delta" in chunk and "pulled_while_stalled" not in observed:
            return stall(state)
        return None

    state = asyncio.run(_drive(app, "/api/interview/next-question/stream", REQUEST, on_body=on_body))

    # The first delta comes from the second partial; the producer may be one ahead.
    assert observed["pulled_while_stalled"] <= 3
    assert any(b"event: done" in c for c in state["chunks"]), "the stream resumes once read"


# --- astream_with_fallback ----------------------------------------------------


class _Chain:
    def __init__(self, partials, fail_at=None, error="429 quota exceeded"):
        self.partials, self.fail_at, self.error = partials, fail_at, error

    async def astream(self, payload):
        for index, partial in enumerate(self.partials):
            if self.fail_at == index:
                raise RuntimeError(self.error)
            yield partial


@pytest.fixture
def providers(monkeypatch):
    from app.core import config, observability
    from app.llm import chains

    monkeypatch.setattr(config, "GEMINI_API_KEY", "g")
    monkeypatch.setattr(config, "OPENAI_API_KEY", "o")
    monkeypatch.setattr(config, "LLM_PROVIDER_ORDER", ["gemini", "openai"])
    monkeypatch.setattr(chains, "_provider_cooldowns", {"gemini": 0.0, "openai": 0.0})
    observability.reset()
    return chains


async def _collect(gen):
    return [p async for p in gen]


def test_stream_falls_back_when_the_first_provider_fails_before_any_output(providers):
    built = []

    def factory(provider):
        built.append(provider)
        return _Chain([{"question": "a"}, {"question": "ab"}], fail_at=0 if provider == "gemini" else None)

    out = asyncio.run(_collect(providers.astream_with_fallback(factory, {"x": "y"})))

    assert built == ["gemini", "openai"]
    assert out[-1] == {"question": "ab"}


def test_stream_never_switches_provider_after_output_was_yielded(providers):
    """Splicing two models' text together would be worse than failing."""
    built = []

    def factory(provider):
        built.append(provider)
        return _Chain([{"question": "a"}, {"question": "ab"}], fail_at=1)

    with pytest.raises(RuntimeError, match="429"):
        asyncio.run(_collect(providers.astream_with_fallback(factory, {"x": "y"})))
    assert built == ["gemini"]


def test_a_cancelled_stream_is_still_recorded_for_cost(providers):
    from app.core import observability

    async def take_one():
        gen = providers.astream_with_fallback(lambda p: _Chain([{"question": "a" * 400}] * 3), {"x": "y"})
        await gen.__anext__()
        await gen.aclose()

    asyncio.run(take_one())

    snap = observability.snapshot()
    assert snap["calls"] == 1
    assert snap["cancelled"] == 1 and snap["failures"] == 0, "a client leaving isn't a provider failure"
    assert snap["outputTokens"] >= 100
