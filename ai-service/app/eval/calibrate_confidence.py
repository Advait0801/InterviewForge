"""Calibrate the retrieval-confidence gate against the live corpus.

    docker compose exec ai-service python -m app.eval.calibrate_confidence

The gate in `app/ingest/confidence.py` decides between the cheap local path and
an expensive live web fetch, so its thresholds are only meaningful relative to
the distance distribution of the corpus they run against. Guessing them produced
a gate that passed 3 of 40 company/stage pairs (D-038); this makes the choice
reproducible instead.

**Ground truth used here:** the four hand-seeded companies (amazon, apple,
google, meta) have a real corpus and must NOT trigger a fetch; the six added in
Phase 4 with thin starter docs SHOULD. That is the mechanism's stated purpose
(D-009), so it is the right thing to calibrate against -- and it is a genuine
label, not a circular one, because it comes from how the corpus was built rather
than from the distances being measured.

**Objective:** perfect recall on covered pairs first -- a needless fetch costs
money, latency and unvetted corpus content -- then maximise the share of thin
pairs correctly flagged. Reads only; embeds one query per pair and writes
nothing to Chroma.
"""
from __future__ import annotations

import argparse
import json
import logging
from typing import Dict, List, Tuple

SEEDED = {"amazon", "apple", "google", "meta"}
STAGES = ["behavioral", "coding", "system_design", "core_cs"]

TOP_GRID = [0.62, 0.70, 0.75, 0.78, 0.80, 0.85, 0.90, 1.00, 1.24]
GOOD_GRID = [0.75, 0.85, 0.95, 1.00, 1.10]
MIN_GOOD_GRID = [1, 2]


def collect() -> List[Dict]:
    from app.interview.company_profiles import COMPANY_PROFILES
    from app.interview.orchestrator import retrieve_company_context
    from app.rag.service import RAGService

    rag = RAGService()
    rows: List[Dict] = []
    for company in sorted(COMPANY_PROFILES):
        for stage in STAGES:
            retrieved = retrieve_company_context(
                rag=rag, company=company, stage=stage, difficulty="medium", top_k=5
            )
            # BM25-only hits carry distance=None (hybrid.py) and assess() drops
            # them, so drop them here too or the two disagree.
            distances = sorted(
                h["distance"] for h in retrieved["hits"] if h.get("distance") is not None
            )
            rows.append(
                {
                    "company": company,
                    "stage": stage,
                    "seeded": company in SEEDED,
                    "distances": distances,
                }
            )
    return rows


def score(rows: List[Dict], max_top: float, max_good: float, min_good: int) -> Tuple[int, int, int, int]:
    """Returns (covered_pass, covered_total, thin_flagged, thin_total)."""
    cov_pass = cov_total = thin_flagged = thin_total = 0
    for row in rows:
        distances = row["distances"]
        confident = (
            bool(distances)
            and distances[0] <= max_top
            and sum(1 for d in distances if d <= max_good) >= min_good
        )
        if row["seeded"]:
            cov_total += 1
            cov_pass += confident
        else:
            thin_total += 1
            thin_flagged += not confident
    return cov_pass, cov_total, thin_flagged, thin_total


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", help="write the raw distance measurements here")
    args = parser.parse_args()

    logging.disable(logging.CRITICAL)
    rows = collect()

    if args.json:
        with open(args.json, "w") as handle:
            json.dump(rows, handle, indent=1)

    print(
        "measured %d pairs: %d covered (must pass), %d thin (should fetch)\n"
        % (len(rows), sum(r["seeded"] for r in rows), sum(not r["seeded"] for r in rows))
    )
    print("%-8s %-9s %-4s | %-16s %s" % ("max_top", "max_good", "min", "covered pass", "thin flagged"))

    best = None
    for max_top in TOP_GRID:
        for max_good in GOOD_GRID:
            for min_good in MIN_GOOD_GRID:
                cp, ct, tf, tt = score(rows, max_top, max_good, min_good)
                cov, thin = cp / ct, tf / tt
                print(
                    "%-8s %-9s %-4s | %2d/%2d (%3.0f%%)      %2d/%2d (%3.0f%%)"
                    % (max_top, max_good, min_good, cp, ct, cov * 100, tf, tt, thin * 100)
                )
                if cov == 1.0 and (best is None or thin > best[0]):
                    best = (thin, max_top, max_good, min_good)

    if best is None:
        print("\nNo operating point passes every covered pair -- the corpus has regressed.")
        return

    print(
        "\nBEST (100%% covered recall, then max thin recall):"
        "\n  RAG_CONFIDENCE_MAX_TOP_DISTANCE=%s"
        "\n  RAG_CONFIDENCE_MAX_GOOD_DISTANCE=%s"
        "\n  RAG_CONFIDENCE_MIN_GOOD_HITS=%s"
        "\n  -> flags %.0f%% of thin pairs" % (best[1], best[2], best[3], best[0] * 100)
    )


if __name__ == "__main__":
    main()
