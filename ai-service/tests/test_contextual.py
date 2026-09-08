"""Contextual retrieval, with the LLM faked out."""
import pytest
from app.core import config
from app.rag import contextual


@pytest.fixture
def enabled(monkeypatch):
    monkeypatch.setattr(config, "CONTEXTUAL_RETRIEVAL", True)


def test_disabled_returns_chunks_untouched(monkeypatch):
    monkeypatch.setattr(config, "CONTEXTUAL_RETRIEVAL", False)
    chunks = ["one", "two"]
    assert contextual.contextualise("doc", chunks) == chunks


def test_prepends_the_summary_to_each_chunk(enabled, monkeypatch):
    monkeypatch.setattr(contextual, "_summarise", lambda doc, chunk: "SITUATED")
    out = contextual.contextualise("doc", ["alpha", "beta"])
    assert out == ["SITUATED\n\nalpha", "SITUATED\n\nbeta"]


def test_preserves_chunk_order_despite_concurrency(enabled, monkeypatch):
    # Summaries complete out of order; the mapping back to chunks must hold.
    monkeypatch.setattr(contextual, "_summarise", lambda doc, chunk: f"ctx:{chunk}")
    chunks = [f"chunk{i}" for i in range(25)]
    out = contextual.contextualise("doc", chunks)
    for i, text in enumerate(out):
        assert text == f"ctx:chunk{i}\n\nchunk{i}"


def test_a_failed_summary_degrades_to_the_bare_chunk(enabled, monkeypatch):
    monkeypatch.setattr(contextual, "_summarise", lambda doc, chunk: None)
    assert contextual.contextualise("doc", ["alpha"]) == ["alpha"]


def test_one_failure_does_not_lose_other_chunks(enabled, monkeypatch):
    def flaky(doc, chunk):
        if chunk == "bad":
            raise RuntimeError("llm down")
        return "ok"

    monkeypatch.setattr(contextual, "_summarise", flaky)
    out = contextual.contextualise("doc", ["good", "bad", "alsogood"])
    assert out[0].startswith("ok\n\n")
    assert out[1] == "bad"
    assert out[2].startswith("ok\n\n")


def test_empty_chunk_list(enabled):
    assert contextual.contextualise("doc", []) == []


def test_summary_is_length_capped(enabled, monkeypatch):
    monkeypatch.setattr(contextual, "_summarise", lambda d, c: "x" * 500)
    # _summarise itself caps; here we assert contextualise does not explode on
    # a long summary and still keeps the chunk intact.
    out = contextual.contextualise("doc", ["alpha"])
    assert out[0].endswith("\n\nalpha")


def test_document_is_truncated_before_being_sent(monkeypatch):
    captured = {}

    class FakeLLM:
        def invoke(self, prompt):
            captured["prompt"] = prompt
            class R:
                content = "a situating sentence"
            return R()

    monkeypatch.setattr("app.llm.chains._get_llm", lambda provider: FakeLLM())
    monkeypatch.setattr(contextual, "MAX_DOC_CHARS", 100)
    contextual._summarise("D" * 5000, "chunk text")
    assert captured["prompt"].count("D") <= 100


def test_summary_whitespace_is_normalised(monkeypatch):
    class FakeLLM:
        def invoke(self, prompt):
            class R:
                content = "  a  situating\n\nsentence  "
            return R()

    monkeypatch.setattr("app.llm.chains._get_llm", lambda provider: FakeLLM())
    assert contextual._summarise("doc", "chunk") == "a situating sentence"


def test_llm_failure_returns_none_rather_than_raising(monkeypatch):
    def boom(provider):
        raise RuntimeError("no provider")

    monkeypatch.setattr("app.llm.chains._get_llm", boom)
    assert contextual._summarise("doc", "chunk") is None
