"""
Simulated interviews through the real backend (D-067): is the agentic interviewer sensible,
does it keep to its rules, and what does an interview cost?

    python -m app.eval.simulate_interviews --record app/eval/fixtures/simulated_interviews.json
    python -m app.eval.simulate_interviews --replay app/eval/fixtures/simulated_interviews.json

Runs inside the ai-service container (it needs the model keys and reaches the backend at
http://backend:4000). Each run registers a throwaway user, starts an interview in a mode,
and answers every question as a simulated candidate until the interview completes:

  strong  correct, specific, with trade-offs
  weak    vague and generic, but not wrong
  wrong   confident, with clear technical mistakes

The candidate is gpt-4o-mini, or gpt-4o for "strong" (a gpt-4o-mini "strong" candidate averaged
about 6/10 with the grader in the first run: not a strong candidate); the interviewer is whatever the backend runs (Gemini, as in
production); each agent decision is judged by gpt-4o, which sees what the agent saw. Answers
are paced so the interviewer stays under Gemini's 15 requests/minute.

Checked:
  - rules, from the stored transcript: stages in order, at most 3 questions per stage in
    agent mode (2 in fixed), and the interview ends only after the last stage;
  - sensible: share of agent decisions the judge accepts (bar 80%);
  - adaptive: the agent probes the weak candidate more than the strong one;
  - cost per interview, agent vs fixed, from the session's own counters.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import time
import urllib.error
import urllib.request
import uuid
from typing import Any, Dict, List, Optional

BACKEND = os.getenv("SIM_BACKEND_URL", "http://backend:4000")
STAGES = ["behavioral", "coding", "system_design", "core_cs"]
MAX_ANSWERS = 14
PACE_SECONDS = 20
RUNS = [
    ("agent", "strong", "google"),
    ("agent", "weak", "amazon"),
    ("agent", "wrong", "meta"),
    ("fixed", "strong", "google"),
    ("fixed", "weak", "amazon"),
]
CANDIDATES = {
    "strong": (
        "You are an excellent senior software engineer in a job interview. Answer the question directly "
        "and completely in 150-220 words: correct and specific; state the approach, its time and space "
        "complexity where relevant, the edge cases and failure modes you'd handle, and the trade-offs "
        "against the main alternative. For behavioural questions, use one concrete situation with your "
        "own actions and a measurable result."
    ),
    "weak": (
        "You are a weak candidate in a job interview. Answer in 30-60 words: vague and generic, no "
        "concrete details or numbers, skip the hard part of the question. Do not say anything false."
    ),
    "wrong": (
        "You are an overconfident candidate in a job interview. Answer in 60-120 words, sounding sure of "
        "yourself, but include one or two clear technical mistakes (a wrong complexity, a false claim "
        "about how a well-known system or algorithm works)."
    ),
}
CANDIDATE_MODELS = {"strong": "gpt-4o"}
JUDGE = """You are reviewing one decision an AI interviewer made after a candidate's answer.
The interviewer could: probe (dig deeper on the same topic), pivot (new topic, same stage),
advance (next stage) or finish (end the interview). Allowed moves at that point: {allowed}.

Was the decision a sensible one that a good human interviewer could have made? Probing a vague,
shallow or wrong answer is sensible; advancing after a strong, complete answer is sensible;
advancing past a clearly wrong or empty answer without probing is usually not; probing a strong,
complete answer again and again is usually not. If it asked a question, it must be one coherent
question on the stage's topic.
Return JSON: {{{{"sensible": <true|false>, "reason": "<one short sentence>"}}}}"""


def _http(method: str, path: str, body: Any = None, token: Optional[str] = None):
    req = urllib.request.Request(f"{BACKEND}{path}", data=json.dumps(body).encode() if body is not None else None, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=240) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


async def _openai(system: str, human: str, model: str, *, json_out: bool) -> Any:
    from langchain_core.output_parsers import JsonOutputParser, StrOutputParser
    from langchain_core.prompts import ChatPromptTemplate

    from app.core import config
    from app.llm.chains import invoke_with_fallback, _get_llm

    def factory(provider=None):
        parser = JsonOutputParser() if json_out else StrOutputParser()
        return ChatPromptTemplate.from_messages([("system", system), ("human", "{body}")]) | _get_llm(provider) | parser

    factory.__name__ = "simulation"
    saved = (config.LLM_PROVIDER_ORDER, config.OPENAI_MODEL)
    config.LLM_PROVIDER_ORDER, config.OPENAI_MODEL = ["openai"], model
    try:
        for attempt in (1, 2, 3):
            try:
                return await asyncio.wait_for(invoke_with_fallback(factory, {"body": human}), timeout=60)
            except Exception:
                if attempt == 3:
                    raise
                await asyncio.sleep(5)
    finally:
        config.LLM_PROVIDER_ORDER, config.OPENAI_MODEL = saved


async def simulate(mode: str, profile: str, company: str) -> Dict[str, Any]:
    suffix = uuid.uuid4().hex[:8]
    _, body = _http("POST", "/api/auth/register", {
        "email": f"sim-{suffix}@example.com", "password": "Str0ngPassw0rd!", "username": f"sim{suffix}",
    })
    token = body["token"]
    status, started = _http("POST", "/api/interviews", {"company": company, "mode": mode, "useResume": False}, token)
    if status != 201:
        raise RuntimeError(f"start failed: {status} {started}")
    session_id = started["session"]["id"]
    question = started["openingQuestion"]["question"]
    stage = "behavioral"
    turns: List[Dict[str, Any]] = []
    print(f"  {mode}/{profile}/{company}: started", flush=True)

    for _ in range(MAX_ANSWERS):
        time.sleep(PACE_SECONDS)
        model = CANDIDATE_MODELS.get(profile, "gpt-4o-mini")
        answer = await _openai(CANDIDATES[profile], f"Interview stage: {stage}\nQuestion: {question}", model, json_out=False)
        status, outcome = _http("POST", f"/api/interviews/{session_id}/answer", {"answer": str(answer).strip()}, token)
        if status != 200:
            raise RuntimeError(f"answer failed: {status} {outcome}")
        turns.append({"stage": stage, "question": question, "answer": str(answer).strip(), "outcome": outcome})
        agent = outcome.get("agent") or {}
        print(f"    {stage}: score {outcome['evaluation'].get('score')} -> {outcome['action']}"
              f"{' (agent: ' + agent.get('decided', '') + ')' if agent else ''}", flush=True)
        if outcome["action"] == "completed":
            break
        if outcome["action"] == "advance_stage":
            stage = outcome["currentStage"]
        question = outcome["nextQuestion"]["question"]

    _, got = _http("GET", f"/api/interviews/{session_id}", token=token)
    return {
        "mode": mode, "profile": profile, "company": company, "session_id": session_id,
        "turns": turns, "messages": got["messages"], "session": got["session"],
    }


def check_rules(run: Dict[str, Any]) -> List[str]:
    """Rule breaks, read from what was stored -- not from what the backend said it did."""
    problems = []
    asked = [m for m in run["messages"] if m["role"] == "assistant" and m["metadata_json"]["kind"] in ("question", "followup")]
    order = [STAGES.index(m["stage"]) for m in asked]
    if order != sorted(order):
        problems.append("stages out of order")
    if sorted(set(order)) != list(range(len(STAGES))):
        problems.append(f"stages visited {sorted(set(order))}")
    cap = 3 if run["mode"] == "agent" else 2
    for i, name in enumerate(STAGES):
        if order.count(i) > cap:
            problems.append(f"{name}: {order.count(i)} questions (cap {cap})")
    if run["session"]["status"] != "completed":
        problems.append("did not complete")
    elif run["turns"][-1]["stage"] != "core_cs":
        problems.append(f"completed from {run['turns'][-1]['stage']}")
    return problems


async def judge_decisions(run: Dict[str, Any]) -> List[Dict[str, Any]]:
    verdicts = []
    for turn in run["turns"]:
        agent = turn["outcome"].get("agent")
        if not agent or agent["decided"] not in ("probe", "pivot", "advance", "finish"):
            continue
        last = turn["stage"] == "core_cs"
        allowed = "probe, pivot, " + ("finish" if last else "advance")
        nxt = (turn["outcome"].get("nextQuestion") or {}).get("question", "(none: interview ended)")
        body = (
            f"## Stage\n{turn['stage']}\n\n## Question\n{turn['question']}\n\n## Candidate answer\n{turn['answer']}\n\n"
            f"## Grader's score (1-10)\n{turn['outcome']['evaluation'].get('score')}\n\n"
            f"## Decision\n{agent['decided']}: {agent['rationale']}\n\n## Next question asked\n{nxt}"
        )
        verdict = await _openai(JUDGE.format(allowed=allowed), body, "gpt-4o", json_out=True)
        verdicts.append({"stage": turn["stage"], "decided": agent["decided"], "verdict": verdict})
    return verdicts


def score(runs: List[Dict[str, Any]]) -> Dict[str, Any]:
    agent_runs = [r for r in runs if r["mode"] == "agent"]
    verdicts = [v for r in agent_runs for v in r.get("judged", [])]
    sensible = sum(v["verdict"].get("sensible") is True for v in verdicts)

    def probe_rate(profile):
        decided = [t["outcome"]["agent"]["decided"] for r in agent_runs if r["profile"] == profile
                   for t in r["turns"] if t["outcome"].get("agent")]
        consulted = [d for d in decided if d in ("probe", "pivot", "advance", "finish")]
        return (sum(d == "probe" for d in consulted) / len(consulted)) if consulted else 0.0

    def cost(mode):
        rs = [r for r in runs if r["mode"] == mode]
        return {
            "interviews": len(rs),
            "mean_usd": round(sum(r["session"]["llm_cost_usd"] for r in rs) / len(rs), 6) if rs else None,
            "mean_calls": round(sum(r["session"]["llm_calls"] for r in rs) / len(rs), 1) if rs else None,
            "mean_answers": round(sum(len(r["turns"]) for r in rs) / len(rs), 1) if rs else None,
        }

    rule_breaks = {f"{r['mode']}/{r['profile']}": check_rules(r) for r in runs}
    out = {
        "rule_breaks": {k: v for k, v in rule_breaks.items() if v},
        "decisions_judged": len(verdicts),
        "sensible_rate": round(sensible / len(verdicts), 3) if verdicts else 0.0,
        "not_sensible": [f"{v['stage']} {v['decided']}: {v['verdict'].get('reason')}" for v in verdicts if v["verdict"].get("sensible") is not True],
        "probe_rate": {p: round(probe_rate(p), 3) for p in ("strong", "weak", "wrong")},
        "fallbacks": sum(1 for r in agent_runs for t in r["turns"] if (t["outcome"].get("agent") or {}).get("decided") == "fallback"),
        "cost": {"agent": cost("agent"), "fixed": cost("fixed")},
    }
    out["pass"] = (
        not out["rule_breaks"]
        and out["sensible_rate"] >= 0.8
        and out["probe_rate"]["weak"] > out["probe_rate"]["strong"]
    )
    return out


def render(s: Dict[str, Any]) -> str:
    return "\n".join([
        f"rule breaks: {s['rule_breaks'] or 'none'}",
        f"sensible decisions: {s['sensible_rate']:.0%} of {s['decisions_judged']} (bar 80%); agent fallbacks {s['fallbacks']}",
        *(f"  not sensible: {n}" for n in s["not_sensible"]),
        f"probe rate (share of agent decisions that probe): {s['probe_rate']} (weak must exceed strong)",
        f"cost per interview: agent {s['cost']['agent']}  fixed {s['cost']['fixed']}",
        f"-> {'PASS' if s['pass'] else 'FAIL'}",
    ])


async def run_all(record: Optional[str]) -> List[Dict[str, Any]]:
    runs = []
    def save():
        if record:  # saved as it goes: a late failure keeps the earlier interviews
            with open(record, "w") as fh:
                json.dump(runs, fh, indent=2, sort_keys=True)

    for mode, profile, company in RUNS:
        run = await simulate(mode, profile, company)
        runs.append(run)
        save()  # before judging, so a judge failure can't lose the interview
        if mode == "agent":
            run["judged"] = await judge_decisions(run)
            save()
    return runs


async def replay_decisions(runs: List[Dict[str, Any]], url: str = "http://localhost:8000") -> Dict[str, Any]:
    """Ask the agent again at the recorded first and second answer of each stage (D-067).

    A cheap policy check (about 30 model calls instead of a full simulation's ~150): same
    candidate answers, same grades, only the agent's decision is new. Path effects are lost --
    every replayed turn sees the recorded stage so far -- so this guides iteration; the full
    simulation decides."""
    out: Dict[str, List[str]] = {}
    for run in runs:
        if run["mode"] != "agent":
            continue
        by_stage: Dict[str, List[Dict[str, Any]]] = {}
        for turn in run["turns"]:
            by_stage.setdefault(turn["stage"], []).append(turn)
        for stage, turns in by_stage.items():
            for index, turn in enumerate(turns[:2]):
                transcript = []
                for prev in turns[:index]:
                    transcript += [
                        {"role": "assistant", "content": prev["question"]},
                        {"role": "candidate", "content": prev["answer"]},
                        {"role": "system", "content": f"Score: {prev['outcome']['evaluation'].get('score')}/10"},
                    ]
                transcript.append({"role": "assistant", "content": turn["question"]})
                body = {
                    "company": run["company"], "stage": stage,
                    "stage_position": f"{STAGES.index(stage) + 1} of {len(STAGES)}",
                    "allowed_actions": ["probe", "pivot", "finish" if stage == "core_cs" else "advance"],
                    "questions_left": 2 - index, "question": turn["question"], "answer": turn["answer"],
                    "evaluation": turn["outcome"]["evaluation"], "stage_transcript": transcript,
                }
                req = urllib.request.Request(f"{url}/api/interview/agent/turn", data=json.dumps(body).encode(), method="POST")
                req.add_header("Content-Type", "application/json")
                with urllib.request.urlopen(req, timeout=120) as r:
                    decided = json.loads(r.read())["action"]
                out.setdefault(run["profile"], []).append(decided)
                print(f"  {run['profile']} {stage} answer {index + 1} (score {turn['outcome']['evaluation'].get('score')}): {decided}", flush=True)
                time.sleep(6)
    rates = {p: round(sum(d == "probe" for d in ds) / len(ds), 3) for p, ds in out.items()}
    return {"decisions": out, "probe_rate": rates}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--record")
    parser.add_argument("--replay")
    parser.add_argument("--replay-decisions", help="re-ask the agent at recorded turns (cheap policy check)")
    args = parser.parse_args(argv)
    if args.replay_decisions:
        with open(args.replay_decisions) as fh:
            result = asyncio.run(replay_decisions(json.load(fh)))
        print(f"probe rate on replay: {result['probe_rate']}")
        return 0
    if args.replay:
        with open(args.replay) as fh:
            runs = json.load(fh)
    else:
        runs = asyncio.run(run_all(args.record))
    s = score(runs)
    print(render(s))
    if not args.replay:
        from app.core.observability import snapshot

        print(f"\nCandidate + judge spend: ~${snapshot()['estimatedCostUsd']:.4f} (the interviews' own spend is in the cost line)")
    return 0 if s["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
