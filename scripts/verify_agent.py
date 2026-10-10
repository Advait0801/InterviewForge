"""Phase 6 verification: the agentic interviewer's wiring and cost cap, live (D-067).

    python scripts/verify_agent.py          # one agent-mode interview, canned answers
    python scripts/verify_agent.py --cap    # backend must run with a tiny INTERVIEW_COST_CAP_USD (e.g. 0.001)

Run against a live stack. Answers are canned (no candidate model), so this costs only the
interviewer's own calls, roughly 25-35 per interview. Whether the agent's choices are good is
measured by `python -m app.eval.simulate_interviews`; this checks what is stored and enforced.
Exit code is non-zero if any check fails.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid

BACKEND = os.getenv("BACKEND_URL", "http://localhost:4000")
STAGES = ["behavioral", "coding", "system_design", "core_cs"]
PACE = 12  # seconds between answers: the interviewer stays under Gemini's 15 requests/minute
ANSWERS = {
    "behavioral": "I led a migration where requirements kept shifting; I wrote a one-page decision log, "
                  "got the two leads to agree on success metrics, and we shipped two weeks early.",
    "coding": "I'd use a hash map from value to index in one pass: O(n) time, O(n) space; "
              "check the complement before inserting to handle duplicates.",
    "system_design": "Shard by user id, cache hot keys in Redis with a TTL, and use a queue for fan-out; "
                     "the trade-off is eventual consistency for the feed.",
    "core_cs": "TCP gives ordered, reliable delivery with retransmission and congestion control; "
               "UDP doesn't, which is why QUIC builds reliability on top of UDP itself.",
}
PASSES, FAILS = [], []


def check(name, condition, detail=""):
    (PASSES if condition else FAILS).append(name)
    print(f"  {'PASS' if condition else 'FAIL'}  {name}{(' -- ' + detail) if detail else ''}")
    return condition


def call(method, path, payload=None, token=None):
    req = urllib.request.Request(f"{BACKEND}{path}", data=json.dumps(payload).encode() if payload is not None else None, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=240) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def main(cap_run):
    suffix = uuid.uuid4().hex[:10]
    _, body = call("POST", "/api/auth/register", {
        "email": f"phase6-{suffix}@example.com", "password": "Str0ngPassw0rd!", "username": f"p6v{suffix}",
    })
    token = body.get("token")
    if not check("registered a throwaway user", bool(token)):
        return

    status, started = call("POST", "/api/interviews", {"company": "google", "mode": "agent", "useResume": False}, token)
    check("agent-mode interview starts", status == 201 and started["session"]["mode"] == "agent", str(status))
    session_id = started["session"]["id"]
    _, got = call("GET", f"/api/interviews/{session_id}", token=token)
    check("the opening question is charged to the session", got["session"]["llm_calls"] >= 1 and got["session"]["llm_cost_usd"] > 0,
          f"{got['session']['llm_calls']} calls, ${got['session']['llm_cost_usd']}")

    stage, notes, previous_cost = "behavioral", [], got["session"]["llm_cost_usd"]
    for _ in range(14):
        time.sleep(PACE)
        status, outcome = call("POST", f"/api/interviews/{session_id}/answer", {"answer": ANSWERS[stage]}, token)
        if not check(f"{stage}: answer accepted", status == 200, json.dumps(outcome)[:160]):
            return
        agent = outcome.get("agent") or {}
        notes.append((stage, outcome["action"], agent.get("decided"), agent.get("rationale", "")))
        print(f"     {stage}: score {outcome['evaluation']['score']} -> {outcome['action']} (agent: {agent.get('decided')})")
        if outcome["action"] == "completed":
            break
        if outcome["action"] == "advance_stage":
            stage = outcome["currentStage"]

    _, got = call("GET", f"/api/interviews/{session_id}", token=token)
    session, messages = got["session"], got["messages"]
    asked = [m for m in messages if m["role"] == "assistant" and m["metadata_json"]["kind"] in ("question", "followup")]
    order = [STAGES.index(m["stage"]) for m in asked]
    check("completed after the last stage", session["status"] == "completed" and notes[-1][0] == "core_cs")
    check("stages in order, all four visited", order == sorted(order) and sorted(set(order)) == [0, 1, 2, 3])
    check("at most 3 questions per stage", all(order.count(i) <= 3 for i in range(4)), str([order.count(i) for i in range(4)]))
    check("every turn carries an agent note", all(n[2] for n in notes))
    check("the session's cost grew with the turns", session["llm_cost_usd"] > previous_cost and session["llm_calls"] > len(notes),
          f"{session['llm_calls']} calls, ${session['llm_cost_usd']:.6f}")
    stored = [m["metadata_json"].get("agent") for m in asked[1:]]
    check("agent questions record the agent's note", any(stored))

    if cap_run:
        consulted = [n for n in notes if n[2] in ("probe", "pivot", "advance", "finish")]
        capped_at = [i for i, n in enumerate(notes) if n[2] == "not_consulted" and "cost cap" in n[3]]
        # The cap applies once spend crosses it: everything after the first capped turn is capped
        # too, except turns where only one move was allowed (also not consulted, for that reason).
        after = notes[capped_at[0]:] if capped_at else []
        check("the cap triggers", bool(capped_at), f"first capped turn {capped_at[0] + 1 if capped_at else None} of {len(notes)}")
        check("past the cap the agent is never consulted again", all(n[2] == "not_consulted" for n in after),
              str([n[2] for n in after]))
        check("and the interview still ran to the end", session["status"] == "completed")
        print(f"     consulted before the cap: {len(consulted)}")

    print(f"\n{len(PASSES)} passed, {len(FAILS)} failed")
    if FAILS:
        print("FAILED: " + "; ".join(FAILS))


if __name__ == "__main__":
    main(cap_run="--cap" in sys.argv)
    sys.exit(1 if FAILS else 0)
