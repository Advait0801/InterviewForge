"""Write the curated company tags into backend/leetcode_problems.json (Phase 7, F-21).

    python scripts/problemgen/apply_curation.py

Covers all 150 problems, including the original 42 that no batch generator owns.
Idempotent; only the `companies` field changes. Batch generators consult the same
table (`common.upsert_problems`), so running them afterwards keeps these tags.
"""
from __future__ import annotations

import collections
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import PROBLEMS_JSON, _dump_json  # noqa: E402
from curation import COMPANY_TAGS, validate  # noqa: E402


def main():
    with open(PROBLEMS_JSON) as handle:
        raw = handle.read()
    problems = json.loads(raw)
    validate([p["slug"] for p in problems])  # exact coverage: no problem untagged, no stale entry

    changed = 0
    for problem in problems:
        tags = list(COMPANY_TAGS[problem["slug"]])
        if problem["companies"] != tags:
            problem["companies"] = tags
            changed += 1
    _dump_json(PROBLEMS_JSON, problems, raw)

    counts = collections.Counter(c for p in problems for c in p["companies"])
    print(f"{changed} of {len(problems)} problems retagged")
    print("  " + ", ".join(f"{name} {n}" for name, n in counts.most_common()))


if __name__ == "__main__":
    main()
