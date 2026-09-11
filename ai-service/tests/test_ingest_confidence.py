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


def test_too_few_good_hits_is_not_confident(monkeypatch):
    """The good-hits floor is enforced, whatever it is currently tuned to.

    This used to hard-code "one good hit is not enough". Calibration against the
    real corpus moved MIN_GOOD_HITS to 1 (D-038) -- the company+stage filter
    often returns only 2-3 hits, so demanding two usable ones fetched for
    companies that are in fact well covered. The floor still has to work, so the
    test now exercises the mechanism and lets the tuned value live in one place:
    test_confidence_thresholds_match_the_calibrated_operating_point.
    """
    import app.ingest.confidence as conf

    monkeypatch.setattr(conf, "MIN_GOOD_HITS", 2)
    v = conf.assess([hit(0.20), hit(1.4), hit(1.5)], company="amazon")
    assert not v.confident and "need" in v.reason


def test_one_good_hit_is_enough_at_the_calibrated_floor():
    v = assess([hit(0.20), hit(1.4), hit(1.5)], company="amazon")
    assert v.confident


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
