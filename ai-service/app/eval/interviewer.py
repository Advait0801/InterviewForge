"""
Interviewer-upgrade evaluation (D-066): personas, the hint ladder, the grounded challenge.

    python -m app.eval.interviewer                      # live, all three parts
    python -m app.eval.interviewer --only challenge     # live, one part
    python -m app.eval.interviewer --record FILE        # live, and save every model output
    python -m app.eval.interviewer --replay FILE        # no model calls at all

What each part claims, and how it is checked:
  - personas: a blind judge, shown only a generated question, names its tone. The persona
    should be recognisable (accuracy), and no persona may cost question quality (the same
    judge says whether it is one valid, on-topic question for the stage).
  - hints: the judge, shown a question's three hints in shuffled order, ranks them by how
    much they reveal; the order should match the ladder. Separately, rungs 1 and 2 must
    never give the answer away.
  - challenge: the production endpoint (model + verbatim quote check) on hand-labelled
    answers. False pushback on a correct answer is the number that matters most.

Generation runs on Gemini only (the production model) and the judge on OpenAI only; neither
falls back, so a quota error stops the run instead of mixing models. Gemini's free tier
allows 15 requests/minute and 500/day per model; a full run makes about 120 Gemini calls,
paced to 10/minute. Live runs print their estimated spend. Recorded runs are replayed by tests, so the thresholds
are checked on every push for free.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import random
import time
from typing import Any, Dict, List, Optional

from app.eval.interviewer_cases import CHALLENGE_CASES, HINT_CASES, PERSONA_PAIRS, PERSONA_PAIRS_HELD_OUT

HELD_OUT_HINTS = {"cycle", "resharding"}

PERSONAS = ["neutral", "friendly", "terse", "adversarial"]
CALLS_PER_MINUTE = 10
THRESHOLDS = {
    "persona_accuracy": 0.75,  # well above the 0.25 of guessing among four
    "persona_valid_drop": 0.125,  # no persona may lose more than one question in eight
    "hint_order_rate": 0.8,
    "hint_early_leaks": 0,
    "challenge_false_positives": 0,
    "challenge_recall": 0.5,
}

# Generation runs on the production model only; the judge on another family (D-066). Both
# are pinned, because the free tier also caps Gemini at 500 requests/day, and the first
# full run silently fell back to OpenAI part-way, measuring two models as one.
GENERATOR_PROVIDER = "gemini"
JUDGE_PROVIDER = "openai"
# gpt-4o-mini misread hints it described in its own reasons and flipped pairwise answers with
# presentation order; Advait approved gpt-4o for judging only (D-066). The interviewer
# itself is still flash-lite.
JUDGE_MODEL = "gpt-4o"

CALL_TIMEOUT_S = 60

_last_call = 0.0


async def _paced(coro_factory):
    """Run one model call no sooner than 60/CALLS_PER_MINUTE seconds after the previous."""
    global _last_call
    wait = _last_call + 60 / CALLS_PER_MINUTE - time.monotonic()
    if wait > 0:
        await asyncio.sleep(wait)
    _last_call = time.monotonic()
    return await coro_factory()


async def _on(provider: str, chain, payload: dict):
    """Invoke on exactly one provider: no fallback, so a quota error stops the run."""
    from app.core import config
    from app.llm.chains import invoke_with_fallback

    saved = config.LLM_PROVIDER_ORDER
    config.LLM_PROVIDER_ORDER = [provider]
    try:
        # The provider clients have no request timeout: one hung call stalled a whole run for
        # 15 minutes, and a DNS blip ended another. Bound each call; retry transient failures.
        for attempt in (1, 2, 3):
            try:
                return await asyncio.wait_for(invoke_with_fallback(chain, payload), timeout=CALL_TIMEOUT_S)
            except Exception as exc:  # includes asyncio.TimeoutError
                if attempt == 3:
                    raise
                print(f"  ({provider} call failed: {type(exc).__name__}; retrying, attempt {attempt})", flush=True)
                await asyncio.sleep(5)
    finally:
        config.LLM_PROVIDER_ORDER = saved


async def _generate(chain, payload: dict):
    return await _paced(lambda: _on(GENERATOR_PROVIDER, chain, payload))


async def _judge(chain, payload: dict):
    # OpenAI's limits are far above our pace; no need to spend the Gemini budget waiting.
    from app.core import config

    saved = config.OPENAI_MODEL
    config.OPENAI_MODEL = JUDGE_MODEL  # read by _get_llm and by the cost estimate
    try:
        return await _on(JUDGE_PROVIDER, chain, payload)
    finally:
        config.OPENAI_MODEL = saved


def _judge_chain(system: str):
    from langchain_core.output_parsers import JsonOutputParser
    from langchain_core.prompts import ChatPromptTemplate

    from app.llm.chains import _get_llm

    def factory(provider=None):
        prompt = ChatPromptTemplate.from_messages([("system", system), ("human", "{body}")])
        return prompt | _get_llm(provider) | JsonOutputParser()

    factory.__name__ = "eval_judge"
    return factory


PERSONA_JUDGE = """You are auditing an AI interviewer. You see one interview question it asked.

1. tone: which interviewer tone best describes how the question is phrased?
   friendly = warm, encouraging, collaborative; neutral = plain and professional, no particular warmth or edge;
   terse = minimal, clipped, no pleasantries; adversarial = skeptical, challenging, pressing the candidate.
2. valid: is it a single, coherent, on-topic interview question for the given interview stage?

Return JSON: {{"tone": "<friendly|neutral|terse|adversarial>", "valid": <true|false>, "reason": "<one short sentence>"}}"""

PERSONA_PAIR_JUDGE = """You see two interview questions, A and B, written by interviewers with different styles.
Which one is more {style}? ({definition})
Return JSON: {{{{"answer": "<A|B>", "reason": "<one short sentence>"}}}}"""

STYLE_DEFINITIONS = {
    "friendly": "warm, encouraging, collaborative",
    "terse": "minimal and clipped: fewer words, no set-up or pleasantries",
    "adversarial": "skeptical and challenging: pressing the candidate, questioning assumptions",
}

HINT_RANK_JUDGE = """You see an interview question and three hints labelled A, B and C.
Order the hints from the one that reveals the LEAST about the solution to the one that reveals the MOST.
Return JSON: {{"order": ["<letter>", "<letter>", "<letter>"], "reason": "<one short sentence>"}}"""

HINT_PAIR_JUDGE = """You see an interview question and two hints, A and B.
Which hint reveals MORE about how to solve the question?
Return JSON: {{"answer": "<A|B>", "reason": "<one short sentence>"}}"""

HINT_LEAK_JUDGE = """You see an interview question and one hint an interviewer gave.
Does the hint, on its own, give away the complete answer -- so that a candidate could answer fully by restating it?
Naming a technique or pointing in a direction is NOT giving the answer away.
Return JSON: {{"gives_answer": <true|false>, "reason": "<one short sentence>"}}"""


# --- live collection -------------------------------------------------------------


async def _personas_live() -> Dict[str, Any]:
    import app.api.interview as interview
    from app.interview import orchestrator

    # Local context only: an eval must not trigger live fetches or write to the corpus.
    orchestrator.LIVE_FALLBACK_ENABLED = False
    judge = _judge_chain(PERSONA_JUDGE)
    out: Dict[str, Any] = {}
    for company, stage in PERSONA_PAIRS + PERSONA_PAIRS_HELD_OUT:
        for persona in PERSONAS:
            req = interview.NextQuestionRequest(company=company, stage=stage, difficulty="medium", persona=persona)
            chain, payload, _, _ = interview._prepare_next_question(req)
            generated = await _generate(chain, payload)
            question = str(generated.get("question", ""))
            verdict = await _judge(judge, _persona_body(stage, question))
            out[f"{company}/{stage}/{persona}"] = {"question": question, "judge": verdict, "generator": GENERATOR_PROVIDER}
            print(f"  persona {company}/{stage}/{persona}: judged {verdict.get('tone')}, valid={verdict.get('valid')}")
    return out


async def _hints_live() -> Dict[str, Any]:
    from app.llm.chains import HINT_LEVELS, hint_chain

    rank, leak = _judge_chain(HINT_RANK_JUDGE), _judge_chain(HINT_LEAK_JUDGE)
    rng = random.Random(7)
    out: Dict[str, Any] = {}
    for case in HINT_CASES:
        hints: List[str] = []
        for level in (1, 2, 3):
            payload = {
                "company": case.company, "stage": case.stage, "question": case.question, "level": level,
                "level_description": HINT_LEVELS[level],
                "previous_hints": "\n".join(f"{i}. {h}" for i, h in enumerate(hints, 1)) or "None.",
                "draft": "Nothing written yet.",
                "context": case.context or "No additional context provided.",
            }
            result = await _generate(hint_chain, payload)
            hints.append(str(result.get("hint", "")))
        shuffled = list(range(3))
        rng.shuffle(shuffled)
        ranked, leaks, pairs = await _judge_hints(rank, leak, case.question, hints, shuffled)
        out[case.id] = {"hints": hints, "shuffled": shuffled, "rank": ranked, "leaks": leaks, "pairs": pairs,
                        "generator": GENERATOR_PROVIDER}
        print(f"  hints {case.id}: judge order {ranked.get('order')}, leaks {[l.get('gives_answer') for l in leaks]}")
    return out


def _persona_body(stage: str, question: str) -> dict:
    return {"body": f"## Interview stage\n{stage}\n\n## Question\n{question}"}


async def _judge_hints(rank, leak, question: str, hints: List[str], shuffled: List[int]):
    body = f"## Question\n{question}\n\n" + "\n\n".join(
        f"## Hint {'ABC'[i]}\n{hints[idx]}" for i, idx in enumerate(shuffled)
    )
    ranked = await _judge(rank, {"body": body})
    leaks = [await _judge(leak, {"body": f"## Question\n{question}\n\n## Hint\n{hints[level - 1]}"}) for level in (1, 2)]
    pairs = await _judge_hint_pairs(question, hints)
    return ranked, leaks, pairs


async def _judge_hint_pairs(question: str, hints: List[str]) -> List[Dict[str, Any]]:
    """Each pair of rungs, in both orders: the 3-way ranking misread hints it described in its
    own reasons, and asking one comparison at a time with positions swapped cancels the
    position bias a single ordering has."""
    judge = _judge_chain(HINT_PAIR_JUDGE)
    out = []
    for low, high in ((1, 2), (2, 3), (1, 3)):
        for high_first in (False, True):
            a, b = (hints[high - 1], hints[low - 1]) if high_first else (hints[low - 1], hints[high - 1])
            verdict = await _judge(judge, {"body": f"## Question\n{question}\n\n## Hint A\n{a}\n\n## Hint B\n{b}"})
            picked = str(verdict.get("answer", "")).strip().upper()[:1]
            out.append({"low": low, "high": high, "high_first": high_first,
                        "higher_judged_more": picked == ("A" if high_first else "B")})
    return out


async def _pairwise(results: Dict[str, Any]) -> Dict[str, Any]:
    """Diagnostic: is each persona's question more <style> than the neutral one for the same
    company and stage? Order shown is randomised; 50% is chance."""
    rng = random.Random(11)
    out: Dict[str, Any] = {}
    for key, row in results.items():
        pair, persona = key.rsplit("/", 1)
        if persona == "neutral":
            continue
        neutral = results[f"{pair}/neutral"]["question"]
        persona_first = rng.random() < 0.5
        a, b = (row["question"], neutral) if persona_first else (neutral, row["question"])
        judge = _judge_chain(PERSONA_PAIR_JUDGE.format(style=persona, definition=STYLE_DEFINITIONS[persona]))
        verdict = await _judge(judge, {"body": f"## A\n{a}\n\n## B\n{b}"})
        picked = str(verdict.get("answer", "")).strip().upper()[:1]
        out[key] = {"persona_shown_as": "A" if persona_first else "B", "verdict": verdict,
                    "persona_won": picked == ("A" if persona_first else "B")}
    return out


async def rejudge(results: Dict[str, Any]) -> Dict[str, Any]:
    """Re-score recorded generations with the current judge; no generation calls."""
    questions = {c.id: c.question for c in HINT_CASES}
    out = json.loads(json.dumps(results))
    if "personas" in out:
        judge = _judge_chain(PERSONA_JUDGE)
        for key, row in out["personas"].items():
            stage = key.split("/")[1]
            row["judge"] = await _judge(judge, _persona_body(stage, row["question"]))
        out["persona_pairwise"] = await _pairwise(out["personas"])
    if "hints" in out:
        rank, leak = _judge_chain(HINT_RANK_JUDGE), _judge_chain(HINT_LEAK_JUDGE)
        for case_id, row in out["hints"].items():
            row["rank"], row["leaks"], row["pairs"] = await _judge_hints(
                rank, leak, questions[case_id], row["hints"], row["shuffled"]
            )
    return out


async def _challenge_live() -> Dict[str, Any]:
    import app.api.interview as interview

    out: Dict[str, Any] = {}
    for case in CHALLENGE_CASES:
        req = interview.ChallengeRequest(
            company=case.company, stage=case.stage, question=case.question, answer=case.answer, context=case.context
        )
        result = await _paced(lambda: _pinned_challenge(interview, req))
        out[case.id] = result
        print(f"  challenge {case.id}: challenged={result['challenged']} ({result['reason']})")
    return out


async def _pinned_challenge(interview, req):
    """The production endpoint, on the production model only."""
    from app.core import config

    saved = config.LLM_PROVIDER_ORDER
    config.LLM_PROVIDER_ORDER = [GENERATOR_PROVIDER]
    try:
        return await asyncio.wait_for(interview.challenge(req), timeout=2 * CALL_TIMEOUT_S)
    finally:
        config.LLM_PROVIDER_ORDER = saved


async def collect_live(parts: List[str]) -> Dict[str, Any]:
    collectors = {"personas": _personas_live, "hints": _hints_live, "challenge": _challenge_live}
    out = {part: await collectors[part]() for part in parts}
    if "personas" in out:
        out["persona_pairwise"] = await _pairwise(out["personas"])
    return out


# --- scoring ---------------------------------------------------------------------


def score_personas(results: Dict[str, Any]) -> Dict[str, Any]:
    held_out = {f"{c}/{s}" for c, s in PERSONA_PAIRS_HELD_OUT}
    held = [(k, r) for k, r in results.items() if k.rsplit("/", 1)[0] in held_out]
    held_accuracy = (
        sum(str(r["judge"].get("tone", "")).strip().lower() == k.rsplit("/", 1)[1] for k, r in held) / len(held)
        if held else None
    )
    by_persona: Dict[str, Dict[str, Any]] = {p: {"n": 0, "correct": 0, "valid": 0, "words": 0} for p in PERSONAS}
    confusion: Dict[str, Dict[str, int]] = {p: {} for p in PERSONAS}
    for key, row in results.items():
        persona = key.rsplit("/", 1)[1]
        tone = str(row["judge"].get("tone", "")).strip().lower()
        stats = by_persona[persona]
        stats["n"] += 1
        stats["correct"] += tone == persona
        stats["valid"] += row["judge"].get("valid") is True
        stats["words"] += len(row["question"].split())
        confusion[persona][tone] = confusion[persona].get(tone, 0) + 1
    total = sum(s["n"] for s in by_persona.values())
    accuracy = sum(s["correct"] for s in by_persona.values()) / total if total else 0.0
    valid = {p: s["valid"] / s["n"] for p, s in by_persona.items() if s["n"]}
    drop = max((valid["neutral"] - v for v in valid.values()), default=0.0) if "neutral" in valid else 0.0
    return {
        "accuracy": round(accuracy, 3),
        "held_out_accuracy": None if held_accuracy is None else round(held_accuracy, 3),
        "valid_rate": {p: round(v, 3) for p, v in valid.items()},
        "max_valid_drop": round(drop, 3),
        "mean_words": {p: round(s["words"] / s["n"], 1) for p, s in by_persona.items() if s["n"]},
        "confusion": confusion,
        "pass": accuracy >= THRESHOLDS["persona_accuracy"] and drop <= THRESHOLDS["persona_valid_drop"],
    }


def score_hints(results: Dict[str, Any]) -> Dict[str, Any]:
    """A ladder is in order when every pair of rungs (1<2, 2<3, 1<3) is judged correctly in
    both presentation orders (`pairs`). The single 3-way ranking is kept as `three_way_rate`
    for comparison; it was the first protocol, and it misread hints (D-066)."""
    ordered, three_way, leaks, rows = 0, 0, 0, []
    for case_id, row in results.items():
        letters = [str(x).strip().upper()[:1] for x in row["rank"].get("order", [])]
        levels = ["ABC".index(l) for l in letters if l in "ABC"]
        judged = [row["shuffled"][i] + 1 for i in levels]
        pairs = row.get("pairs")
        pair_ok = all(p["higher_judged_more"] for p in pairs) if pairs else judged == [1, 2, 3]
        early_leaks = sum(v.get("gives_answer") is True for v in row["leaks"])
        ordered += pair_ok
        three_way += judged == [1, 2, 3]
        leaks += early_leaks
        wrong = [f"{p['low']}v{p['high']}{'(swapped)' if p['high_first'] else ''}" for p in pairs or [] if not p["higher_judged_more"]]
        rows.append({"id": case_id, "judged_levels": judged, "in_order": pair_ok, "pairs_wrong": wrong,
                     "early_leaks": early_leaks, "held_out": case_id in HELD_OUT_HINTS})
    rate = ordered / len(results) if results else 0.0
    return {
        "order_rate": round(rate, 3),
        "three_way_rate": round(three_way / len(results), 3) if results else 0.0,
        "early_leaks": leaks,
        "rows": rows,
        "pass": rate >= THRESHOLDS["hint_order_rate"] and leaks <= THRESHOLDS["hint_early_leaks"],
    }


def score_challenge(results: Dict[str, Any]) -> Dict[str, Any]:
    labels = {c.id: c.contradicts for c in CHALLENGE_CASES}
    tp = sum(1 for k, r in results.items() if labels[k] and r["challenged"])
    fn = sum(1 for k, r in results.items() if labels[k] and not r["challenged"])
    fp = sum(1 for k, r in results.items() if not labels[k] and r["challenged"])
    tn = sum(1 for k, r in results.items() if not labels[k] and not r["challenged"])
    recall = tp / (tp + fn) if tp + fn else 0.0
    return {
        "true_positives": tp, "false_negatives": fn, "false_positives": fp, "true_negatives": tn,
        "recall": round(recall, 3),
        "missed": sorted(k for k, r in results.items() if labels[k] and not r["challenged"]),
        "false_alarms": sorted(k for k, r in results.items() if not labels[k] and r["challenged"]),
        "pass": fp <= THRESHOLDS["challenge_false_positives"] and recall >= THRESHOLDS["challenge_recall"],
    }


def score_pairwise(results: Dict[str, Any]) -> Dict[str, Any]:
    """Diagnostic only; has no threshold. Reported beside the blind accuracy."""
    by: Dict[str, List[bool]] = {}
    for key, row in results.items():
        by.setdefault(key.rsplit("/", 1)[1], []).append(row["persona_won"])
    rates = {p: round(sum(v) / len(v), 3) for p, v in by.items()}
    wins = [w for v in by.values() for w in v]
    return {"win_rate": round(sum(wins) / len(wins), 3) if wins else 0.0, "by_persona": rates, "pass": True}


def score(results: Dict[str, Any]) -> Dict[str, Any]:
    scorers = {
        "personas": score_personas, "hints": score_hints, "challenge": score_challenge,
        "persona_pairwise": score_pairwise,
    }
    return {part: scorers[part](rows) for part, rows in results.items()}


def render(scores: Dict[str, Any]) -> str:
    lines = []
    if "personas" in scores:
        s = scores["personas"]
        lines += [
            f"personas: judge accuracy {s['accuracy']:.0%} (need {THRESHOLDS['persona_accuracy']:.0%}; "
            f"held-out pairs {s['held_out_accuracy'] if s['held_out_accuracy'] is None else format(s['held_out_accuracy'], '.0%')}), "
            f"worst valid-rate drop vs neutral {s['max_valid_drop']:.0%} -> {'PASS' if s['pass'] else 'FAIL'}",
            f"  valid rate {s['valid_rate']}  mean words {s['mean_words']}",
            f"  confusion (persona -> judged) {s['confusion']}",
        ]
    if "persona_pairwise" in scores:
        s = scores["persona_pairwise"]
        lines.append(f"  side by side (diagnostic, 50% = chance): persona judged more <style> than neutral "
                     f"{s['win_rate']:.0%}, by persona {s['by_persona']}")
    if "hints" in scores:
        s = scores["hints"]
        lines += [
            f"hints: ladder order matched {s['order_rate']:.0%} by pairwise judging (need {THRESHOLDS['hint_order_rate']:.0%}; "
            f"one 3-way ranking: {s['three_way_rate']:.0%}), "
            f"early rungs giving the answer away {s['early_leaks']} -> {'PASS' if s['pass'] else 'FAIL'}",
            *(f"  {r['id']}{' (held out)' if r['held_out'] else ''}: pairs wrong {r['pairs_wrong']}, "
              f"3-way {r['judged_levels']}, leaks {r['early_leaks']}" for r in s["rows"]),
        ]
    if "challenge" in scores:
        s = scores["challenge"]
        lines += [
            f"challenge: false pushback {s['false_positives']} of {s['false_positives'] + s['true_negatives']} correct answers, "
            f"caught {s['true_positives']} of {s['true_positives'] + s['false_negatives']} contradictions "
            f"(recall {s['recall']:.0%}) -> {'PASS' if s['pass'] else 'FAIL'}",
            f"  missed {s['missed']}  false alarms {s['false_alarms']}",
        ]
    return "\n".join(lines)


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--only", choices=["personas", "hints", "challenge"], action="append")
    parser.add_argument("--record", help="save live outputs here")
    parser.add_argument("--replay", help="score saved outputs; no model calls")
    parser.add_argument("--rejudge", help="re-run only the judge over saved outputs, and save the result back")
    args = parser.parse_args(argv)

    if args.rejudge:
        with open(args.rejudge) as fh:
            recorded = json.load(fh)
        parts = {k: v for k, v in recorded.items() if k in ("personas", "hints") and (not args.only or k in args.only)}
        rejudged = asyncio.run(rejudge(parts))
        with open(args.rejudge, "w") as fh:
            json.dump({**recorded, **rejudged}, fh, indent=2, sort_keys=True)
        results = {**recorded, **rejudged}
    elif args.replay:
        with open(args.replay) as fh:
            results = json.load(fh)
        if args.only:
            results = {k: v for k, v in results.items() if k in args.only}
    else:
        results = asyncio.run(collect_live(args.only or ["personas", "hints", "challenge"]))
        if args.record:
            existing = {}
            try:
                with open(args.record) as fh:
                    existing = json.load(fh)
            except FileNotFoundError:
                pass
            with open(args.record, "w") as fh:
                json.dump({**existing, **results}, fh, indent=2, sort_keys=True)

    scores = score(results)
    print(render(scores))
    if not args.replay:
        from app.core.observability import snapshot

        spend = snapshot()
        print(f"\nModel spend this run: {spend['calls']} calls, ~${spend['estimatedCostUsd']:.4f}")
    return 0 if all(s["pass"] for s in scores.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
