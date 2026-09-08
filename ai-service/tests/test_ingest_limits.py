import time
import pytest
from app.ingest import limits as L
from app.ingest.limits import FetchLimiter, LimitExceeded


@pytest.fixture
def lim():
    return FetchLimiter()


def test_first_fetch_is_allowed(lim):
    allowed, reason = lim.check(user_id="u1", session_id="s1")
    assert allowed and reason is None


def test_session_limit_blocks_after_max(lim, monkeypatch):
    monkeypatch.setattr(L, "SESSION_MAX", 2)
    for _ in range(2):
        lim.acquire(session_id="s1"); lim.release()
    allowed, reason = lim.check(session_id="s1")
    assert not allowed and "session limit" in reason


def test_session_limit_is_per_session(lim, monkeypatch):
    monkeypatch.setattr(L, "SESSION_MAX", 1)
    lim.acquire(session_id="s1"); lim.release()
    assert not lim.check(session_id="s1")[0]
    # A different session is unaffected.
    assert lim.check(session_id="s2")[0]


def test_user_daily_limit_blocks(lim, monkeypatch):
    monkeypatch.setattr(L, "USER_DAILY_MAX", 2)
    for _ in range(2):
        lim.acquire(user_id="u1"); lim.release()
    allowed, reason = lim.check(user_id="u1")
    assert not allowed and "user daily limit" in reason


def test_one_user_exhausting_quota_does_not_affect_another(lim, monkeypatch):
    monkeypatch.setattr(L, "USER_DAILY_MAX", 1)
    lim.acquire(user_id="u1"); lim.release()
    assert not lim.check(user_id="u1")[0]
    assert lim.check(user_id="u2")[0]


def test_global_limit_blocks_everyone(lim, monkeypatch):
    monkeypatch.setattr(L, "GLOBAL_DAILY_MAX", 2)
    lim.acquire(user_id="u1"); lim.release()
    lim.acquire(user_id="u2"); lim.release()
    allowed, reason = lim.check(user_id="u3")
    assert not allowed and "global daily limit" in reason


def test_concurrency_limit_blocks_while_in_flight(lim, monkeypatch):
    monkeypatch.setattr(L, "CONCURRENCY_MAX", 2)
    lim.acquire(user_id="a")
    lim.acquire(user_id="b")
    allowed, reason = lim.check(user_id="c")
    assert not allowed and "concurrency" in reason
    lim.release()
    assert lim.check(user_id="c")[0]


def test_release_never_goes_negative(lim):
    lim.release(); lim.release()
    assert lim.snapshot()["in_flight"] == 0


def test_query_cooldown_blocks_a_repeat(lim):
    lim.acquire(query_key="q1"); lim.release()
    allowed, reason = lim.check(query_key="q1")
    assert not allowed and "cooldown" in reason


def test_query_cooldown_is_per_query(lim):
    lim.acquire(query_key="q1"); lim.release()
    assert lim.check(query_key="q2")[0]


def test_cooldown_expires(lim, monkeypatch):
    monkeypatch.setattr(L, "QUERY_COOLDOWN_SECONDS", 0)
    lim.acquire(query_key="q1"); lim.release()
    time.sleep(0.01)
    assert lim.check(query_key="q1")[0]


def test_acquire_raises_when_blocked(lim, monkeypatch):
    monkeypatch.setattr(L, "GLOBAL_DAILY_MAX", 1)
    lim.acquire(user_id="u1"); lim.release()
    with pytest.raises(LimitExceeded):
        lim.acquire(user_id="u2")


def test_blocked_acquire_does_not_consume_quota(lim, monkeypatch):
    monkeypatch.setattr(L, "GLOBAL_DAILY_MAX", 1)
    lim.acquire(user_id="u1"); lim.release()
    with pytest.raises(LimitExceeded):
        lim.acquire(user_id="u2")
    assert lim.snapshot()["global_used"] == 1


def test_snapshot_reports_configured_limits(lim):
    snap = lim.snapshot()
    for key in ("global_max", "session_max", "user_daily_max", "concurrency_max"):
        assert key in snap


def test_day_rollover_resets_counters(lim, monkeypatch):
    monkeypatch.setattr(L, "GLOBAL_DAILY_MAX", 1)
    lim.acquire(user_id="u1"); lim.release()
    assert not lim.check(user_id="u1")[0]
    monkeypatch.setattr(FetchLimiter, "_today", staticmethod(lambda: "2099-01-01"))
    assert lim.check(user_id="u1")[0]
