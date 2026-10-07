"""
The Redis-backed live-fetch limiter (F-19, D-063), against fakeredis with real Lua.
The in-memory backend keeps its own suite in test_ingest_limits.py.
"""
import threading
import time

import fakeredis
import pytest
import redis

from app.ingest import limits as L
from app.ingest.limits import FetchLimiter, LimitExceeded, RedisFetchLimiter


@pytest.fixture
def server():
    return fakeredis.FakeServer()


@pytest.fixture
def lim(server):
    return RedisFetchLimiter(fakeredis.FakeRedis(server=server))


@pytest.fixture(params=["memory", "redis"])
def any_lim(request, server):
    return FetchLimiter() if request.param == "memory" else RedisFetchLimiter(fakeredis.FakeRedis(server=server))


# Same contract, both backends.

def test_session_limit(any_lim, monkeypatch):
    monkeypatch.setattr(L, "SESSION_MAX", 2)
    for _ in range(2):
        any_lim.release(any_lim.acquire(session_id="s1"))
    allowed, reason = any_lim.check(session_id="s1")
    assert not allowed and reason == "session limit of 2 reached"
    assert any_lim.check(session_id="s2")[0]


def test_user_and_global_limits(any_lim, monkeypatch):
    monkeypatch.setattr(L, "USER_DAILY_MAX", 1)
    monkeypatch.setattr(L, "GLOBAL_DAILY_MAX", 2)
    any_lim.release(any_lim.acquire(user_id="u1"))
    assert any_lim.check(user_id="u1") == (False, "user daily limit of 1 reached")
    any_lim.release(any_lim.acquire(user_id="u2"))
    assert any_lim.check(user_id="u3") == (False, "global daily limit of 2 reached")


def test_concurrency_limit_and_release(any_lim, monkeypatch):
    monkeypatch.setattr(L, "CONCURRENCY_MAX", 2)
    a = any_lim.acquire(user_id="a")
    any_lim.acquire(user_id="b")
    assert any_lim.check(user_id="c") == (False, "concurrency limit of 2 reached")
    any_lim.release(a)
    assert any_lim.check(user_id="c")[0]


def test_query_cooldown(any_lim):
    any_lim.release(any_lim.acquire(query_key="q1"))
    assert any_lim.check(query_key="q1") == (False, "query is in cooldown after a recent live fetch")
    assert any_lim.check(query_key="q2")[0]


def test_blocked_acquire_consumes_nothing(any_lim, monkeypatch):
    monkeypatch.setattr(L, "GLOBAL_DAILY_MAX", 1)
    any_lim.release(any_lim.acquire(user_id="u1"))
    with pytest.raises(LimitExceeded):
        any_lim.acquire(user_id="u2")
    assert any_lim.snapshot()["global_used"] == 1


# Redis only.

def test_two_instances_share_one_budget(server, monkeypatch):
    """The point of F-19: limits hold across workers and instances, not per process."""
    monkeypatch.setattr(L, "GLOBAL_DAILY_MAX", 3)
    a = RedisFetchLimiter(fakeredis.FakeRedis(server=server))
    b = RedisFetchLimiter(fakeredis.FakeRedis(server=server))
    a.release(a.acquire(user_id="u1"))
    b.release(b.acquire(user_id="u2"))
    a.release(a.acquire(user_id="u3"))
    with pytest.raises(LimitExceeded):
        b.acquire(user_id="u4")


def test_check_and_reserve_are_atomic(server, monkeypatch):
    """Twenty threads race for the last slot; exactly one gets it."""
    monkeypatch.setattr(L, "GLOBAL_DAILY_MAX", 1)
    monkeypatch.setattr(L, "CONCURRENCY_MAX", 50)
    wins, start = [], threading.Barrier(20)

    def race(i):
        own = RedisFetchLimiter(fakeredis.FakeRedis(server=server))
        start.wait()
        try:
            own.acquire(user_id=f"u{i}")
            wins.append(i)
        except LimitExceeded:
            pass

    threads = [threading.Thread(target=race, args=(i,)) for i in range(20)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert len(wins) == 1


def test_a_leaked_lease_expires(lim, monkeypatch):
    monkeypatch.setattr(L, "CONCURRENCY_MAX", 1)
    monkeypatch.setattr(L, "LEASE_SECONDS", 0.2)
    lim.acquire(user_id="crashed-before-release")
    assert not lim.check(user_id="next")[0]
    time.sleep(0.3)
    assert lim.check(user_id="next")[0]


def test_release_frees_only_its_own_lease(lim, monkeypatch):
    monkeypatch.setattr(L, "CONCURRENCY_MAX", 2)
    a = lim.acquire(user_id="a")
    lim.acquire(user_id="b")
    lim.release("not-a-real-token")
    assert not lim.check(user_id="c")[0]
    lim.release(a)
    assert lim.check(user_id="c")[0]


def test_day_rollover(lim, monkeypatch):
    monkeypatch.setattr(L, "GLOBAL_DAILY_MAX", 1)
    lim.release(lim.acquire(user_id="u1"))
    assert not lim.check(user_id="u1")[0]
    monkeypatch.setattr(RedisFetchLimiter, "_today", staticmethod(lambda: "2099-01-01"))
    assert lim.check(user_id="u1")[0]


class _DownRedis:
    def register_script(self, _):
        def run(**_):
            raise redis.exceptions.ConnectionError("Connection refused")
        return run

    def zrem(self, *_):
        raise redis.exceptions.ConnectionError("Connection refused")


def test_redis_down_denies_the_fetch_instead_of_raising():
    lim = RedisFetchLimiter(_DownRedis())
    assert lim.check(user_id="u") == (False, L.UNAVAILABLE)
    with pytest.raises(LimitExceeded, match="unavailable"):
        lim.acquire(user_id="u")
    lim.release("token")  # must not raise either


def test_backend_follows_redis_url(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    assert isinstance(L._build_limiter(), FetchLimiter)
    monkeypatch.setenv("REDIS_URL", "redis://localhost:1")
    assert isinstance(L._build_limiter(), RedisFetchLimiter)
