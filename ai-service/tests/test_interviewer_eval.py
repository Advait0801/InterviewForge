"""The interviewer-upgrade evaluation (D-066): its scoring, and the recorded live run.

The recorded run (app/eval/fixtures/interviewer.json) is what the phase was accepted on;
replaying it here keeps the thresholds checked on every push without a model call.
"""
import json
import os

import pytest

from app.eval import interviewer
from app.eval.interviewer_cases import CHALLENGE_CASES, HINT_CASES, PERSONA_PAIRS, PERSONA_PAIRS_HELD_OUT

FIXTURE = os.path.join(os.path.dirname(interviewer.__file__), "fixtures", "interviewer.json")


def test_hint_order_maps_shuffled_letters_back_to_ladder_levels():
    # Shown as A=level 3, B=level 1, C=level 2; the judge orders B, C, A (least -> most).
    row = {"shuffled": [2, 0, 1], "rank": {"order": ["B", "C", "A"]}, "leaks": [{}, {}], "hints": []}
    assert interviewer.score_hints({"x": row})["rows"][0]["judged_levels"] == [1, 2, 3]
    row["rank"]["order"] = ["A", "B", "C"]
    assert interviewer.score_hints({"x": row})["rows"][0]["in_order"] is False


def test_an_early_rung_that_gives_the_answer_away_fails_the_ladder():
    row = {"shuffled": [0, 1, 2], "rank": {"order": ["A", "B", "C"]}, "leaks": [{"gives_answer": True}, {}], "hints": []}
    scored = interviewer.score_hints({"x": row})
    assert scored["early_leaks"] == 1 and scored["pass"] is False


def test_a_single_false_pushback_fails_the_challenge_part():
    results = {c.id: {"challenged": c.contradicts} for c in CHALLENGE_CASES}
    assert interviewer.score_challenge(results)["pass"] is True
    wrongly = next(c.id for c in CHALLENGE_CASES if not c.contradicts)
    results[wrongly] = {"challenged": True}
    assert interviewer.score_challenge(results)["pass"] is False


def test_persona_quality_is_measured_against_neutral():
    def rows(valid_for_terse):
        out = {}
        for company, stage in PERSONA_PAIRS[:2]:
            for persona in interviewer.PERSONAS:
                valid = valid_for_terse if persona == "terse" else True
                out[f"{company}/{stage}/{persona}"] = {"question": "q", "judge": {"tone": persona, "valid": valid}}
        return out

    assert interviewer.score_personas(rows(True))["pass"] is True
    assert interviewer.score_personas(rows(False))["max_valid_drop"] == 1.0
    assert interviewer.score_personas(rows(False))["pass"] is False


def test_the_case_set_is_balanced_toward_hard_negatives():
    """Most negatives must be the kind a careless checker flags: agreeing, uncovered, weak or different."""
    negatives = [c for c in CHALLENGE_CASES if not c.contradicts]
    assert len(negatives) >= len(CHALLENGE_CASES) - len(negatives)
    assert len({c.id for c in CHALLENGE_CASES}) == len(CHALLENGE_CASES)
    assert len(HINT_CASES) >= 6


@pytest.mark.skipif(not os.path.exists(FIXTURE), reason="no recorded run")
def test_the_recorded_live_run_meets_every_threshold():
    with open(FIXTURE) as fh:
        recorded = json.load(fh)
    assert set(recorded) == {"personas", "persona_pairwise", "hints", "challenge"}
    assert set(recorded["challenge"]) == {c.id for c in CHALLENGE_CASES}, "re-record after changing the cases"
    assert set(recorded["hints"]) == {c.id for c in HINT_CASES}
    assert len(recorded["personas"]) == len(PERSONA_PAIRS + PERSONA_PAIRS_HELD_OUT) * len(interviewer.PERSONAS)
    scores = interviewer.score(recorded)
    assert {part: s["pass"] for part, s in scores.items()} == {
        "personas": True, "persona_pairwise": True, "hints": True, "challenge": True,
    }, (
        interviewer.render(scores)
    )
