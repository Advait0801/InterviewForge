"""Phase 7 verification: company-filtered practice and stats on the larger problem set.

    python scripts/verify_phase7.py

Run against a live, seeded stack (`docker compose up -d`, then seed_problems.ts).
Problem correctness itself is `scripts/verify_problems.py`; this covers the
remaining Phase 7 checks, through the real HTTP API:

  1. The company filter returns exactly the right set for every tag in the data
     (compared against `backend/leetcode_problems.json`, not against itself),
     case-insensitively, combined with other filters, and rejects bad input.
  2. Company tags are the curated ones (`scripts/problemgen/curation.py`): 3-5 per
     problem, only the 10 interview companies, no tag so broad the filter can't
     narrow, and the seeded database carries them.
  3. Every problem serves an editorial, and it is exactly `backend/problem_editorials.json`
     formatted the way `seed_problems.ts` writes it.
  4. Streak, activity and analytics queries still give correct numbers after real
     submissions -- old problems, new problems, a design problem and a failure.

It creates one throwaway user. Exit code is non-zero if any check fails.
"""
import base64
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.getenv("BACKEND_URL", "http://localhost:4000")

PASSES, FAILS = [], []


def check(name, condition, detail=""):
    (PASSES if condition else FAILS).append(name)
    print(f"  {'PASS' if condition else 'FAIL'}  {name}{(' -- ' + str(detail)) if detail and not condition else ''}")
    return condition


def call(method, path, payload=None, token=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(f"{BACKEND}{path}", data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=240) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as exc:
        body = exc.read()
        try:
            return exc.code, json.loads(body or b"{}")
        except ValueError:
            return exc.code, {"raw": body.decode(errors="replace")}


def list_problems(**params):
    query = urllib.parse.urlencode(params)
    status, body = call("GET", f"/api/problems{'?' + query if query else ''}")
    return status, body.get("problems")


def format_editorial(entry):
    """Mirror of formatEditorial in backend/scripts/seed_problems.ts."""
    if entry is None:
        return None
    steps = "\n".join(f"{i + 1}. {s}" for i, s in enumerate(entry["steps"]))
    return (f"Approach\n{entry['approach']}\n\nKey steps\n{steps}\n\n"
            f"Complexity\nTime: {entry['time']}\nSpace: {entry['space']}")


def reference(slug):
    with open(os.path.join(ROOT, "backend", "reference_solutions", slug, "solution.py")) as handle:
        return handle.read()


def main():
    with open(os.path.join(ROOT, "backend", "leetcode_problems.json")) as handle:
        data = json.load(handle)

    by_slug_json = {p["slug"]: p for p in data}

    print("\n[1] company filter")
    status, everything = list_problems()
    check("unfiltered list returns the whole catalogue", status == 200 and len(everything) == len(data),
          f"{len(everything or [])} of {len(data)}")
    check("list rows now carry companies", all(isinstance(p.get("companies"), list) for p in everything or []))

    tags = sorted({c for p in data for c in p["companies"]})
    print(f"      {len(tags)} tags in the data: {', '.join(tags)}")
    for tag in tags:
        expected = {p["slug"] for p in data if tag in p["companies"]}
        status, rows = list_problems(company=tag)
        got = {p["slug"] for p in rows or []}
        check(f"company={tag} returns exactly its {len(expected)} problems", status == 200 and got == expected,
              f"missing {sorted(expected - got)[:3]} extra {sorted(got - expected)[:3]}" if got != expected else "")

    status, rows = list_problems(company="aMaZoN")
    check("filter is case-insensitive", status == 200 and {p["slug"] for p in rows} == {p["slug"] for p in data if "Amazon" in p["companies"]})

    expected = {p["slug"] for p in data if "Airbnb" in p["companies"] and p["difficulty"] == "hard"}
    status, rows = list_problems(company="Airbnb", difficulty="hard")
    check(f"company + difficulty combine ({len(expected)} problems)", status == 200 and bool(expected) and {p["slug"] for p in rows} == expected)

    expected = {p["slug"] for p in data if "Google" in p["companies"] and "dynamic-programming" in p["topics"]}
    status, rows = list_problems(company="Google", topic="dynamic-programming")
    check(f"company + topic combine ({len(expected)} problems)", status == 200 and bool(expected) and {p["slug"] for p in rows} == expected)

    status, rows = list_problems(company="NoSuchCompany")
    check("unknown company returns an empty list, not an error", status == 200 and rows == [])

    status, rows = list_problems(company="all")
    check("company=all means no filter", status == 200 and len(rows) == len(data))

    status, _ = list_problems(company="x" * 65)
    check("over-long company is rejected with 400", status == 400, status)

    print("\n[2] curated company tags (F-21)")
    sys.path.insert(0, os.path.join(ROOT, "scripts", "problemgen"))
    from curation import ALLOWED_COMPANIES, COMPANY_TAGS, MAX_TAGS, MIN_TAGS
    with open(os.path.join(ROOT, "backend", "src", "services", "interview-state.service.ts")) as handle:
        block = re.search(r"export const COMPANIES = \[(.*?)\]", handle.read(), re.S).group(1)
    interview = set(re.findall(r'"([a-z]+)"', block))
    check("curation's companies are exactly the interview companies",
          {c.lower() for c in ALLOWED_COMPANIES} == interview, sorted(interview ^ {c.lower() for c in ALLOWED_COMPANIES}))
    drift = [p["slug"] for p in data if p["companies"] != COMPANY_TAGS.get(p["slug"])]
    check("leetcode_problems.json matches curation.py for every problem", not drift and len(COMPANY_TAGS) == len(data), drift[:3])
    sizes = [p["slug"] for p in data if not MIN_TAGS <= len(p["companies"]) <= MAX_TAGS]
    check(f"every problem has {MIN_TAGS}-{MAX_TAGS} companies", not sizes, sizes[:3])
    outsiders = sorted({c for p in data for c in p["companies"]} - set(ALLOWED_COMPANIES))
    check("no tag outside the 10 interview companies", not outsiders, outsiders)
    counts = {c: sum(c in p["companies"] for p in data) for c in ALLOWED_COMPANIES}
    print("      " + ", ".join(f"{c} {n}" for c, n in sorted(counts.items(), key=lambda kv: -kv[1])))
    ceiling = len(data) * 2 // 3
    check(f"no company on more than {ceiling} of {len(data)} problems (the filter must narrow)",
          max(counts.values()) <= ceiling, max(counts, key=counts.get))
    check("every company has at least 15 problems to practise", min(counts.values()) >= 15, min(counts, key=counts.get))
    api_drift = [p["slug"] for p in everything or [] if p["companies"] != by_slug_json[p["slug"]]["companies"]]
    check("seeded database carries the curated tags", not api_drift, api_drift[:3])

    print("\n[3] editorials (F-22)")
    with open(os.path.join(ROOT, "backend", "problem_editorials.json")) as handle:
        editorials = json.load(handle)
    check("problem_editorials.json covers exactly the catalogue", set(editorials) == set(by_slug_json),
          f"missing {sorted(set(by_slug_json) - set(editorials))[:3]} extra {sorted(set(editorials) - set(by_slug_json))[:3]}")
    malformed = [s for s, e in editorials.items()
                 if set(e) != {"approach", "steps", "time", "space"} or not 3 <= len(e["steps"]) <= 5
                 or not e["time"].startswith("O(") or not e["space"].startswith("O(")]
    check("every editorial has an approach, 3-5 steps, and time/space complexity", not malformed, malformed[:3])
    wrong, unreadable = [], {}
    for row in everything or []:
        status, body = call("GET", f"/api/problems/{row['id']}")
        if status != 200:
            # Not a content verdict. 429 means the run exceeded apiLimiter (500 requests per
            # 15 minutes per client); this section alone makes one request per problem.
            unreadable.setdefault(status, []).append(row["slug"])
            continue
        if (body.get("problem") or body).get("editorial") != format_editorial(editorials.get(row["slug"])):
            wrong.append(row["slug"])
    check(f"GET /api/problems/:id answered for all {len(everything or [])} problems", not unreadable,
          {s: f"{len(v)} e.g. {v[:2]}" for s, v in unreadable.items()}
          | ({"hint": "rate limited -- wait out the window or restart the backend"} if 429 in unreadable else {}))
    check("every served editorial is exactly the formatted problem_editorials.json entry", not wrong, wrong[:3])

    print("\n[4] stats, streak and analytics after real submissions")
    suffix = uuid.uuid4().hex[:10]
    status, body = call("POST", "/api/auth/register", {
        "email": f"phase7-{suffix}@example.com", "password": "Str0ngPassw0rd!", "username": f"p7{suffix}",
    })
    token = body.get("token")
    if not check("register a throwaway user", status in (200, 201) and bool(token), status):
        return
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    print(f"      user {json.loads(base64.urlsafe_b64decode(payload)).get('userId')}")

    status, before = call("GET", "/api/users/stats", token=token)
    check("fresh user starts at zero", status == 200 and before.get("problemsSolved") == 0 and before.get("bestStreak") == 0, before)

    ids = {p["slug"]: p["id"] for p in everything}
    by_slug = {p["slug"]: p for p in data}
    # An original problem, two new ones (one of them a design problem), and a failure.
    passing = ["two-sum", "valid-anagram", "lfu-cache"]
    for slug in passing:
        status, body = call("POST", "/api/submissions", {
            "problemId": ids[slug], "language": "python3", "code": reference(slug), "mode": "submit",
        }, token=token)
        verdict = (body.get("submission") or body).get("status")
        check(f"submit reference solution for {slug}", status in (200, 201) and verdict == "passed", f"{status} {verdict}")

    status, body = call("POST", "/api/submissions", {
        "problemId": ids["add-binary"], "language": "python3", "mode": "submit",
        "code": "class Solution:\n    def addBinary(self, a, b):\n        return a\n",
    }, token=token)
    verdict = (body.get("submission") or body).get("status")
    check("a wrong solution is recorded as not passed", status in (200, 201) and verdict not in (None, "passed"), f"{status} {verdict}")

    status, stats = call("GET", "/api/users/stats", token=token)
    check("stats: problemsSolved = 3", status == 200 and stats.get("problemsSolved") == 3, stats)
    check("stats: problemsAttempted = 4", stats.get("problemsAttempted") == 4)
    check("stats: submissionsCount = 4, acceptanceRate = 75", stats.get("submissionsCount") == 4 and stats.get("acceptanceRate") == 75)
    check("stats: bestStreak = 1", stats.get("bestStreak") == 1)

    status, activity = call("GET", "/api/users/activity", token=token)
    check("activity: currentStreak = 1", status == 200 and activity.get("currentStreak") == 1, activity.get("currentStreak"))
    check("activity: heatmap counts all 4 submissions", sum((activity.get("activityMap") or {}).values()) == 4)

    status, analytics = call("GET", "/api/users/analytics", token=token)
    expected_diff = {}
    for slug in passing:
        expected_diff[by_slug[slug]["difficulty"]] = expected_diff.get(by_slug[slug]["difficulty"], 0) + 1
    check(f"analytics: difficulty distribution = {expected_diff}", status == 200 and analytics.get("difficultyDistribution") == expected_diff,
          analytics.get("difficultyDistribution"))
    topics = {t["topic"] for t in analytics.get("topicStrengths") or []}
    check("analytics: topic strengths include a new problem's topic (design)", "design" in topics, sorted(topics))
    check("analytics: solvedOverTime totals 3", sum(d["count"] for d in analytics.get("solvedOverTime") or []) == 3)

    status, board = call("GET", "/api/leaderboard")
    check("leaderboard still responds", status == 200, status)

    status, solved = call("GET", "/api/problems?solved=solved", token=token)
    check("solved filter returns exactly the 3 solved problems",
          status == 200 and {p["slug"] for p in solved.get("problems", [])} == set(passing))


if __name__ == "__main__":
    main()
    print(f"\nRESULT: {len(PASSES)} passed, {len(FAILS)} failed")
    for name in FAILS:
        print(f"  failed: {name}")
    sys.exit(1 if FAILS else 0)
