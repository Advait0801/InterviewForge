"""Phase 7 verification: every problem against a known-good solution, every language.

    python scripts/verify_problems.py                      # full matrix
    python scripts/verify_problems.py --lang c --slug n-queens
    python scripts/verify_problems.py --json report.json

Runs each reference solution in `backend/reference_solutions/<slug>/` through the
**real** code-runner (`POST /run`), with the exact test cases the seed script
loads into Postgres. That is the same path a user's submission takes, so a green
cell means a user who writes a correct solution will actually see it pass.

A red cell is one of three things, and the report distinguishes them because they
have different owners:

  * a wrong reference solution         -> fix the solution
  * a wrong expected output             -> fix `leetcode_problems.json`
  * a harness that cannot run the case  -> fix `code-runner`, or record the gap

Needs the stack up (`docker compose up -d`). Exit code is non-zero on any failure
unless `--report-only` is given.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROBLEMS_JSON = os.path.join(ROOT, "backend", "leetcode_problems.json")
SOLUTIONS_DIR = os.path.join(ROOT, "backend", "reference_solutions")

# Host port for code-runner in dev; services use code-runner:5000 internally.
CODE_RUNNER = os.getenv("CODE_RUNNER_URL", "http://localhost:5050")

LANGS = ["python3", "c", "cpp", "java"]
FILENAMES = {"python3": "solution.py", "c": "solution.c", "cpp": "solution.cpp", "java": "solution.java"}


def run(language: str, code: str, test_cases: list, slug: str) -> dict:
    body = json.dumps({"language": language, "code": code, "testCases": test_cases, "slug": slug})
    req = urllib.request.Request(
        f"{CODE_RUNNER}/run", data=body.encode(), method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=240) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        return {"passed": False, "error": f"HTTP {exc.code}: {exc.read()[:300].decode(errors='replace')}"}
    except Exception as exc:  # network, timeout
        return {"passed": False, "error": f"{type(exc).__name__}: {exc}"}


def verify_cell(problem: dict, language: str) -> dict:
    slug = problem["slug"]
    path = os.path.join(SOLUTIONS_DIR, slug, FILENAMES[language])
    cell = {"slug": slug, "language": language, "total": len(problem["testCases"])}

    if not os.path.exists(path):
        return {**cell, "status": "missing", "passed": 0}

    with open(path) as handle:
        code = handle.read()

    started = time.time()
    result = run(language, code, problem["testCases"], slug)
    cell["seconds"] = round(time.time() - started, 1)

    results = result.get("results") or []
    passed = sum(1 for r in results if r.get("passed"))
    cell["passed"] = passed

    if result.get("passed") and passed == cell["total"]:
        return {**cell, "status": "pass"}

    first = next((i for i, r in enumerate(results) if not r.get("passed")), None)
    failure = {"error": result.get("error")}
    if first is not None:
        tc = problem["testCases"][first]
        r = results[first]
        failure.update({
            "case": first,
            "input": tc["input"][:200],
            "expected": tc["expectedOutput"][:200],
            "actual": str(r.get("actualOutput"))[:200],
            "error": r.get("error") or result.get("error") or result.get("compileError"),
        })
    return {**cell, "status": "fail", "failure": failure}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--lang", choices=LANGS, action="append", help="restrict to a language (repeatable)")
    parser.add_argument("--slug", action="append", help="restrict to a problem (repeatable)")
    parser.add_argument("--workers", type=int, default=4, help="parallel sandbox runs (default 4)")
    parser.add_argument("--json", help="write the full report here")
    parser.add_argument("--report-only", action="store_true", help="always exit 0")
    args = parser.parse_args()

    with open(PROBLEMS_JSON) as handle:
        problems = json.load(handle)
    if args.slug:
        problems = [p for p in problems if p["slug"] in set(args.slug)]
    langs = args.lang or LANGS

    jobs = [(p, lang) for p in problems for lang in langs]
    print(f"verifying {len(problems)} problems x {len(langs)} languages = {len(jobs)} cells "
          f"against {CODE_RUNNER}\n")

    cells = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(verify_cell, p, lang) for p, lang in jobs]
        for future in as_completed(futures):
            cells.append(future.result())

    by_key = {(c["slug"], c["language"]): c for c in cells}
    symbols = {"pass": "ok", "fail": "FAIL", "missing": "--"}

    width = max(len(p["slug"]) for p in problems)
    print(f"{'problem':<{width}}  " + "  ".join(f"{lang:>10}" for lang in langs))
    for p in problems:
        row = []
        for lang in langs:
            c = by_key[(p["slug"], lang)]
            label = symbols[c["status"]]
            if c["status"] == "fail":
                label = f"FAIL {c['passed']}/{c['total']}"
            row.append(f"{label:>10}")
        print(f"{p['slug']:<{width}}  " + "  ".join(row))

    failures = sorted((c for c in cells if c["status"] == "fail"), key=lambda c: (c["slug"], c["language"]))
    if failures:
        print("\nfailures:")
        for c in failures:
            f = c["failure"]
            print(f"\n  {c['slug']} [{c['language']}]  {c['passed']}/{c['total']}")
            if f.get("case") is not None:
                print(f"    case {f['case']}: input    {f['input']}")
                print(f"             expected {f['expected']}")
                print(f"             actual   {f['actual']}")
            if f.get("error"):
                print(f"    error: {str(f['error'])[:400]}")

    counts = {s: sum(1 for c in cells if c["status"] == s) for s in ("pass", "fail", "missing")}
    print(f"\nRESULT: {counts['pass']} pass, {counts['fail']} fail, {counts['missing']} missing "
          f"of {len(cells)} cells")
    for lang in langs:
        lang_cells = [c for c in cells if c["language"] == lang]
        ok = sum(1 for c in lang_cells if c["status"] == "pass")
        print(f"  {lang:8} {ok}/{len(lang_cells)}")

    if args.json:
        with open(args.json, "w") as handle:
            json.dump(sorted(cells, key=lambda c: (c["slug"], c["language"])), handle, indent=1)

    if args.report_only:
        return 0
    return 0 if counts["fail"] == 0 and counts["missing"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
