"""Scoring for the simulated-interview evaluation (D-067). No backend, no model."""
import json
import os

import pytest

from app.eval import simulate_interviews as sim

FIXTURE = os.path.join(os.path.dirname(sim.__file__), "fixtures", "simulated_interviews.json")


def _q(stage, kind="question"):
    return {"role": "assistant", "stage": stage, "metadata_json": {"kind": kind}, "content": "q"}


def run(mode="agent", stages_asked=None, status="completed", last_stage="core_cs", decided=None, profile="strong"):
    stages_asked = stages_asked or ["behavioral", "coding", "system_design", "core_cs"]
    turns = [{"stage": last_stage, "outcome": {"action": "completed", "evaluation": {"score": 7},
                                                **({"agent": {"decided": decided}} if decided else {})}}]
    return {
        "mode": mode, "profile": profile, "messages": [_q(s) for s in stages_asked],
        "session": {"status": status, "llm_cost_usd": 0.004, "llm_calls": 30}, "turns": turns,
    }


def test_a_clean_interview_breaks_no_rule():
    assert sim.check_rules(run()) == []


@pytest.mark.parametrize(
    "kwargs, problem",
    [
        ({"stages_asked": ["behavioral", "system_design", "coding", "core_cs"]}, "stages out of order"),
        ({"stages_asked": ["behavioral", "coding", "core_cs"]}, "stages visited"),
        ({"stages_asked": ["behavioral"] * 4 + ["coding", "system_design", "core_cs"]}, "behavioral: 4 questions (cap 3)"),
        ({"mode": "fixed", "stages_asked": ["behavioral"] * 3 + ["coding", "system_design", "core_cs"]}, "cap 2"),
        ({"status": "active"}, "did not complete"),
        ({"last_stage": "coding"}, "completed from coding"),
    ],
)
def test_each_rule_break_is_caught_from_the_transcript(kwargs, problem):
    assert any(problem in p for p in sim.check_rules(run(**kwargs)))


def test_probe_rate_and_sensible_rate():
    weak = run(profile="weak")
    weak["turns"] = [{"stage": "coding", "outcome": {"evaluation": {}, "agent": {"decided": "probe"}}}] * 3 + weak["turns"]
    weak["judged"] = [{"stage": "coding", "decided": "probe", "verdict": {"sensible": True}}] * 4
    strong = run(profile="strong", decided="advance")
    strong["judged"] = [{"stage": "core_cs", "decided": "advance", "verdict": {"sensible": False, "reason": "x"}}]
    scored = sim.score([weak, strong, run(mode="fixed")])
    assert scored["probe_rate"]["weak"] == 1.0 and scored["probe_rate"]["strong"] == 0.0
    assert scored["sensible_rate"] == 0.8 and scored["pass"] is True
    assert scored["cost"]["agent"]["interviews"] == 2 and scored["cost"]["fixed"]["interviews"] == 1


@pytest.mark.skipif(not os.path.exists(FIXTURE), reason="no recorded run")
def test_the_recorded_simulation_meets_every_bar():
    with open(FIXTURE) as fh:
        runs = json.load(fh)
    assert {(r["mode"], r["profile"]) for r in runs} == {(m, p) for m, p, _ in sim.RUNS}
    scored = sim.score(runs)
    assert scored["pass"], sim.render(scored)
