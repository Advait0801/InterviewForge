"""
Speech transcription error paths. The OpenAI client is faked: no test reaches a provider.
"""
import asyncio
import base64

import httpx
import openai
import pytest
from fastapi.testclient import TestClient

from app.api import speech
from app.main import app

AUDIO = base64.b64encode(b"\x1aE\xdf\xa3 fake webm bytes").decode()


def _status_error(cls, status):
    request = httpx.Request("POST", "https://api.openai.com/v1/audio/transcriptions")
    return cls("provider said no", response=httpx.Response(status, request=request), body=None)


class FakeTranscriptions:
    def __init__(self, outcome):
        self.outcome = outcome
        self.calls = []

    def create(self, model, file, language=None):
        try:
            asyncio.get_running_loop()
            on_event_loop = True
        except RuntimeError:
            on_event_loop = False
        self.calls.append({"file": file, "on_event_loop": on_event_loop})
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return type("Resp", (), {"text": self.outcome})()


@pytest.fixture
def fake_openai(monkeypatch):
    monkeypatch.setattr(speech.config, "OPENAI_API_KEY", "test-key")
    holder = {}

    def install(outcome):
        transcriptions = FakeTranscriptions(outcome)

        class FakeClient:
            def __init__(self, api_key):
                self.audio = type("Audio", (), {"transcriptions": transcriptions})()

        monkeypatch.setattr(openai, "OpenAI", FakeClient)
        holder["t"] = transcriptions
        return transcriptions

    return install


@pytest.fixture
def client():
    return TestClient(app)


def test_transcribes_off_the_event_loop(client, fake_openai):
    t = fake_openai("hello there")
    r = client.post("/api/speech/transcribe", json={"audioBase64": AUDIO})
    assert r.status_code == 200
    assert r.json() == {"transcript": "hello there"}
    assert t.calls[0]["on_event_loop"] is False


def test_a_rejected_recording_is_422_not_an_outage(client, fake_openai):
    fake_openai(_status_error(openai.BadRequestError, 400))
    r = client.post("/api/speech/transcribe", json={"audioBase64": AUDIO})
    assert r.status_code == 422
    assert r.json()["detail"] == speech.UNREADABLE_RECORDING


def test_provider_rate_limit_is_429(client, fake_openai):
    fake_openai(_status_error(openai.RateLimitError, 429))
    r = client.post("/api/speech/transcribe", json={"audioBase64": AUDIO})
    assert r.status_code == 429


def test_provider_outage_stays_503(client, fake_openai):
    fake_openai(_status_error(openai.InternalServerError, 500))
    r = client.post("/api/speech/transcribe", json={"audioBase64": AUDIO})
    assert r.status_code == 503


def test_silence_is_422(client, fake_openai):
    fake_openai("   ")
    r = client.post("/api/speech/transcribe", json={"audioBase64": AUDIO})
    assert r.status_code == 422


@pytest.mark.parametrize(
    "mime, expected",
    [
        ("audio/webm;codecs=opus", ("recording.webm", "audio/webm")),
        ("audio/mp4", ("recording.mp4", "audio/mp4")),
        ("audio/ogg;codecs=opus", ("recording.ogg", "audio/ogg")),
    ],
)
def test_upload_name_follows_the_real_mime_type(client, fake_openai, mime, expected):
    t = fake_openai("ok")
    r = client.post("/api/speech/transcribe", json={"audioBase64": AUDIO, "mimeType": mime})
    assert r.status_code == 200
    filename, _, sent_mime = t.calls[0]["file"]
    assert (filename, sent_mime) == expected


def test_non_audio_mime_is_400_before_any_provider_call(client, fake_openai):
    t = fake_openai("ok")
    r = client.post("/api/speech/transcribe", json={"audioBase64": AUDIO, "mimeType": "text/html"})
    assert r.status_code == 400
    assert t.calls == []


def test_oversized_audio_is_413_before_any_provider_call(client, fake_openai, monkeypatch):
    monkeypatch.setattr(speech, "MAX_AUDIO_BYTES", 4)
    t = fake_openai("ok")
    r = client.post("/api/speech/transcribe", json={"audioBase64": AUDIO})
    assert r.status_code == 413
    assert t.calls == []


def test_evaluate_explanation_shares_the_422_mapping(client, fake_openai):
    fake_openai(_status_error(openai.BadRequestError, 400))
    r = client.post("/api/speech/evaluate-explanation", json={"audioBase64": AUDIO, "question": "Why?"})
    assert r.status_code == 422
