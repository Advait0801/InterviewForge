"""
Replays recorded judge responses, so the ordering assertion runs in CI without
LLM calls. Re-record with:

    python -m app.eval.monotonicity --record app/eval/fixtures/monotonicity.json
"""
import json
import os

import pytest
from app.eval.graded_answers import GRADED_CASES, TIERS
from app.eval.monotonicity import check, load_recorded

FIXTURE = os.path.join(
    os.path.dirname(__file__), "..", "app", "eval", "fixtures", "monotonicity.json"
)


@pytest.fixture(scope="module")
def recorded():
    return load_recorded(os.path.abspath(FIXTURE))


def test_fixture_covers_every_case_and_tier(recorded):
    for case in GRADED_CASES:
        assert case.id in recorded, f"no recorded response for {case.id}"
        for tier in TIERS:
            assert tier in recorded[case.id]


def test_recorded_responses_have_the_expected_shape(recorded):
    for case_id, tiers in recorded.items():
        for tier, payload in tiers.items():
            assert "score" in payload, f"{case_id}/{tier} has no score"
            assert 1 <= int(payload["score"]) <= 10


@pytest.mark.parametrize("case_id", [c.id for c in GRADED_CASES])
def test_judge_ranks_weak_below_mediocre_below_strong(recorded, case_id):
    row = next(r for r in check(recorded) if r["id"] == case_id)
    assert row["monotonic"], (
        f"judge did not rank answers in quality order for {case_id}: {row['scores']}"
    )


@pytest.mark.parametrize("case_id", [c.id for c in GRADED_CASES])
def test_score_spread_is_meaningful(recorded, case_id):
    # A judge that puts every answer within a point or two of the others is not
    # discriminating, even if the ordering happens to be right.
    row = next(r for r in check(recorded) if r["id"] == case_id)
    assert row["spread"] >= 3, f"weak-to-strong spread too narrow for {case_id}: {row['spread']}"


def test_check_detects_a_broken_ordering():
    # The checker itself must be able to fail, or the tests above prove nothing.
    broken = {
        c.id: {t: {"score": 5} for t in TIERS} for c in GRADED_CASES
    }
    assert all(not r["monotonic"] for r in check(broken))


def test_graded_answers_are_ordered_by_length_as_a_sanity_check():
    # Not a quality measure, but a weak answer that is longer than the strong one
    # usually means the fixtures got swapped.
    for case in GRADED_CASES:
        assert len(case.answers["weak"]) < len(case.answers["strong"])
