"""Group D, Phase 12 verification: Elo-rated adaptive difficulty, live (D-076).

    python scripts/verify_elo.py

Run against a live stack with migration 020 applied. No model calls; registers two
throwaway users. Whether the picker hits its target success rate is a simulation question
(`cd backend && npx ts-node scripts/simulate_elo.ts`); this checks what is stored and served.

Checks:
  1. A new user is at the start rating, and is offered the problems closest to 65% predicted
     success (0.5 while every problem is still at its label's rating).
  2. A first Submit is a rated game: the response carries it, ratings move, the problem's
     rating moves the other way; a second Submit of the same problem is not rated.
  3. A fail lowers the rating; /ratings/me reflects both games; /ratings/next never offers
     a problem the user has submitted, and filters by topic.
  4. Two simultaneous first Submits of one problem produce exactly one rated game.
  5. No `openapi_violation` in the backend log for this run.
"""
import json
import os
import subprocess
import sys
import threading
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone

BACKEND = os.getenv("BACKEND_URL", "http://localhost:4000")
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
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
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def register():
    suffix = uuid.uuid4().hex[:10]
    status, body = call("POST", "/api/auth/register", {
        "email": f"phase12e-{suffix}@example.com", "password": "Str0ngPassw0rd!", "username": f"p12e{suffix}",
    })
    if status != 201:
        raise SystemExit(f"registration failed: {status} {body}")
    return body["token"]


def psql(sql):
    return subprocess.run(["docker", "compose", "exec", "-T", "postgres", "psql", "-U", "postgres", "-d", "interviewforge", "-At", "-c", sql],
                          cwd=ROOT, capture_output=True, text=True).stdout.strip()


def reference(slug):
    with open(os.path.join(ROOT, "backend", "reference_solutions", slug, "solution.py")) as handle:
        return handle.read()


def main():
    started = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    _, body = call("GET", "/api/problems")
    problems = {p["slug"]: p for p in body["problems"]}
    token = register()

    def submit(slug, code, tok=None):
        return call("POST", "/api/submissions", {"problemId": problems[slug]["id"], "language": "python3", "code": code}, tok or token)

    print("1. A new user")
    status, me = call("GET", "/api/ratings/me", token=token)
    check("starts at 1500 with no topics", status == 200 and me == {"overall": {"rating": 1500, "games": 0}, "topics": []}, me)
    status, nxt = call("GET", "/api/ratings/next", token=token)
    picks = nxt.get("picks", [])
    # Unplayed problems sit at their label's rating (1200/1500/1800), so a new user's choices
    # are 0.849, 0.5 or 0.151: the closest to 0.65 is a medium at 0.5. Picks reach 0.65 as
    # the user's and the problems' ratings spread with play (the simulation measures that).
    closest = min({p["predictedSuccess"] for p in picks}, key=lambda x: abs(x - 0.65))
    check("is offered the problems closest to 65% that exist", status == 200 and len(picks) == 3
          and all(abs(p["predictedSuccess"] - 0.65) <= abs(closest - 0.65) + 1e-9 for p in picks[:1]),
          [(p["problem"]["slug"], p["predictedSuccess"]) for p in picks])
    first = picks[0]["problem"]["slug"]

    print("2. A first Submit is a rated game")
    before_problem = psql(f"SELECT COALESCE((SELECT rating FROM problem_ratings WHERE problem_id = '{problems[first]['id']}'), -1)")
    status, sub = submit(first, reference(first))
    rating = sub.get("rating") or {}
    check(f"passing {first} is rated", status == 201 and sub["status"] == "passed" and rating.get("score") == 1 and rating.get("delta", 0) > 0, rating)
    check("the predicted chance matches what /next offered", abs(rating.get("expected", 0) - picks[0]["predictedSuccess"]) < 0.002,
          (rating.get("expected"), picks[0]["predictedSuccess"]))
    after_problem = float(psql(f"SELECT rating FROM problem_ratings WHERE problem_id = '{problems[first]['id']}'") or 0)
    check("the problem's rating moved the other way", after_problem < (float(before_problem) if float(before_problem) > 0 else 9e9), (before_problem, after_problem))
    status, again = submit(first, reference(first))
    check("a second Submit of it is not rated", status == 201 and again.get("rating") is None, again.get("rating"))
    games = psql(f"SELECT COUNT(*) FROM rated_games g JOIN users u ON u.id = g.user_id WHERE g.problem_id = '{problems[first]['id']}' AND u.id = (SELECT user_id FROM submissions WHERE id = '{sub['submissionId']}')")
    check("one rated game stored", games == "1", games)

    print("3. A fail, /me and /next")
    _, nxt = call("GET", "/api/ratings/next", token=token)
    second = nxt["picks"][0]["problem"]["slug"]
    status, sub = submit(second, "class Solution:\n    pass\n")
    check(f"failing {second} lowers the rating", status == 201 and sub["status"] == "failed" and (sub.get("rating") or {}).get("delta", 0) < 0, sub.get("rating"))
    _, me = call("GET", "/api/ratings/me", token=token)
    check("/ratings/me counts both games", me["overall"]["games"] == 2 and me["topics"], me)
    _, nxt = call("GET", "/api/ratings/next", token=token)
    offered = {p["problem"]["slug"] for p in nxt["picks"]}
    check("/ratings/next never offers a submitted problem", not offered & {first, second}, offered)
    topic = problems[first]["topics"][0] if problems[first].get("topics") else "array"
    _, by_topic = call("GET", f"/api/ratings/next?topic={topic}", token=token)
    check(f"and filters by topic ({topic})", by_topic["picks"] and all(topic in p["problem"]["topics"] for p in by_topic["picks"]), by_topic["picks"][:1])
    status, _ = call("GET", "/api/ratings/next?topic=" + "x" * 65, token=token)
    check("a 65-character topic is a 400", status == 400)

    print("4. Racing first Submits (5 races, each on a fresh problem)")
    racer = register()
    outcomes = []
    for race in range(5):
        _, nxt = call("GET", "/api/ratings/next", token=racer)
        slug = nxt["picks"][0]["problem"]["slug"]
        out = []
        threads = [threading.Thread(target=lambda: out.append(submit(slug, reference(slug), racer))) for _ in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        ok = [b for s, b in out if s == 201]
        sub_ids = ",".join(f"'{b['submissionId']}'" for b in ok) or "NULL"
        rows = psql(f"SELECT COUNT(*) FROM rated_games WHERE problem_id = '{problems[slug]['id']}' AND submission_id IN ({sub_ids})")
        outcomes.append((slug, [s for s, _ in out], sum(b.get("rating") is not None for b in ok), rows))
    check("every racing pair is stored (no deadlock, no 500)", all(statuses == [201, 201] for _, statuses, _, _ in outcomes), outcomes)
    check("each race rates exactly one submission and stores one game", all(n == 1 and rows == "1" for _, _, n, rows in outcomes), outcomes)
    _, me = call("GET", "/api/ratings/me", token=racer)
    check("the racer's overall games equal the races", me["overall"]["games"] == 5, me["overall"])

    print("5. Contract")
    logs = subprocess.run(["docker", "compose", "logs", "--since", started, "backend"], cwd=ROOT, capture_output=True, text=True).stdout
    check("no openapi_violation in the backend log", "openapi_violation" not in logs)


if __name__ == "__main__":
    main()
    print(f"\n{len(PASSES)} passed, {len(FAILS)} failed")
    if FAILS:
        print("FAILED: " + "; ".join(FAILS))
    sys.exit(1 if FAILS else 0)
