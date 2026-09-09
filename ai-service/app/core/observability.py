"""
Request correlation and LLM cost/latency accounting.

Two things this makes answerable that were not before:
  "which ai-service log lines belong to the interview that just failed?"
  "what does one mock interview actually cost?"

The correlation id arrives from the backend as `x-request-id` and is stored in a
ContextVar, so it is available deep inside a chain without threading it through
every signature.
"""
from __future__ import annotations

import contextvars
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

log = logging.getLogger("observability")

CORRELATION_HEADER = "x-request-id"
_correlation_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "correlation_id", default=None
)


def set_correlation_id(value: Optional[str]) -> None:
    _correlation_id.set(value)


def get_correlation_id() -> Optional[str]:
    return _correlation_id.get()


# USD per 1M tokens. Approximate and provider-published; the point is an
# order-of-magnitude answer to "what does an interview cost", not billing.
PRICING: Dict[str, Dict[str, float]] = {
    "gemini-3.1-flash-lite-preview": {"input": 0.10, "output": 0.40},
    "gemini-3.1-flash-lite": {"input": 0.10, "output": 0.40},
    "gemini-3.5-flash": {"input": 0.30, "output": 2.50},
    "gemini-3.6-flash": {"input": 0.30, "output": 2.50},
    "gemini-3.7-flash": {"input": 0.30, "output": 2.50},
    "gemini-3.8-flash": {"input": 0.30, "output": 2.50},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "text-embedding-3-small": {"input": 0.02, "output": 0.0},
}
DEFAULT_PRICE = {"input": 0.30, "output": 2.50}


def estimate_cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    price = PRICING.get(model, DEFAULT_PRICE)
    return (input_tokens * price["input"] + output_tokens * price["output"]) / 1_000_000


@dataclass
class LLMCall:
    model: str
    provider: str
    chain: str
    duration_ms: float
    input_tokens: int = 0
    output_tokens: int = 0
    ok: bool = True
    error: str = ""

    @property
    def cost_usd(self) -> float:
        return estimate_cost_usd(self.model, self.input_tokens, self.output_tokens)

    def as_log(self) -> Dict[str, Any]:
        return {
            "event": "llm_call",
            "chain": self.chain,
            "provider": self.provider,
            "model": self.model,
            "durationMs": round(self.duration_ms, 1),
            "inputTokens": self.input_tokens,
            "outputTokens": self.output_tokens,
            "costUsd": round(self.cost_usd, 6),
            "ok": self.ok,
            "error": self.error[:200],
            "correlationId": get_correlation_id(),
        }


@dataclass
class Totals:
    calls: int = 0
    failures: int = 0
    duration_ms: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    by_chain: Dict[str, int] = field(default_factory=dict)


_totals = Totals()


def record(call: LLMCall) -> None:
    """Log one call and fold it into the process totals."""
    _totals.calls += 1
    if not call.ok:
        _totals.failures += 1
    _totals.duration_ms += call.duration_ms
    _totals.input_tokens += call.input_tokens
    _totals.output_tokens += call.output_tokens
    _totals.cost_usd += call.cost_usd
    _totals.by_chain[call.chain] = _totals.by_chain.get(call.chain, 0) + 1
    log.info(json.dumps(call.as_log()))


def snapshot() -> Dict[str, Any]:
    """Process-lifetime totals. In-memory: a restart resets them, and a
    multi-instance deployment would need a real metrics backend."""
    calls = _totals.calls or 1
    return {
        "calls": _totals.calls,
        "failures": _totals.failures,
        "meanDurationMs": round(_totals.duration_ms / calls, 1),
        "inputTokens": _totals.input_tokens,
        "outputTokens": _totals.output_tokens,
        "estimatedCostUsd": round(_totals.cost_usd, 6),
        "meanCostPerCallUsd": round(_totals.cost_usd / calls, 6),
        "byChain": dict(_totals.by_chain),
    }


def reset() -> None:
    global _totals
    _totals = Totals()


class timed:
    """Context manager that records an LLM call, success or failure."""

    def __init__(self, chain: str, provider: str, model: str) -> None:
        self.call = LLMCall(model=model, provider=provider, chain=chain, duration_ms=0.0)
        self._start = 0.0

    def __enter__(self) -> LLMCall:
        self._start = time.perf_counter()
        return self.call

    def __exit__(self, exc_type, exc, tb) -> bool:
        self.call.duration_ms = (time.perf_counter() - self._start) * 1000
        if exc is not None:
            self.call.ok = False
            self.call.error = f"{exc_type.__name__}: {exc}"
        record(self.call)
        return False
