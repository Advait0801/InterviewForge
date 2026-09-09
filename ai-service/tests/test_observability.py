"""Cost accounting and correlation context."""
import pytest
from app.core import observability as obs


@pytest.fixture(autouse=True)
def clean():
    obs.reset()
    obs.set_correlation_id(None)
    yield
    obs.reset()


class TestCorrelationId:
    def test_round_trips(self):
        obs.set_correlation_id("abc-123")
        assert obs.get_correlation_id() == "abc-123"

    def test_defaults_to_none(self):
        assert obs.get_correlation_id() is None

    def test_appears_in_the_log_payload(self):
        obs.set_correlation_id("req-7")
        call = obs.LLMCall(model="m", provider="p", chain="c", duration_ms=1.0)
        assert call.as_log()["correlationId"] == "req-7"


class TestCostEstimation:
    def test_known_model_uses_its_own_pricing(self):
        cost = obs.estimate_cost_usd("gpt-4o-mini", 1_000_000, 0)
        assert cost == pytest.approx(0.15)

    def test_output_tokens_priced_separately(self):
        cost = obs.estimate_cost_usd("gpt-4o-mini", 0, 1_000_000)
        assert cost == pytest.approx(0.60)

    def test_unknown_model_falls_back_rather_than_reporting_zero(self):
        # Silently pricing an unknown model at 0 would make cost tracking lie.
        assert obs.estimate_cost_usd("some-future-model", 1_000_000, 0) > 0

    def test_zero_tokens_costs_nothing(self):
        assert obs.estimate_cost_usd("gpt-4o-mini", 0, 0) == 0.0


class TestTotals:
    def test_starts_empty(self):
        snap = obs.snapshot()
        assert snap["calls"] == 0 and snap["estimatedCostUsd"] == 0.0

    def test_accumulates_across_calls(self):
        for _ in range(3):
            obs.record(obs.LLMCall(model="gpt-4o-mini", provider="openai",
                                   chain="x", duration_ms=100.0,
                                   input_tokens=1000, output_tokens=100))
        snap = obs.snapshot()
        assert snap["calls"] == 3
        assert snap["inputTokens"] == 3000
        assert snap["estimatedCostUsd"] > 0

    def test_attributes_cost_per_chain(self):
        obs.record(obs.LLMCall(model="m", provider="p", chain="rerank", duration_ms=1.0))
        obs.record(obs.LLMCall(model="m", provider="p", chain="rerank", duration_ms=1.0))
        obs.record(obs.LLMCall(model="m", provider="p", chain="report", duration_ms=1.0))
        assert obs.snapshot()["byChain"] == {"rerank": 2, "report": 1}

    def test_counts_failures_separately(self):
        obs.record(obs.LLMCall(model="m", provider="p", chain="x", duration_ms=1.0, ok=False))
        snap = obs.snapshot()
        assert snap["calls"] == 1 and snap["failures"] == 1

    def test_reset_clears_everything(self):
        obs.record(obs.LLMCall(model="m", provider="p", chain="x", duration_ms=1.0))
        obs.reset()
        assert obs.snapshot()["calls"] == 0


class TestTimed:
    def test_records_a_successful_call(self):
        with obs.timed("chain", "gemini", "model-x") as call:
            call.input_tokens = 10
        snap = obs.snapshot()
        assert snap["calls"] == 1 and snap["failures"] == 0

    def test_records_a_failure_and_re_raises(self):
        with pytest.raises(ValueError):
            with obs.timed("chain", "gemini", "model-x"):
                raise ValueError("boom")
        snap = obs.snapshot()
        assert snap["calls"] == 1 and snap["failures"] == 1

    def test_measures_a_nonzero_duration(self):
        import time
        with obs.timed("chain", "p", "m"):
            time.sleep(0.01)
        assert obs.snapshot()["meanDurationMs"] >= 10
