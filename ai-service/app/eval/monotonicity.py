"""
Judge calibration: does the evaluator rank better answers higher?

    python -m app.eval.monotonicity                # live LLM calls
    python -m app.eval.monotonicity --record FILE  # live, and save responses
    python -m app.eval.monotonicity --replay FILE  # no LLM calls at all

Recorded runs are what CI replays, so the ordering assertion runs on every push
without spending money or needing a key.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
from typing import Any, Dict, List, Optional

from app.eval.graded_answers import GRADED_CASES, TIERS
from app.interview.company_profiles import get_company_profile

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "monotonicity.json")


async def _score_live(case, tier: str) -> Dict[str, Any]:
    from app.llm.chains import invoke_with_fallback, structured_evaluation_chain

    profile = get_company_profile(case.company)
    return await invoke_with_fallback(
        structured_evaluation_chain,
        {
            "company": profile.name,
            "company_style": profile.style,
            "stage": case.stage,
            "question": case.question,
            "answer": case.answers[tier],
            "context": "No specific retrieval context available.",
        },
    )


async def collect_live() -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    for case in GRADED_CASES:
        out[case.id] = {}
        for tier in TIERS:
            out[case.id][tier] = await _score_live(case, tier)
    return out


def load_recorded(path: str) -> Dict[str, Dict[str, Any]]:
    with open(path) as fh:
        return json.load(fh)


def check(results: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Return one verdict row per graded case."""
    rows = []
    for case in GRADED_CASES:
        scores = {tier: int(results[case.id][tier]["score"]) for tier in TIERS}
        ordered = scores["weak"] < scores["mediocre"] < scores["strong"]
        rows.append(
            {
                "id": case.id,
                "company": case.company,
                "stage": case.stage,
                "scores": scores,
                "monotonic": ordered,
                "spread": scores["strong"] - scores["weak"],
            }
        )
    return rows


def render(rows: List[Dict[str, Any]]) -> str:
    lines = ["| case | weak | mediocre | strong | spread | monotonic |", "|---|---|---|---|---|---|"]
    for r in rows:
        s = r["scores"]
        lines.append(
            f"| `{r['id']}` | {s['weak']} | {s['mediocre']} | {s['strong']} | "
            f"{r['spread']} | {'yes' if r['monotonic'] else 'NO'} |"
        )
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--record", type=str, default=None)
    ap.add_argument("--replay", type=str, default=None)
    args = ap.parse_args()

    if args.replay:
        results = load_recorded(args.replay)
    else:
        results = asyncio.run(collect_live())
        if args.record:
            os.makedirs(os.path.dirname(args.record), exist_ok=True)
            with open(args.record, "w") as fh:
                json.dump(results, fh, indent=2)
            print(f"recorded -> {args.record}\n")

    rows = check(results)
    print(render(rows))
    failed = [r["id"] for r in rows if not r["monotonic"]]
    print()
    if failed:
        print(f"FAIL: judge did not rank answers correctly for: {', '.join(failed)}")
        raise SystemExit(1)
    print(f"PASS: all {len(rows)} cases ranked weak < mediocre < strong")


if __name__ == "__main__":
    main()
