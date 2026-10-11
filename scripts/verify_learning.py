"""Group C, Phase 8 verification: problem of the day, the SM-2 review queue, personal paths (D-070).

    python scripts/verify_learning.py

Run against a live stack (`docker compose up -d`, migration 017 applied, problems seeded, the
sandbox images built). No model calls. Registers three throwaway users. Review intervals are
days long, so the script moves due dates back in Postgres (`docker compose exec postgres`) to
stand in for waiting; nothing else is written behind the API's back.

What it checks, through the real HTTP API, queue, sandboxes and Postgres:
  1. Problem of the day: stable across requests, the weekday's difficulty, recorded in
     daily_problems; a past date works, a future one is a 400; concurrent first requests for an
     unrecorded day agree; the history has no repeat within a difficulty.
  2. Solving today's problem today: solvedOnDay, solved, streak 1 -- and only for that user.
  3. Review queue: a failure enrols (due tomorrow); a clean first pass doesn't; a pass after hints
     enrols as struggled; passing early changes nothing; passing when due walks SM-2's intervals
     1 -> 6 -> round(6 x EF); a failure on a queued problem is a lapse; manual add and remove.
  4. Personal path: 409 without history; built from the weak topic; deterministic (rebuilding
     gives the same problems); private (another user gets 404 and never sees it listed);
     progress counts on it when a path problem is solved.
  5. No `openapi_violation` in the backend log for this run.
Exit code is non-zero if any check fails.
"""
import base64
import json
import os
import subprocess
import sys
import threading
import urllib.error
import urllib.request
import uuid
from datetime import date, datetime, timedelta, timezone

BACKEND = os.getenv("BACKEND_URL", "http://localhost:4000")
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DIFFICULTY_BY_WEEKDAY = ["easy", "easy", "medium", "medium", "medium", "hard", "hard"]  # Python: Monday = 0

PASSES, FAILS = [], []


def check(name, condition, detail=""):
    (PASSES if condition else FAILS).append(name)
    print(f"  {'PASS' if condition else 'FAIL'}  {name}{(' -- ' + str(detail)) if detail else ''}")
    return condition


def call(method, path, payload=None, token=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(f"{BACKEND}{path}", data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def psql(sql):
    out = subprocess.run(
        ["docker", "compose", "exec", "-T", "postgres", "psql", "-U", "postgres", "-d", "interviewforge", "-tAc", sql],
        cwd=ROOT, capture_output=True, text=True, check=True,
    )
    return out.stdout.strip()


def register(label):
    suffix = uuid.uuid4().hex[:10]
    status, body = call("POST", "/api/auth/register", {
        "email": f"p8{label}-{suffix}@example.com", "password": "Str0ngPassw0rd!", "username": f"p8{label}{suffix}"[:20],
    })
    token = body["token"]
    payload = token.split(".")[1]
    user_id = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))["userId"]
    return token, user_id


def solution(slug):
    with open(os.path.join(ROOT, "backend", "reference_solutions", slug, "solution.py")) as handle:
        return handle.read()


WRONG = "class Solution:\n    pass\n"


def main():
    started = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    today = datetime.now(timezone.utc).date()
    alice, alice_id = register("a")
    bob, _ = register("b")
    status, body = call("GET", "/api/problems")
    problems = {p["slug"]: p for p in body.get("problems", [])}
    check("registered users; 150 problems", len(problems) == 150, len(problems))

    def submit(token, slug, code):
        return call("POST", "/api/submissions", {"problemId": problems[slug]["id"], "language": "python3", "code": code}, token)

    print("\n1. Problem of the day")
    s1, d1 = call("GET", "/api/problems/daily")
    s2, d2 = call("GET", "/api/problems/daily")
    check("today's problem: 200, the same on every request", s1 == s2 == 200 and d1["problem"]["id"] == d2["problem"]["id"], d1.get("problem", {}).get("slug"))
    check("it has the weekday's difficulty", d1["problem"]["difficulty"] == DIFFICULTY_BY_WEEKDAY[today.weekday()],
          (today.isoformat(), d1["problem"]["difficulty"]))
    check("the date is today in UTC", d1["date"] == today.isoformat(), d1["date"])
    stored = psql(f"SELECT problem_id FROM daily_problems WHERE day = '{today.isoformat()}'")
    check("recorded in daily_problems", stored == d1["problem"]["id"], stored)
    status, _ = call("GET", f"/api/problems/daily?date={(today + timedelta(days=1)).isoformat()}")
    check("a future date is a 400", status == 400, status)

    # A day nobody has asked for yet: two simultaneous first requests must agree.
    fresh = (today - timedelta(days=300)).isoformat()
    psql(f"DELETE FROM daily_problems WHERE day = '{fresh}'")
    answers = []
    threads = [threading.Thread(target=lambda: answers.append(call("GET", f"/api/problems/daily?date={fresh}"))) for _ in range(6)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    ids = {b["problem"]["id"] for s, b in answers if s == 200}
    check("6 concurrent first requests for an unrecorded day all get the same problem", len(ids) == 1 and len(answers) == 6, ids)
    check("...and exactly one row was recorded", psql(f"SELECT COUNT(*) FROM daily_problems WHERE day = '{fresh}'") == "1")

    status, hist = call("GET", "/api/problems/daily/history?days=60")
    days = hist.get("days", [])
    check("history: 60 days, newest first", status == 200 and len(days) == 60 and days[0]["date"] == today.isoformat())
    by_difficulty = {}
    for d in days:
        by_difficulty.setdefault(d["problem"]["difficulty"], []).append(d["problem"]["slug"])
    repeats = {k: len(v) - len(set(v)) for k, v in by_difficulty.items()}
    check("no problem repeats within 60 days (each difficulty's pool is 43+)", not any(repeats.values()), repeats)

    print("\n2. Solving today's problem")
    slug = d1["problem"]["slug"]
    status, body = submit(alice, slug, solution(slug))
    check("Alice solves it", status == 201 and body.get("status") == "passed", status)
    _, mine = call("GET", "/api/problems/daily", token=alice)
    check("solved today, solved, streak 1", mine.get("solvedOnDay") and mine.get("solved") and mine.get("streak") == {"current": 1, "best": 1}, mine)
    _, theirs = call("GET", "/api/problems/daily", token=bob)
    check("Bob's view is his own", theirs.get("solvedOnDay") is False and theirs.get("streak") == {"current": 0, "best": 0}, theirs)

    print("\n3. Review queue")
    status, body = submit(alice, "valid-parentheses", WRONG)
    check("a failure enrols the problem, due tomorrow",
          body.get("review", {}).get("action") == "enrolled" and body["review"].get("dueOn") == (today + timedelta(days=1)).isoformat(), body.get("review"))
    _, q = call("GET", "/api/review", token=alice)
    upcoming = [i["slug"] for i in q.get("upcoming", [])]
    check("it's upcoming, not due", "valid-parentheses" in upcoming and not any(i["slug"] == "valid-parentheses" for i in q.get("due", [])), q.get("counts"))

    status, body = submit(alice, "valid-parentheses", solution("valid-parentheses"))
    check("passing before it's due changes nothing", body.get("review", {}).get("action") == "unchanged", body.get("review"))

    def make_due(slug):
        psql(f"UPDATE review_items SET due_on = CURRENT_DATE - 1 WHERE user_id = '{alice_id}' AND problem_id = '{problems[slug]['id']}'")

    intervals = []
    for _ in range(3):
        make_due("valid-parentheses")
        _, body = submit(alice, "valid-parentheses", solution("valid-parentheses"))
        intervals.append((body.get("review") or {}).get("intervalDays"))
    ef = float(psql(f"SELECT ease_factor FROM review_items WHERE user_id = '{alice_id}' AND problem_id = '{problems['valid-parentheses']['id']}'"))
    # After the enrolling lapse EF is 1.96; three clean passes add 0.1 each (2.06, 2.16, 2.26), and the
    # third interval uses the EF updated by that review: round(6 * 2.26) = 14.
    check("passes when due walk SM-2's intervals: 1, 6, round(6 x EF)", intervals == [1, 6, round(6 * ef)], (intervals, ef))

    make_due("valid-parentheses")
    _, body = submit(alice, "valid-parentheses", WRONG)
    check("a failure on a queued problem is a lapse: back to 1 day", body.get("review", {}).get("action") == "lapsed" and body["review"]["intervalDays"] == 1, body.get("review"))

    _, body = submit(alice, "two-sum", solution("two-sum"))
    check("a clean first pass never enters the queue", body.get("review") is None, body.get("review"))

    status, _ = call("POST", f"/api/problems/{problems['climbing-stairs']['id']}/hints/viewed", {"count": 1}, alice)
    _, body = submit(alice, "climbing-stairs", solution("climbing-stairs"))
    check("a pass after a hint enrols it as struggled, graded 4",
          status == 200 and body.get("review", {}).get("action") == "enrolled" and body["review"]["quality"] == 4, body.get("review"))

    pid = problems["coin-change"]["id"]
    s_add, add = call("POST", f"/api/review/{pid}", token=alice)
    s_again, again = call("POST", f"/api/review/{pid}", token=alice)
    _, q = call("GET", "/api/review", token=alice)
    check("manual add: 201, then 200; due today", s_add == 201 and add == {"added": True} and s_again == 200 and again == {"added": False}
          and any(i["slug"] == "coin-change" and i["source"] == "manual" for i in q["due"]), q.get("counts"))
    s_del, _ = call("DELETE", f"/api/review/{pid}", token=alice)
    s_del2, _ = call("DELETE", f"/api/review/{pid}", token=alice)
    check("remove: 200, then 404", s_del == 200 and s_del2 == 404, (s_del, s_del2))
    _, bobq = call("GET", "/api/review", token=bob)
    check("Bob's queue is empty", bobq.get("counts") == {"due": 0, "total": 0}, bobq.get("counts"))

    print("\n4. Personal path")
    status, body = call("POST", "/api/learning-paths/generate", token=bob)
    check("no history: 409 not_enough_history", status == 409 and body.get("code") == "not_enough_history", body)

    status, gen = call("POST", "/api/learning-paths/generate", token=alice)
    path, steps = gen.get("path", {}), gen.get("problems", [])
    focus = [f["topic"] for f in path.get("focusTopics", [])]
    check("201: a personal path built from weak topics", status == 201 and path.get("isPersonal") and focus, (status, focus))
    check("the weakest topic comes from Alice's failures (valid-parentheses: string, stack)", focus and focus[0] in ("stack", "string"), focus)
    solved_ids = set(psql(f"SELECT DISTINCT problem_id FROM submissions WHERE user_id = '{alice_id}' AND status = 'passed'").split())
    check("every problem is unsolved and practises a focus topic",
          steps and all(s["problemId"] not in solved_ids and s.get("focusTopic") in focus for s in steps), [s["slug"] for s in steps][:5])
    status, gen2 = call("POST", "/api/learning-paths/generate", token=alice)
    check("rebuilding with the same history gives the same path", status == 201 and [s["slug"] for s in gen2["problems"]] == [s["slug"] for s in steps])
    owned = psql(f"SELECT COUNT(*) FROM learning_paths WHERE owner_user_id = '{alice_id}'")
    check("one personal path per user (rebuilding replaced it)", owned == "1", owned)

    slug = path["slug"]
    s_bob, _ = call("GET", f"/api/learning-paths/{slug}", token=bob)
    s_anon, _ = call("GET", f"/api/learning-paths/{slug}")
    _, bob_list = call("GET", "/api/learning-paths", token=bob)
    _, alice_list = call("GET", "/api/learning-paths", token=alice)
    check("private: Bob and anonymous get 404", s_bob == 404 and s_anon == 404, (s_bob, s_anon))
    check("listed first for Alice, never for Bob",
          alice_list["paths"][0]["slug"] == slug and not any(p["slug"] == slug for p in bob_list["paths"]))

    first = steps[0]["slug"]
    status, body = submit(alice, first, solution(first))
    _, after = call("GET", f"/api/learning-paths/{slug}", token=alice)
    check(f"solving a path problem ({first}) counts on the path", status == 201 and body.get("status") == "passed" and after["path"]["completedCount"] == 1,
          after.get("path", {}).get("completedCount"))
    others = psql(f"SELECT COUNT(*) FROM user_path_progress upp JOIN learning_paths lp ON lp.id = upp.path_id "
                  f"WHERE lp.owner_user_id IS NOT NULL AND lp.owner_user_id <> upp.user_id")
    check("no progress row anywhere on someone else's personal path", others == "0", others)

    print("\n5. Contract")
    logs = subprocess.run(["docker", "compose", "logs", "--since", started, "backend"], cwd=ROOT, capture_output=True, text=True).stdout
    check("no openapi_violation in the backend log for this run", logs.count("openapi_violation") == 0, logs.count("openapi_violation"))

    print(f"\n{len(PASSES)} passed, {len(FAILS)} failed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
