"""Group D, Phase 12 verification: empirical complexity, live (D-076).

    python scripts/verify_complexity.py            # no model calls
    python scripts/verify_complexity.py --review   # also one AI review (one model call) for the claim comparison

Run against a live stack with the sandbox images built and migration 019 applied. Every
known solution (scripts/complexity_known.py: hash maps, brute force, hand-written merge
sorts, binary search, in all seven languages) is submitted through the real API, so it is a
genuinely accepted submission, then measured through POST /submissions/{id}/complexity:
the queue, one sandbox, the fit.

Checks:
  1. Each solution's true class is among the fit's candidates, and nothing is ruled in that
     is a different family (no quadratic for a linear solution, or the reverse).
  2. Every quadratic solution is identified exactly.
  3. GET returns the stored analysis; a failed submission and an uncurated problem are not
     available and refuse to measure (400) without a sandbox.
  4. C reads a custom input longer than 4,096 characters (the bug this phase fixed).
  5. With --review: the stored review's claim is compared with the measurement.
  6. No `openapi_violation` in the backend log for this run.
Rate limits: 10 measurements per user per 15 minutes, so it registers a user per 9.
Takes about 5 minutes (each quadratic solution uses its full 20 s).
"""
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from complexity_known import KNOWN  # noqa: E402

BACKEND = os.getenv("BACKEND_URL", "http://localhost:4000")
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
PASSES, FAILS = [], []
FAMILY = {"O(1)": 0, "O(log n)": 0, "O(n)": 1, "O(n log n)": 1, "O(n²)": 2, "O(n³)": 3}


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
        with urllib.request.urlopen(req, timeout=240) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def register():
    suffix = uuid.uuid4().hex[:10]
    status, body = call("POST", "/api/auth/register", {
        "email": f"phase12-{suffix}@example.com", "password": "Str0ngPassw0rd!", "username": f"p12{suffix}",
    })
    if status != 201:
        raise SystemExit(f"registration failed: {status} {body}")
    return body["token"]


def reference(slug, ext):
    with open(os.path.join(ROOT, "backend", "reference_solutions", slug, f"solution.{ext}")) as handle:
        return handle.read()


def main(with_review):
    started = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    status, body = call("GET", "/api/problems")
    ids = {p["slug"]: p["id"] for p in body.get("problems", [])}
    token, used = register(), 0

    def submit(slug, lang, code, mode="submit", **extra):
        return call("POST", "/api/submissions", {"problemId": ids[slug], "language": lang, "code": code, "mode": mode, **extra}, token)

    print("1-2. Known solutions, seven languages")
    exact, consistent, brute_id = 0, 0, None
    for label, slug, lang, expected, code in KNOWN:
        if used == 9:
            token, used = register(), 0
        code = code or reference(slug, "py")
        status, sub = submit(slug, lang, code)
        if not check(f"{label}: accepted", status == 201 and sub.get("status") == "passed", f"{status} {str(sub)[:120]}"):
            continue
        used += 1
        status, body = call("POST", f"/api/submissions/{sub['submissionId']}/complexity", token=token)
        if not check(f"{label}: measured", status == 200, f"{status} {str(body)[:160]}"):
            continue
        fit = body["analysis"]["fit"]
        cands = fit["candidates"]
        best = fit.get("bestFit", "inconclusive")
        foreign = [c for c in cands if FAMILY[c] != FAMILY[expected]]
        check(f"{label}: {expected} among {cands}, nothing from another family",
              expected in cands and not foreign, f"best {best}, slope {fit.get('slope')}, stopped {body['analysis']['stopped']}")
        if expected == "O(n²)":
            check(f"{label}: quadratic identified exactly", cands == ["O(n²)"])
        exact += cands == [expected]
        consistent += expected in cands
        if label == "py two-sum brute force":
            brute_id, brute_token = sub["submissionId"], token
    print(f"     exact {exact}, consistent {consistent} of {len(KNOWN)}")

    print("3. Stored analysis and availability")
    status, body = call("GET", f"/api/submissions/{brute_id}/complexity", token=brute_token)
    check("GET returns the stored analysis", status == 200 and body["available"] and body["analysis"]["fit"]["bestFit"] == "O(n²)")
    status, wrong = submit("two-sum", "python3", "class Solution:\n    def twoSum(self, nums, target):\n        return [0, 0]\n")
    status, body = call("GET", f"/api/submissions/{wrong['submissionId']}/complexity", token=token)
    check("a failed submission is not available", status == 200 and body == {"available": False, "analysis": None}, body)
    status, body = call("POST", f"/api/submissions/{wrong['submissionId']}/complexity", token=token)
    check("and refuses to measure", status == 400, body)
    status, lru = submit("lru-cache", "python3", reference("lru-cache", "py"))
    status, body = call("GET", f"/api/submissions/{lru['submissionId']}/complexity", token=token)
    check("an uncurated problem (a design class) is not available", body.get("available") is False, body)
    status, body = call("POST", f"/api/submissions/{lru['submissionId']}/complexity", token=token)
    check("and refuses to measure", status == 400 and "isn't available" in body.get("error", ""), body)

    print("4. C reads a long custom input")
    values = list(range(1800, 0, -1))
    long_input = f"nums = {json.dumps([v % 3 for v in values])}"
    status, body = submit("sort-colors", "c", reference("sort-colors", "c"), mode="run", customInputs=[long_input])
    custom = (body.get("customResults") or [{}])[0]
    check(f"a {len(long_input):,}-character input is judged and passes in C", status == 200 and custom.get("judged") and custom.get("passed"),
          str(custom)[:160])

    if with_review:
        print("5. The AI review's claim against the measurement")
        status, body = call("POST", f"/api/submissions/{brute_id}/review", token=brute_token)
        check("review succeeded", status == 200, status)
        claim_text = body.get("review", {}).get("timeComplexity")
        status, body = call("GET", f"/api/submissions/{brute_id}/complexity", token=brute_token)
        claim = body["analysis"]["claim"]
        check("the stored claim is compared", claim["text"] == claim_text and claim["verdict"] != "not_comparable", claim)
        print(f"     reviewer said {claim_text!r}; measured {body['analysis']['fit']['candidates']}: {claim['verdict']}")

    print("6. Contract")
    logs = subprocess.run(["docker", "compose", "logs", "--since", started, "backend"], cwd=ROOT, capture_output=True, text=True).stdout
    check("no openapi_violation in the backend log", "openapi_violation" not in logs)


if __name__ == "__main__":
    t0 = time.time()
    main(with_review="--review" in sys.argv)
    print(f"\n{len(PASSES)} passed, {len(FAILS)} failed in {time.time() - t0:.0f}s")
    if FAILS:
        print("FAILED: " + "; ".join(FAILS))
    sys.exit(1 if FAILS else 0)
