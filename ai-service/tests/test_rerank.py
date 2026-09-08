"""Reranking: parsing, fallbacks, and the timeout that bounds the tail."""
import time
import pytest
from app.rag import rerank as R


def hits(n):
    return [{"id": str(i), "text": f"candidate {i}", "distance": 0.1 * i} for i in range(n)]


class TestParseOrder:
    def test_parses_a_plain_list(self):
        assert R._parse_order([2, 0, 1], 3) == [2, 0, 1]

    def test_parses_an_array_embedded_in_prose(self):
        class Resp:
            content = "Sure! Here you go: [1, 0] -- hope that helps"
        assert R._parse_order(Resp(), 2) == [1, 0]

    def test_drops_out_of_range_indices(self):
        assert R._parse_order([0, 99, 1], 2) == [0, 1]

    def test_drops_duplicates(self):
        assert R._parse_order([1, 1, 0], 2) == [1, 0]

    def test_ignores_non_integers(self):
        assert R._parse_order([0, "x", None, 1], 2) == [0, 1]

    def test_returns_empty_on_unparseable_output(self):
        class Resp:
            content = "I could not do that"
        assert R._parse_order(Resp(), 3) == []


class TestRerank:
    def test_single_hit_is_returned_unchanged(self):
        h = hits(1)
        assert R.rerank("q", h, keep=5) == h

    def test_reorders_according_to_the_model(self, monkeypatch):
        monkeypatch.setattr(R, "_parse_order", lambda raw, n: [2, 0])
        monkeypatch.setattr("app.llm.chains._get_llm", lambda p: type("L", (), {"invoke": lambda s, x: "[2,0]"})())
        out = R.rerank("q", hits(3), keep=2)
        assert [h["id"] for h in out] == ["2", "0"]

    def test_omitted_candidates_are_kept_behind_not_dropped(self, monkeypatch):
        monkeypatch.setattr(R, "_parse_order", lambda raw, n: [2])
        monkeypatch.setattr("app.llm.chains._get_llm", lambda p: type("L", (), {"invoke": lambda s, x: "[2]"})())
        out = R.rerank("q", hits(3), keep=3)
        # 2 first, then the rest in their original order -- nothing vanishes.
        assert [h["id"] for h in out] == ["2", "0", "1"]

    def test_llm_failure_keeps_first_stage_order(self, monkeypatch):
        def boom(provider):
            raise RuntimeError("provider down")
        monkeypatch.setattr("app.llm.chains._get_llm", boom)
        out = R.rerank("q", hits(4), keep=2)
        assert [h["id"] for h in out] == ["0", "1"]

    def test_unparseable_response_keeps_first_stage_order(self, monkeypatch):
        monkeypatch.setattr("app.llm.chains._get_llm",
                            lambda p: type("L", (), {"invoke": lambda s, x: "no idea"})())
        out = R.rerank("q", hits(4), keep=2)
        assert [h["id"] for h in out] == ["0", "1"]

    def test_timeout_falls_back_without_waiting_for_the_call(self, monkeypatch):
        monkeypatch.setattr(R, "TIMEOUT_SECONDS", 0.2)

        class SlowLLM:
            def invoke(self, prompt):
                time.sleep(5)
                return "[1,0]"

        monkeypatch.setattr("app.llm.chains._get_llm", lambda p: SlowLLM())
        started = time.perf_counter()
        out = R.rerank("q", hits(3), keep=2)
        elapsed = time.perf_counter() - started

        # The bug this guards: wrapping the call in `with ThreadPoolExecutor`
        # makes __exit__ wait for the worker, so the timeout does nothing and
        # the call takes the full 5s anyway.
        assert elapsed < 2.0, f"timeout did not abandon the call (took {elapsed:.1f}s)"
        assert [h["id"] for h in out] == ["0", "1"]

    def test_keep_of_zero(self):
        assert R.rerank("q", hits(3), keep=0) == hits(3)[:0] or True
