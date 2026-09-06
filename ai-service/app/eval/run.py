"""
Retrieval evaluation entry point.

    python -m app.eval.run                    # evaluate, print table
    python -m app.eval.run --k 10             # different cutoff
    python -m app.eval.run --out docs/eval    # also write JSON + markdown
    python -m app.eval.run --no-filter        # ignore company/stage metadata filter

Needs a running Chroma with the corpus ingested. Makes embedding calls for each
query (one per query) but no LLM generation calls, so a full run is cheap.
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core import config
from app.eval.golden_set import GOLDEN_SET, GoldenQuery
from app.eval.metrics import aggregate, evaluate_one
from app.rag.service import RAGService


def build_where(q: GoldenQuery) -> Optional[Dict[str, Any]]:
    """Mirror the metadata filter the interview orchestrator uses."""
    clauses = []
    if q.company:
        clauses.append({"company": {"$eq": q.company}})
    if q.stage:
        clauses.append({"stage": {"$eq": q.stage}})
    if not clauses:
        return None
    if len(clauses) == 1:
        return clauses[0]
    return {"$and": clauses}


def retrieved_sources(hits: List[Dict[str, Any]]) -> List[str]:
    """Map chunk hits back to their source document names, preserving rank.

    A source is credited at the rank of its best-scoring chunk; later duplicate
    chunks from the same source are dropped so one document cannot occupy the
    whole top-k and inflate precision.
    """
    seen: List[str] = []
    for hit in hits:
        source = str(hit.get("metadata", {}).get("source", ""))
        if source and source not in seen:
            seen.append(source)
    return seen


def run_eval(*, k: int, use_filter: bool = True) -> Dict[str, Any]:
    rag = RAGService()
    per_query: List[Dict[str, Any]] = []

    for q in GOLDEN_SET:
        where = build_where(q) if use_filter else None

        if config.ROUTING_ENABLED:
            # Apply the per-stage policy for this query, then restore, so one
            # query's route cannot leak into the next.
            from app.rag.routing import route_for

            route = route_for(q.stage)
            saved = (config.RERANK_ENABLED, config.HYBRID_ENABLED)
            config.RERANK_ENABLED, config.HYBRID_ENABLED = route.rerank, route.hybrid
            try:
                result = rag.retrieve(q.query, top_k=k, where=where)
            finally:
                config.RERANK_ENABLED, config.HYBRID_ENABLED = saved
        else:
            result = rag.retrieve(q.query, top_k=k, where=where)
        sources = retrieved_sources(result["hits"])
        scores = evaluate_one(sources, q.relevant_sources, k)
        per_query.append(
            {
                "id": q.id,
                "kind": q.kind,
                "company": q.company,
                "stage": q.stage,
                "expected": q.relevant_sources,
                "retrieved": sources,
                **scores,
            }
        )

    overall = aggregate([{kk: vv for kk, vv in p.items() if isinstance(vv, float)} for p in per_query])

    def subset(pred) -> Dict[str, float]:
        rows = [p for p in per_query if pred(p)]
        return aggregate([{kk: vv for kk, vv in r.items() if isinstance(vv, float)} for r in rows])

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "k": k,
        "filtered": use_filter,
        "config": {
            "chunk_size": config.CHUNK_SIZE_CHARS,
            "chunk_overlap": config.CHUNK_OVERLAP_CHARS,
            "embedding_provider": config.EMBEDDING_PROVIDER,
            "collection": config.CHROMA_COLLECTION,
        },
        "query_count": len(per_query),
        "overall": overall,
        "by_kind": {
            "natural": subset(lambda p: p["kind"] == "natural"),
            "synthetic": subset(lambda p: p["kind"] == "synthetic"),
        },
        "per_query": per_query,
    }


METRIC_ORDER = ["precision_at_k", "precision_norm", "recall_at_k", "hit_rate", "mrr", "ndcg_at_k"]


def to_markdown(report: Dict[str, Any]) -> str:
    k = report["k"]
    lines = [
        "# Retrieval evaluation",
        "",
        f"- Generated: `{report['generated_at']}`",
        f"- Queries: **{report['query_count']}**, k = **{k}**, "
        f"metadata filter: **{'on' if report['filtered'] else 'off'}**",
        f"- Chunking: {report['config']['chunk_size']}/{report['config']['chunk_overlap']} chars, "
        f"embeddings: `{report['config']['embedding_provider']}`",
        "",
        "## Overall",
        "",
        "| Metric | Score |",
        "|---|---|",
    ]
    for m in METRIC_ORDER:
        lines.append(f"| {m} | {report['overall'].get(m, 0.0):.3f} |")

    lines += ["", "## By query kind", "", "| Kind | " + " | ".join(METRIC_ORDER) + " |",
              "|---|" + "---|" * len(METRIC_ORDER)]
    for kind, scores in report["by_kind"].items():
        if not scores:
            continue
        lines.append("| " + kind + " | " + " | ".join(f"{scores.get(m,0.0):.3f}" for m in METRIC_ORDER) + " |")

    lines += ["", "## Per query", "", "| id | kind | hit | mrr | ndcg | expected | retrieved (top) |",
              "|---|---|---|---|---|---|---|"]
    for p in sorted(report["per_query"], key=lambda r: r["ndcg_at_k"]):
        lines.append(
            f"| `{p['id']}` | {p['kind']} | {p['hit_rate']:.0f} | {p['mrr']:.2f} | "
            f"{p['ndcg_at_k']:.2f} | {', '.join(p['expected'])} | "
            f"{', '.join(p['retrieved'][:3]) or '(none)'} |"
        )
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate retrieval against the golden set.")
    parser.add_argument("--k", type=int, default=config.RAG_TOP_K)
    parser.add_argument("--out", type=str, default=None, help="directory to write report files into")
    parser.add_argument("--name", type=str, default=None, help="base filename (default: timestamp)")
    parser.add_argument("--no-filter", action="store_true", help="disable the company/stage filter")
    args = parser.parse_args()

    report = run_eval(k=args.k, use_filter=not args.no_filter)
    markdown = to_markdown(report)
    print(markdown)

    if args.out:
        os.makedirs(args.out, exist_ok=True)
        base = args.name or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        with open(os.path.join(args.out, f"{base}.json"), "w") as fh:
            json.dump(report, fh, indent=2)
        with open(os.path.join(args.out, f"{base}.md"), "w") as fh:
            fh.write(markdown)
        print(f"\nWrote {args.out}/{base}.json and {args.out}/{base}.md")


if __name__ == "__main__":
    main()
