import pytest
from app.ingest import confidence as C
from app.ingest.confidence import assess


def hit(distance, company="amazon"):
    return {"distance": distance, "metadata": {"company": company, "stage": "coding"}}


def test_no_hits_is_never_confident():
    v = assess([])
    assert not v.confident and "no hits" in v.reason


def test_strong_close_hits_are_confident():
    v = assess([hit(0.15), hit(0.22), hit(0.30)], company="amazon")
    assert v.confident


def test_distant_best_hit_is_not_confident():
    v = assess([hit(0.95), hit(0.97)], company="amazon")
    assert not v.confident and "too distant" in v.reason


def test_single_good_hit_is_not_enough():
    v = assess([hit(0.20), hit(1.4), hit(1.5)], company="amazon")
    assert not v.confident and "need" in v.reason


def test_missing_company_specific_chunk_is_not_confident():
    v = assess([hit(0.2, company="google"), hit(0.3, company="google")], company="amazon")
    assert not v.confident and "amazon" in v.reason


def test_company_check_is_skipped_when_no_company_given():
    v = assess([hit(0.2, company="google"), hit(0.3, company="google")])
    assert v.confident


def test_missing_distances_assume_confident():
    # Failing open here is deliberate: fetching on every query is the expensive
    # failure, so an unmeasurable result should not trigger the live path.
    v = assess([{"metadata": {"company": "amazon"}}], company="amazon")
    assert v.confident and "assuming confident" in v.reason


def test_thresholds_are_configurable(monkeypatch):
    monkeypatch.setattr(C, "MAX_TOP_DISTANCE", 0.1)
    assert not assess([hit(0.2), hit(0.25)], company="amazon").confident
    monkeypatch.setattr(C, "MAX_TOP_DISTANCE", 0.9)
    assert assess([hit(0.2), hit(0.25)], company="amazon").confident


def test_verdict_serialises_for_api_responses():
    d = assess([hit(0.2), hit(0.3)], company="amazon").as_dict()
    assert set(d) == {"confident", "reason", "top_distance", "good_hits", "company_matched"}


def test_reports_the_best_distance():
    assert assess([hit(0.4), hit(0.2), hit(0.9)], company="amazon").top_distance == pytest.approx(0.2)
