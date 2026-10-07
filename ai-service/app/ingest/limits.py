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

Two backends with the same checks, order and messages:

  FetchLimiter       -- in-process counters. Single process only; the default when
                        REDIS_URL is unset (and in unit tests).
  RedisFetchLimiter  -- shared by every worker and instance (closes F-19, D-063). Check and
                        reserve run as one Lua script, so two requests can't both pass a
                        limit with one slot left. In-flight slots are leases that expire, so
                        a crashed worker can't hold one forever. If Redis is unreachable the
                        fetch is denied: live fetching is optional, and the question falls
                        back to local context.
"""
from __future__ import annotations

import logging
import os
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, Optional, Tuple

log = logging.getLogger(__name__)


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
# Longest a live fetch can hold a concurrency slot before it is presumed dead.
LEASE_SECONDS = _int_env("LIVE_FETCH_LEASE_SECONDS", 300)


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
    ) -> Optional[str]:
        """Reserve a slot, or raise LimitExceeded. Returns the token to release with."""
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
        return None

    def release(self, token: Optional[str] = None) -> None:
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


_ACQUIRE = """
-- KEYS: inflight, global, session, user, query
-- ARGV: now, lease, concurrency_max, global_max, session_max, user_max,
--       cooldown, day_ttl, token, reserve (1 = reserve, 0 = check only)
local now = tonumber(ARGV[1])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[3]) then return 'concurrency' end
if tonumber(redis.call('GET', KEYS[2]) or '0') >= tonumber(ARGV[4]) then return 'global' end
if KEYS[3] ~= '' and tonumber(redis.call('GET', KEYS[3]) or '0') >= tonumber(ARGV[5]) then return 'session' end
if KEYS[4] ~= '' and tonumber(redis.call('GET', KEYS[4]) or '0') >= tonumber(ARGV[6]) then return 'user' end
if KEYS[5] ~= '' and redis.call('EXISTS', KEYS[5]) == 1 then return 'cooldown' end
if ARGV[10] == '0' then return 'ok' end
redis.call('ZADD', KEYS[1], now + tonumber(ARGV[2]), ARGV[9])
for i = 2, 4 do
  if KEYS[i] ~= '' then
    redis.call('INCR', KEYS[i])
    redis.call('EXPIRE', KEYS[i], tonumber(ARGV[8]))
  end
end
if KEYS[5] ~= '' and tonumber(ARGV[7]) > 0 then redis.call('SET', KEYS[5], '1', 'EX', tonumber(ARGV[7])) end
return 'ok'
"""

_REASONS = {
    "concurrency": lambda: f"concurrency limit of {CONCURRENCY_MAX} reached",
    "global": lambda: f"global daily limit of {GLOBAL_DAILY_MAX} reached",
    "session": lambda: f"session limit of {SESSION_MAX} reached",
    "user": lambda: f"user daily limit of {USER_DAILY_MAX} reached",
    "cooldown": lambda: "query is in cooldown after a recent live fetch",
}

UNAVAILABLE = "live fetch limiter unavailable"


class RedisFetchLimiter:
    """The FetchLimiter contract, with the counters in Redis (see the module docstring)."""

    PREFIX = "lf"

    def __init__(self, client: Any) -> None:
        self._r = client
        self._script = client.register_script(_ACQUIRE)

    @staticmethod
    def _today() -> str:
        return time.strftime("%Y-%m-%d", time.gmtime())

    def _keys(self, user_id, session_id, query_key) -> list:
        day = self._today()
        p = self.PREFIX
        return [
            f"{p}:inflight",
            f"{p}:{day}:global",
            f"{p}:{day}:session:{session_id}" if session_id else "",
            f"{p}:{day}:user:{user_id}" if user_id else "",
            f"{p}:cooldown:{query_key}" if query_key else "",
        ]

    def _run(self, reserve: bool, token: str, user_id, session_id, query_key) -> str:
        result = self._script(
            keys=self._keys(user_id, session_id, query_key),
            args=[
                time.time(),
                LEASE_SECONDS,
                CONCURRENCY_MAX,
                GLOBAL_DAILY_MAX,
                SESSION_MAX,
                USER_DAILY_MAX,
                QUERY_COOLDOWN_SECONDS,
                2 * 86_400,
                token,
                1 if reserve else 0,
            ],
        )
        return result.decode() if isinstance(result, bytes) else str(result)

    def check(
        self,
        *,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        query_key: Optional[str] = None,
    ) -> Tuple[bool, Optional[str]]:
        try:
            verdict = self._run(False, "", user_id, session_id, query_key)
        except Exception as exc:
            log.warning("live fetch limiter unavailable: %s", exc)
            return False, UNAVAILABLE
        return (True, None) if verdict == "ok" else (False, _REASONS[verdict]())

    def acquire(
        self,
        *,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        query_key: Optional[str] = None,
    ) -> Optional[str]:
        token = uuid.uuid4().hex
        try:
            verdict = self._run(True, token, user_id, session_id, query_key)
        except Exception as exc:
            log.warning("live fetch limiter unavailable: %s", exc)
            raise LimitExceeded(UNAVAILABLE, 0)
        if verdict != "ok":
            raise LimitExceeded(_REASONS[verdict](), GLOBAL_DAILY_MAX)
        return token

    def release(self, token: Optional[str] = None) -> None:
        if not token:
            return
        try:
            self._r.zrem(f"{self.PREFIX}:inflight", token)
        except Exception as exc:
            # The lease expires on its own after LEASE_SECONDS.
            log.warning("could not release live fetch lease: %s", exc)

    def snapshot(self) -> Dict[str, object]:
        day = self._today()
        try:
            self._r.zremrangebyscore(f"{self.PREFIX}:inflight", "-inf", time.time())
            in_flight = self._r.zcard(f"{self.PREFIX}:inflight")
            global_used = int(self._r.get(f"{self.PREFIX}:{day}:global") or 0)
        except Exception:
            in_flight, global_used = None, None
        return {
            "backend": "redis",
            "day": day,
            "global_used": global_used,
            "global_max": GLOBAL_DAILY_MAX,
            "in_flight": in_flight,
            "concurrency_max": CONCURRENCY_MAX,
            "session_max": SESSION_MAX,
            "user_daily_max": USER_DAILY_MAX,
            "cooldown_seconds": QUERY_COOLDOWN_SECONDS,
        }


def _build_limiter():
    url = os.getenv("REDIS_URL", "").strip()
    if not url:
        return FetchLimiter()
    import redis

    # Short timeouts: a hung Redis must deny the fetch quickly, not stall the question.
    return RedisFetchLimiter(redis.Redis.from_url(url, socket_timeout=2, socket_connect_timeout=2))


limiter = _build_limiter()
