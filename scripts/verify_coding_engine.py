"""Group C, Phase 7 verification: custom test cases, failing-case diffs, JavaScript/Go/Rust.

    python scripts/verify_coding_engine.py

Run against a live stack (`docker compose up -d`, problems seeded, the seven sandbox images
built). No model calls. Registers one throwaway user. About 190 API requests, most of them
the starter-code sweep (apiLimiter allows 500 per 15 minutes).

What it checks, through the real HTTP API, queue and sandboxes:
  1. Every problem serves starter code in all seven languages, identical to
     starter_templates.json.
  2. Each language's reference solution passes Run and Submit for problems that exercise
     different harness paths (list, tree, design, in-place, double).
  3. Custom inputs: judged against the reference solution's output, returned separately
     from the examples, with a diff when wrong. A malformed input is a 400 naming it and
     runs nothing; an input the reference can't run comes back unjudged; Submit refuses
     custom inputs; the limits hold.
  4. Diffs: a wrong Run carries one per failing example. A wrong Submit reveals the first
     failing hidden case with its diff, and every other hidden case is exactly
     `{ passed, hidden: true }`.
  5. Run latency with and without custom inputs (medians of 3).
  6. No `openapi_violation` in the backend log for this run.
Exit code is non-zero if any check fails.
"""
import json
import os
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone

BACKEND = os.getenv("BACKEND_URL", "http://localhost:4000")
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
LANGS = ["python3", "c", "cpp", "java", "javascript", "go", "rust"]
EXT = {"python3": "py", "c": "c", "cpp": "cpp", "java": "java", "javascript": "js", "go": "go", "rust": "rs"}

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


def solution(slug, lang):
    with open(os.path.join(ROOT, "backend", "reference_solutions", slug, f"solution.{EXT[lang]}")) as handle:
        return handle.read()


def main():
    started = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    suffix = uuid.uuid4().hex[:10]
    status, body = call("POST", "/api/auth/register", {
        "email": f"phase7-{suffix}@example.com", "password": "Str0ngPassw0rd!", "username": f"p7{suffix}",
    })
    token = body.get("token")
    if not check("registered a test user", status == 201 and token, status):
        return 1

    status, body = call("GET", "/api/problems")
    ids = {p["slug"]: p["id"] for p in body.get("problems", [])}
    check("problem list has all 150", len(ids) == 150, len(ids))

    def submit(slug, lang, code, mode="submit", **extra):
        return call("POST", "/api/submissions", {"problemId": ids[slug], "language": lang, "code": code, "mode": mode, **extra}, token)

    print("\n1. Starter code")
    with open(os.path.join(ROOT, "backend", "starter_templates.json")) as handle:
        templates = json.load(handle)
    wrong, unreadable = [], {}
    for slug, pid in ids.items():
        status, body = call("GET", f"/api/problems/{pid}")
        if status != 200:
            unreadable.setdefault(status, []).append(slug)
            continue
        starter = body["problem"].get("starter_code") or {}
        if set(starter) != set(LANGS) or any(starter[l] != templates[slug][l] for l in LANGS):
            wrong.append(slug)
    check("every problem serves starter code in all 7 languages, matching starter_templates.json",
          not wrong and not unreadable, {"wrong": wrong[:3], "unreadable": {k: len(v) for k, v in unreadable.items()}})

    print("\n2. Each language, Run and Submit, through the queue")
    for slug in ["merge-k-sorted-lists", "serialize-and-deserialize-binary-tree", "rotate-image", "find-median-from-data-stream"]:
        bad = []
        for lang in LANGS:
            code = solution(slug, lang)
            rs, rb = submit(slug, lang, code, mode="run")
            ss, sb = submit(slug, lang, code)
            if not (rs == 200 and rb.get("passed") and rb.get("customResults") == [] and ss == 201 and sb.get("status") == "passed"):
                bad.append((lang, rs, ss, sb.get("error")))
        check(f"{slug}: all 7 languages pass Run and Submit", not bad, bad)

    print("\n3. Custom inputs")
    two_sum_js = solution("two-sum", "javascript")
    inputs = ["nums = [3, 3], target = 6", "target = 14, nums = [1, 5, 9]", "nums = [-4, 10, 8, 2], target = 10"]
    status, body = submit("two-sum", "javascript", two_sum_js, mode="run", customInputs=inputs)
    custom = body.get("customResults", [])
    check("a correct solution: 200, examples and custom cases both pass", status == 200 and body.get("passed"), status)
    check("custom results come back separately, in order, after 4 examples",
          len(body.get("results", [])) == 4 and len(body.get("testCases", [])) == 4 and [c.get("input") for c in custom] == inputs)
    check("expected outputs come from the reference solution",
          [c.get("expectedOutput") for c in custom] == ["[0,1]", "[1,2]", "[2,3]"] and all(c.get("judged") for c in custom),
          [c.get("expectedOutput") for c in custom])

    wrong_js = "var twoSum = function (nums, target) { return [0, nums.length - 1]; };"
    status, body = submit("two-sum", "javascript", wrong_js, mode="run", customInputs=["nums = [1, 5, 9], target = 14"])
    c0 = (body.get("customResults") or [{}])[0]
    check("a wrong answer on a custom input fails it, with a diff",
          status == 200 and not body.get("passed") and c0.get("passed") is False and c0.get("judged")
          and c0.get("diff", {}).get("kind") == "items" and c0["diff"].get("missing") == [1], c0)

    status, body = submit("two-sum", "go", solution("two-sum", "go"), mode="run",
                          customInputs=["nums = [1, 2], target = 3", 'nums = [1, 2], target = "3"', "nums = [1, 2]"])
    errors = body.get("customInputErrors")
    check("malformed inputs: a 400 naming each one, before anything runs",
          status == 400 and [e["index"] for e in errors or []] == [1, 2], body)

    status, body = submit("min-stack", "rust", solution("min-stack", "rust"), mode="run",
                          customInputs=['["MinStack", "push", "getMin"]\n[[], [-2], []]', '["MinStack", "top"]\n[[], []]'])
    custom = body.get("customResults", [])
    check("design problems take custom inputs; one the reference can't run comes back unjudged",
          status == 200 and len(custom) == 2 and custom[0].get("judged") and custom[0].get("passed")
          and custom[1].get("judged") is False and "reference solution couldn't run" in (custom[1].get("inputError") or ""), custom)

    status, _ = submit("two-sum", "python3", solution("two-sum", "python3"), customInputs=inputs)
    check("Submit refuses custom inputs (400)", status == 400, status)
    status, _ = submit("two-sum", "python3", solution("two-sum", "python3"), mode="run", customInputs=["nums = [1], target = 1"] * 11)
    check("more than 10 custom inputs is a 400", status == 400, status)
    status, _ = submit("two-sum", "python3", solution("two-sum", "python3"), mode="run", customInputs=["x" * 10_001])
    check("an input over 10,000 characters is a 400", status == 400, status)

    print("\n4. Diffs and hidden cases")
    status, body = submit("two-sum", "rust", "impl Solution { pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> { vec![0, 1] } }", mode="run")
    failing = [r for r in body.get("results", []) if not r["passed"]]
    check("a wrong Run: every failing example carries a diff", status == 200 and failing and all(r.get("diff") for r in failing),
          [r.get("diff") for r in failing][:2])

    status, body = submit("two-sum", "rust", "impl Solution { pub fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> { vec![0, 1] } }")
    results = body.get("results", [])
    revealed = [r for r in results[4:] if not r.get("hidden")]
    hidden = [r for r in results[4:] if r.get("hidden")]
    check("a wrong Submit reveals one hidden case, with its diff",
          status == 201 and len(revealed) == 1 and not revealed[0]["passed"] and revealed[0].get("diff") and revealed[0].get("input"),
          revealed[:1])
    check("every other hidden case is exactly { passed, hidden: true }",
          hidden and all(set(r) == {"passed", "hidden"} for r in hidden), [r for r in hidden if set(r) != {"passed", "hidden"}][:2])

    print("\n5. Run latency (median of 3)")
    for lang in ["python3", "javascript", "go", "rust", "java", "cpp"]:
        code = solution("two-sum", lang)
        plain, with_custom = [], []
        for _ in range(3):
            t = time.perf_counter()
            submit("two-sum", lang, code, mode="run")
            plain.append(time.perf_counter() - t)
            t = time.perf_counter()
            submit("two-sum", lang, code, mode="run", customInputs=inputs)
            with_custom.append(time.perf_counter() - t)
        print(f"    {lang:10} run {statistics.median(plain):.2f}s   with 3 custom inputs {statistics.median(with_custom):.2f}s")

    print("\n6. Contract")
    logs = subprocess.run(["docker", "compose", "logs", "--since", started, "backend"], cwd=ROOT,
                          capture_output=True, text=True).stdout
    violations = logs.count("openapi_violation")
    check("no openapi_violation in the backend log for this run", violations == 0, violations)

    print(f"\n{len(PASSES)} passed, {len(FAILS)} failed")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
