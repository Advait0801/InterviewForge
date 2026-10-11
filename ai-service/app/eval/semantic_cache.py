"""
Does the retrieval cache earn its place? (Phase 11)

    python -m app.eval.semantic_cache                       # dense + routed, print
    python -m app.eval.semantic_cache --mode dense          # no LLM calls at all
    python -m app.eval.semantic_cache --out docs/eval       # also write phase11.{json,md}

Workload: the 42 golden queries, then two hand-written paraphrases of each
(fixtures/paraphrases.json): same intent and labels, different words.

  should hit      (query, paraphrase) and (paraphrase, paraphrase) of one golden query
  must not hit    two golden queries in the same partition (same company/stage filter) whose
                  labelled sources are disjoint, and their paraphrases: different intent, and
                  often very similar wording ("Meta system design" vs "presence indicators").

Steps:
  1. Embed every text once (one batched call) and sweep the threshold: how many should-hit
     pairs clear it, and how many must-not-hit pairs do.
  2. Retrieve every query fresh, once, through the real pipeline (cache off), timing it.
     Modes: `dense` is the agent's search path (no model call); `routed` is the interview
     path, where behavioural and system-design queries go through the LLM reranker.
  3. Replay the workload in order through the real RetrievalCache (on live Redis, under its
     own prefix): a hit serves the cached query's fresh result, a miss serves its own. Score
     both against the labels. The cache's quality cost is served nDCG minus fresh nDCG, and
     it is acceptable only inside the ±0.024 noise band (D-029).

The latency of a served query is modelled from measured parts -- lookup (timed on Redis),
embedding (timed per query), full retrieval (timed per query) -- rather than re-running
retrieval, so the comparison costs no extra reranker calls.
"""
from __future__ import annotations

import argparse
import json
import os
import statistics
import time
from itertools import combinations
from typing import Any, Dict, List, Optional, Tuple

from app.core import config
from app.eval.golden_set import GOLDEN_SET, GoldenQuery
from app.eval.metrics import ndcg_at_k
from app.eval.run import build_where, retrieved_sources
from app.rag import cache as cache_module
from app.rag.cache import RetrievalCache, cosine_packed, pack_vector, unpack_vector
from app.rag.service import RAGService

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "paraphrases.json")
NOISE_BAND = 0.024
RERANK_COST_USD = 0.000194   # per call, measured (D-037)
THRESHOLDS = [round(0.50 + 0.01 * i, 2) for i in range(50)]


def load_workload() -> List[Dict[str, Any]]:
    with open(FIXTURE) as fh:
        paraphrases = json.load(fh)
    items: List[Dict[str, Any]] = []
    for q in GOLDEN_SET:
        items.append({"gid": q.id, "variant": 0, "text": q.query, "q": q})
    for v in (1, 2):
        for q in GOLDEN_SET:
            items.append({"gid": q.id, "variant": v, "text": paraphrases[q.id][v - 1], "q": q})
    return items


def partition_of(q: GoldenQuery) -> str:
    return json.dumps(build_where(q), sort_keys=True)


def pairs(items: List[Dict[str, Any]]) -> Tuple[List[Tuple[int, int]], List[Tuple[int, int]]]:
    should, must_not = [], []
    for i, j in combinations(range(len(items)), 2):
        a, b = items[i], items[j]
        if partition_of(a["q"]) != partition_of(b["q"]):
            continue  # never compared: different partitions
        if a["gid"] == b["gid"]:
            should.append((i, j))
        elif not set(a["q"].relevant_sources) & set(b["q"].relevant_sources):
            must_not.append((i, j))
    return should, must_not


def sweep(sims: Dict[Tuple[int, int], float], should, must_not) -> List[Dict[str, Any]]:
    rows = []
    for t in THRESHOLDS:
        rows.append({
            "threshold": t,
            "shouldHit": round(sum(sims[p] >= t for p in should) / len(should), 4),
            "falseHits": sum(sims[p] >= t for p in must_not),
        })
    return rows


def _retrieve(rag: RAGService, item: Dict[str, Any], mode: str, k: int) -> Dict[str, Any]:
    q = item["q"]
    stage = q.stage if mode == "routed" else None
    return rag.retrieve(item["text"], top_k=k, where=build_where(q), stage=stage)


def fresh_pass(rag: RAGService, items, mode: str, k: int) -> List[Dict[str, Any]]:
    out = []
    for n, item in enumerate(items):
        t0 = time.perf_counter()
        result = _retrieve(rag, item, mode, k)
        ms = (time.perf_counter() - t0) * 1000
        sources = retrieved_sources(result["hits"])
        # Exactly the service's rule: a rerank that left no marks fell back to first-stage order.
        degraded = "rerank" in result["stages"] and len(result["hits"]) > 1 and not any(
            "rerank_position" in h for h in result["hits"])
        out.append({
            "ms": ms, "stages": result["stages"], "sources": sources, "degraded": degraded,
            "ndcg": ndcg_at_k(sources, set(item["q"].relevant_sources), k),
        })
        if mode == "routed" and "rerank" in result["stages"]:
            time.sleep(4.2)  # Gemini free tier: 15 requests/minute
        if (n + 1) % 21 == 0:
            print(f"  [{mode}] fresh {n + 1}/{len(items)}", flush=True)
    return out


def replay(items, vectors, fresh, *, mode: str, threshold: Optional[float], embed_ms: List[float],
           store_factory) -> Dict[str, Any]:
    """Serve the workload in order through a real cache. threshold None = exact tier only."""
    cache = RetrievalCache(store_factory(), semantic=threshold is not None,
                           threshold=threshold if threshold is not None else 1.0)
    served, tiers, lat, lookups, reranks_saved = [], [], [], [], 0
    for i, item in enumerate(items):
        partition = f"{mode}:{partition_of(item['q'])}"
        t0 = time.perf_counter()
        found = cache.lookup(item["text"], partition, lambda _q: vectors[i])
        lookup_ms = (time.perf_counter() - t0) * 1000
        lookups.append(lookup_ms)
        if found.result is not None:
            j = found.result["index"]
            tiers.append(found.tier)
            served.append(fresh[j]["ndcg"] if found.result["gid"] == item["gid"] else
                          ndcg_at_k(fresh[j]["sources"], set(item["q"].relevant_sources), 5))
            lat.append(lookup_ms + (embed_ms[i] if found.tier == "semantic" else 0.0))
            reranks_saved += "rerank" in fresh[i]["stages"]
        else:
            cache.store_result(found, {"index": i, "gid": item["gid"]}, vectors[i],
                               degraded=fresh[i]["degraded"])
            tiers.append("miss")
            served.append(fresh[i]["ndcg"])
            # A semantic miss already paid for the embedding the retrieval reuses.
            lat.append(lookup_ms + fresh[i]["ms"])
    hits = [t for t in tiers if t != "miss"]
    fresh_ndcg = statistics.mean(f["ndcg"] for f in fresh)
    served_ndcg = statistics.mean(served)
    para = [n for n, it in enumerate(items) if it["variant"]]
    return {
        "threshold": threshold,
        "hitRate": round(len(hits) / len(items), 4),
        "exactHits": tiers.count("exact"), "semanticHits": tiers.count("semantic"),
        "ndcgFresh": round(fresh_ndcg, 4), "ndcgServed": round(served_ndcg, 4),
        "ndcgDelta": round(served_ndcg - fresh_ndcg, 4),
        "paraphraseNdcgFresh": round(statistics.mean(fresh[n]["ndcg"] for n in para), 4),
        "paraphraseNdcgServed": round(statistics.mean(served[n] for n in para), 4),
        "p50LookupMs": round(statistics.median(lookups), 2),
        "p50ServedMs": round(statistics.median(lat), 1),
        # The queries a reranker sits behind: where a hit saves a model call.
        "p50ServedRerankedMs": round(statistics.median(
            [lat[n] for n in range(len(items)) if "rerank" in fresh[n]["stages"]]), 1)
        if any("rerank" in f["stages"] for f in fresh) else None,
        "meanServedMs": round(statistics.mean(lat), 1),
        "rerankCallsSaved": reranks_saved,
        "_tiers": tiers,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["dense", "routed", "both"], default="both")
    ap.add_argument("--k", type=int, default=5)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    # Measure retrieval itself, not the production cache sitting in front of it.
    cache_module.cache.enabled = False
    rag = RAGService()
    items = load_workload()
    print(f"workload: {len(items)} queries ({len(GOLDEN_SET)} golden + paraphrases)", flush=True)

    t0 = time.perf_counter()
    raw = rag.embedder.embed([it["text"] for it in items])
    batch_ms = (time.perf_counter() - t0) * 1000
    # Per-query embedding latency, as a semantic lookup pays it: one call, one text.
    embed_ms = []
    for it in items:
        t1 = time.perf_counter()
        rag.embedder.embed([it["text"]])
        embed_ms.append((time.perf_counter() - t1) * 1000)
    packed = [unpack_vector(pack_vector(v)) for v in raw]

    should, must_not = pairs(items)
    sims = {p: cosine_packed(packed[p[0]], packed[p[1]]) for p in should + must_not}
    s_vals = sorted(sims[p] for p in should)
    n_vals = sorted(sims[p] for p in must_not)
    worst_negatives = sorted(must_not, key=lambda p: -sims[p])[:5]
    report: Dict[str, Any] = {
        "workload": len(items), "p50EmbedMs": round(statistics.median(embed_ms), 1), "batchEmbedMs": round(batch_ms, 1),
        "pairs": {"shouldHit": len(should), "mustNotHit": len(must_not)},
        "similarity": {
            "shouldHit": {"min": round(s_vals[0], 4), "p10": round(s_vals[len(s_vals) // 10], 4),
                          "median": round(statistics.median(s_vals), 4)},
            "mustNotHit": {"max": round(n_vals[-1], 4), "p99": round(n_vals[int(len(n_vals) * 0.99)], 4),
                           "median": round(statistics.median(n_vals), 4)},
            "closestMustNot": [
                {"a": items[a]["text"], "b": items[b]["text"], "cos": round(sims[(a, b)], 4)}
                for a, b in worst_negatives
            ],
        },
        "sweep": sweep(sims, should, must_not),
        "modes": {},
    }
    safe = [r["threshold"] for r in report["sweep"] if r["falseHits"] == 0]
    chosen = min(safe) if safe else None
    report["lowestSafeThreshold"] = chosen
    print(json.dumps({k: report[k] for k in ("similarity", "lowestSafeThreshold")}, indent=1), flush=True)

    import redis

    client = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379"))

    def store_factory():
        prefix = f"ragcache-eval:{time.time_ns()}"
        return cache_module.RedisStore(client, max_entries=1000, ttl_seconds=600,
                                       partition_max=64, prefix=prefix)

    modes = ["dense", "routed"] if args.mode == "both" else [args.mode]
    for mode in modes:
        print(f"[{mode}] fresh retrieval of {len(items)} queries...", flush=True)
        fresh = fresh_pass(rag, items, mode, args.k)
        fresh_ms = [f["ms"] for f in fresh]
        rows = []
        for t in [None] + sorted({*(x for x in (chosen,) if x), 0.70, 0.75, 0.80, 0.85, 0.90, 0.95}):
            row = replay(items, raw, fresh, mode=mode, threshold=t, embed_ms=embed_ms,
                         store_factory=store_factory)
            row["wrongIntentHits"] = _wrong_intent(items, row.pop("_tiers"), raw, t, mode, fresh, store_factory)
            rows.append(row)
        report["modes"][mode] = {
            "p50FreshMs": round(statistics.median(fresh_ms), 1),
            "p50FreshRerankedMs": round(statistics.median(
                [f["ms"] for f in fresh if "rerank" in f["stages"]]), 1)
            if any("rerank" in f["stages"] for f in fresh) else None,
            "meanFreshMs": round(statistics.mean(fresh_ms), 1),
            "rerankedQueries": sum("rerank" in f["stages"] for f in fresh),
            "degradedReranks": sum(f["degraded"] for f in fresh),
            "replays": rows,
        }
        print(json.dumps(report["modes"][mode], indent=1), flush=True)
    for key in client.scan_iter("ragcache-eval:*"):
        client.delete(key)

    from app.core.observability import snapshot

    spend = snapshot()
    report["llmSpend"] = {"calls": spend["calls"], "estimatedCostUsd": spend["estimatedCostUsd"]}
    print(f"LLM spend this run: {report['llmSpend']}")
    report["noiseBand"] = NOISE_BAND
    report["rerankCostUsd"] = RERANK_COST_USD
    if args.out:
        os.makedirs(args.out, exist_ok=True)
        with open(os.path.join(args.out, "phase11.json"), "w") as fh:
            json.dump(report, fh, indent=2)
        print(f"wrote {args.out}/phase11.json")


def _wrong_intent(items, tiers, raw, threshold, mode, fresh, store_factory) -> int:
    """Re-run the lookups to see which cached query each semantic hit matched, and count the
    hits whose source query had a different golden id (i.e. different labels)."""
    if threshold is None:
        return 0
    cache = RetrievalCache(store_factory(), semantic=True, threshold=threshold)
    wrong = 0
    for i, item in enumerate(items):
        found = cache.lookup(item["text"], f"{mode}:{partition_of(item['q'])}", lambda _q: raw[i])
        if found.result is None:
            cache.store_result(found, {"index": i, "gid": item["gid"]}, raw[i],
                               degraded=fresh[i]["degraded"])
        elif found.tier == "semantic" and found.result["gid"] != item["gid"]:
            if set(items[found.result["index"]]["q"].relevant_sources) != set(item["q"].relevant_sources):
                wrong += 1
    return wrong


if __name__ == "__main__":
    main()
