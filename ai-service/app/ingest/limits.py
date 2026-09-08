"""
Layered spend and growth limits for live ingestion.

These protect different things and therefore have different numbers:

  global daily   -- bounds how fast unvetted content enters the corpus. This is
                    the real constraint: every live fetch writes to Chroma
                    permanently, and bad content degrades retrieval forever.
  per session    -- stops one interview spiralling into a crawl. If more than a
                    handful of questions need live grounding, that company is
                    genuinely uncovered and the answer is a batch run, not
                    fetching while the candidate waits.
  per user daily -- abuse control, not cost control, so it can be generous.
                    Because of write-back the first user to ask a thin question
                    does work that benefits everyone; punishing them is wrong.
  concurrency    -- stops a thundering herd when a new company is cold.

In-memory counters. Single-process only; a multi-instance deployment needs Redis
(recorded as a known limitation rather than pretended away).
"""
from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass, field
from typing import Dict, Optional, Tuple


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


GLOBAL_DAILY_MAX = _int_env("LIVE_FETCH_GLOBAL_DAILY_MAX", 200)
SESSION_MAX = _int_env("LIVE_FETCH_SESSION_MAX", 5)
USER_DAILY_MAX = _int_env("LIVE_FETCH_USER_DAILY_MAX", 25)
CONCURRENCY_MAX = _int_env("LIVE_FETCH_CONCURRENCY_MAX", 3)
QUERY_COOLDOWN_SECONDS = _int_env("LIVE_FETCH_QUERY_COOLDOWN_SECONDS", 86_400)


class LimitExceeded(Exception):
    def __init__(self, scope: str, limit: int):
        super().__init__(f"live fetch blocked: {scope} limit of {limit} reached")
        self.scope = scope
        self.limit = limit


@dataclass
class _Counters:
    day: str = ""
    global_count: int = 0
    per_user: Dict[str, int] = field(default_factory=dict)
    per_session: Dict[str, int] = field(default_factory=dict)
    query_seen_at: Dict[str, float] = field(default_factory=dict)
    in_flight: int = 0


class FetchLimiter:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._c = _Counters()

    @staticmethod
    def _today() -> str:
        return time.strftime("%Y-%m-%d", time.gmtime())

    def _roll_day(self) -> None:
        today = self._today()
        if self._c.day != today:
            self._c.day = today
            self._c.global_count = 0
            self._c.per_user.clear()
            self._c.per_session.clear()
            # Query cooldowns deliberately survive the day roll; they are keyed
            # on their own TTL, not the calendar.

    def check(
        self,
        *,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        query_key: Optional[str] = None,
    ) -> Tuple[bool, Optional[str]]:
        """Non-mutating: may this fetch proceed? Returns (allowed, reason)."""
        with self._lock:
            self._roll_day()
            if self._c.in_flight >= CONCURRENCY_MAX:
                return False, f"concurrency limit of {CONCURRENCY_MAX} reached"
            if self._c.global_count >= GLOBAL_DAILY_MAX:
                return False, f"global daily limit of {GLOBAL_DAILY_MAX} reached"
            if session_id and self._c.per_session.get(session_id, 0) >= SESSION_MAX:
                return False, f"session limit of {SESSION_MAX} reached"
            if user_id and self._c.per_user.get(user_id, 0) >= USER_DAILY_MAX:
                return False, f"user daily limit of {USER_DAILY_MAX} reached"
            if query_key:
                last = self._c.query_seen_at.get(query_key)
                if last is not None and (time.time() - last) < QUERY_COOLDOWN_SECONDS:
                    return False, "query is in cooldown after a recent live fetch"
            return True, None

    def acquire(
        self,
        *,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        query_key: Optional[str] = None,
    ) -> None:
        """Reserve a slot, or raise LimitExceeded."""
        allowed, reason = self.check(user_id=user_id, session_id=session_id, query_key=query_key)
        if not allowed:
            raise LimitExceeded(reason or "limit", GLOBAL_DAILY_MAX)
        with self._lock:
            self._c.in_flight += 1
            self._c.global_count += 1
            if user_id:
                self._c.per_user[user_id] = self._c.per_user.get(user_id, 0) + 1
            if session_id:
                self._c.per_session[session_id] = self._c.per_session.get(session_id, 0) + 1
            if query_key:
                self._c.query_seen_at[query_key] = time.time()

    def release(self) -> None:
        with self._lock:
            self._c.in_flight = max(0, self._c.in_flight - 1)

    def snapshot(self) -> Dict[str, object]:
        with self._lock:
            self._roll_day()
            return {
                "day": self._c.day,
                "global_used": self._c.global_count,
                "global_max": GLOBAL_DAILY_MAX,
                "in_flight": self._c.in_flight,
                "concurrency_max": CONCURRENCY_MAX,
                "session_max": SESSION_MAX,
                "user_daily_max": USER_DAILY_MAX,
                "cooldown_seconds": QUERY_COOLDOWN_SECONDS,
                "users_tracked": len(self._c.per_user),
                "sessions_tracked": len(self._c.per_session),
            }

    def reset(self) -> None:
        with self._lock:
            self._c = _Counters()


limiter = FetchLimiter()
