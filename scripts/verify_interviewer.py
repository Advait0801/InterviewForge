"""Phase 5 verification: personas, the hint ladder and the grounded challenge, live (D-066).

    python scripts/verify_interviewer.py
    python scripts/verify_interviewer.py --challenge   # backend must run with INTERVIEW_CHALLENGE_ENABLED=true

Run against a live stack. It makes about ten cheap model calls, waits out the hint unlock
time (HINT_UNLOCK_SECONDS, default 30) twice, and registers one throwaway user. The model's
own quality is measured by `python -m app.eval.interviewer`; this checks the wiring:
what is stored, what is returned, and what is refused.
Exit code is non-zero if any check fails.
"""
import calendar
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from verify_streaming import Stream  # noqa: E402  (same directory)

BACKEND = os.getenv("BACKEND_URL", "http://localhost:4000")
UNLOCK = int(os.getenv("HINT_UNLOCK_SECONDS", "30"))
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
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def main(challenge):
    suffix = uuid.uuid4().hex[:10]
    _, body = call("POST", "/api/auth/register", {
        "email": f"phase5-{suffix}@example.com", "password": "Str0ngPassw0rd!", "username": f"p5i{suffix}",
    })
    token = body.get("token")
    if not check("registered a throwaway user", bool(token)):
        return

    print("\n1. Personas")
    status, bad = call("POST", "/api/interviews", {"company": "amazon", "persona": "rude"}, token)
    check("unknown persona: 400", status == 400 and "adversarial" in bad.get("error", ""))
    status, started = call("POST", "/api/interviews", {"company": "google", "persona": "terse"}, token)
    check("JSON start stores the persona", status == 201 and started["session"]["persona"] == "terse")
    print(f"     terse opening question: {started['openingQuestion']['question'][:160]!r}")
    stream = Stream(BACKEND, "/api/interviews/stream", {"company": "meta", "persona": "friendly"}, token)
    events = stream.read_all()
    done = events[-1]
    check("stream start stores the persona", done["type"] == "done" and done["result"]["session"]["persona"] == "friendly")
    if done["type"] == "done":
        print(f"     friendly opening question: {done['result']['openingQuestion']['question'][:160]!r}")
    session_id = started["session"]["id"]
    status, got = call("GET", f"/api/interviews/{session_id}", token=token)
    check("GET session returns the persona", got["session"]["persona"] == "terse")
    _, listed = call("GET", "/api/interviews", token=token)
    check("session list returns the persona", {s["persona"] for s in listed["sessions"]} == {"terse", "friendly"})

    print(f"\n2. Hint ladder (unlocks every {UNLOCK}s)")
    status, locked = call("POST", f"/api/interviews/{session_id}/hint", {}, token)
    check("too early: 409 hint_locked with availableAt", status == 409 and locked.get("code") == "hint_locked"
          and "availableAt" in locked, json.dumps(locked)[:160])
    opens = calendar.timegm(time.strptime(locked["availableAt"][:19], "%Y-%m-%dT%H:%M:%S"))
    wait = max(0.0, opens - time.time() + 1.5)
    print(f"     waiting {wait:.0f}s for the first rung")
    time.sleep(wait)
    status, first = call("POST", f"/api/interviews/{session_id}/hint", {"draft": "I'd start by telling the story of"}, token)
    check("first rung after the wait", status == 200 and first["level"] == 1 and first["hintsRemaining"] == 2
          and first["penalty"] == 1, json.dumps(first)[:200])
    print(f"     hint 1: {first.get('hint', '')[:200]!r}")
    status, again = call("POST", f"/api/interviews/{session_id}/hint", {}, token)
    check("second rung is locked again right after the first", status == 409 and again.get("code") == "hint_locked")
    time.sleep(UNLOCK + 1.5)
    status, second = call("POST", f"/api/interviews/{session_id}/hint", {}, token)
    check("second rung after another wait", status == 200 and second["level"] == 2, json.dumps(second)[:200])
    print(f"     hint 2: {second.get('hint', '')[:200]!r}")
    _, got = call("GET", f"/api/interviews/{session_id}", token=token)
    hints = [m for m in got["messages"] if m["metadata_json"]["kind"] == "hint"]
    check("both hints are in the transcript, in order", [h["metadata_json"]["level"] for h in hints] == [1, 2])

    status, outcome = call("POST", f"/api/interviews/{session_id}/answer", {
        "answer": "At my last job I owned a flaky deploy pipeline nobody wanted. I measured failure causes for two weeks, "
                  "fixed the top three, and cut failed deploys from 20% to 3%. I learned to quantify before fixing.",
    }, token)
    evaluation = outcome.get("evaluation", {})
    check("the answer's score carries the 2-point penalty", status == 200 and evaluation.get("hintsUsed") == 2
          and evaluation.get("score") == max(1, evaluation.get("rawScore", 0) - 2), json.dumps(evaluation)[:200])
    _, got = call("GET", f"/api/interviews/{session_id}", token=token)
    stored = [m for m in got["messages"] if m["metadata_json"]["kind"] == "evaluation"][-1]
    check("the stored evaluation records raw score and penalty", stored["metadata_json"].get("hintPenalty") == evaluation.get("hintPenalty")
          and "Hints used: 2" in stored["content"])
    if outcome.get("action") in ("followup", "advance_stage"):
        status, fresh = call("POST", f"/api/interviews/{session_id}/hint", {}, token)
        check("the next question starts a fresh ladder (locked, not exhausted)", status == 409 and fresh.get("code") == "hint_locked")

    if challenge:
        print("\n3. Grounded challenge (INTERVIEW_CHALLENGE_ENABLED=true)")
        status, s2 = call("POST", "/api/interviews", {"company": "amazon", "useResume": False}, token)
        sid = s2["session"]["id"]
        _, got = call("GET", f"/api/interviews/{sid}", token=token)
        context = got["messages"][0]["metadata_json"]["context"]
        print(f"     question: {s2['openingQuestion']['question'][:140]!r}")
        print(f"     context starts: {context[:140]!r}")
        answer = ("Amazon doesn't use the STAR method or its Leadership Principles in interviews at all; "
                  "they only ask about technical skills, so I'll just list the tools I know.")
        stream = Stream(BACKEND, f"/api/interviews/{sid}/answer/stream", {"answer": answer}, token)
        events = stream.read_all()
        done = events[-1]
        result = done.get("result", {})
        challenged = result.get("nextQuestion", {}).get("challenge")
        check("a turn with the challenge enabled completes", done["type"] == "done", json.dumps(done)[:200])
        print(f"     action {result.get('action')}; challenged: {bool(challenged)}")
        if challenged:
            print(f"     claim {challenged['claim']!r}\n     evidence {challenged['evidence']!r}")
            print(f"     pushback {result['nextQuestion']['question']!r}")
            check("the challenge's quotes really are in the answer and the context",
                  challenged["claim"].lower()[:20] in answer.lower() and challenged["evidence"].lower()[:20] in context.lower())

    print(f"\n{len(PASSES)} passed, {len(FAILS)} failed")
    if FAILS:
        print("FAILED: " + "; ".join(FAILS))


if __name__ == "__main__":
    main(challenge="--challenge" in sys.argv)
    sys.exit(1 if FAILS else 0)
