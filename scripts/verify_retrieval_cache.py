"""Phase 11 verification: the retrieval cache, live, against the running stack.

    python scripts/verify_retrieval_cache.py            # everything below
    python scripts/verify_retrieval_cache.py --no-llm   # skip the two interview starts

What it proves, in order:
  1. The ai-service runs the cache on Redis, with the shipped settings.
  2. A repeated query is served from the cache (exact tier), whitespace and case included,
     with the same hits; a different filter or top_k is a miss.
  3. A corpus write invalidates it: ingesting a throwaway document, and deleting it again
     (both through the RAG service, so both bump the generation). The document is removed.
  4. Every cache key in Redis has a TTL, and the entry count is within its cap.
  5. Redis paused: retrieval still answers (tier "off"), and the cache comes back after the
     breaker window once Redis is unpaused.
  6. The interview path: two interviews opened on the same company and difficulty. The
     second's opening retrieval is an exact hit, so its reranker call never happens.
     (Costs the two opening questions' model calls, about 4.)

Uses `docker compose` for the Redis checks and the write path. Exit code non-zero on failure.
"""
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid

AI = os.getenv("AI_SERVICE_URL", "http://localhost:8010")
BACKEND = os.getenv("BACKEND_URL", "http://localhost:4000")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASSES, FAILS = [], []


def check(name, condition, detail=""):
    (PASSES if condition else FAILS).append(name)
    print(f"  {'PASS' if condition else 'FAIL'}  {name}{(' -- ' + detail) if detail else ''}")
    return condition


def call(base, method, path, payload=None, token=None, timeout=120):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(f"{base}{path}", data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def compose(*args, stdin=None):
    out = subprocess.run(["docker", "compose", *args], cwd=ROOT, input=stdin,
                         capture_output=True, text=True, timeout=120)
    return out.stdout.strip()


def redis_cli(*args):
    return compose("exec", "-T", "redis", "redis-cli", *args)


def cache_stats():
    return call(AI, "GET", "/metrics/llm")[1]


def query(text, where=None, top_k=3):
    status, body = call(AI, "POST", "/api/rag/query",
                        {"query": text, "answer": False, "top_k": top_k, "where": where})
    return status, body.get("retrieval", {})


def main(with_llm):
    stats = cache_stats()["retrievalCache"]
    print("1. configuration")
    check("cache enabled on Redis", stats["enabled"] and stats["backend"] == "redis", json.dumps(stats))

    print("2. exact tier")
    nonce = uuid.uuid4().hex[:8]
    text = f"consistent hashing for sharded caches {nonce}"
    where = {"$and": [{"company": {"$eq": "google"}}, {"stage": {"$eq": "system_design"}}]}
    s1, first = query(text, where)
    s2, second = query(f"  {text.upper()}  ", where)
    check("first query is a miss", s1 == 200 and first["cache"]["tier"] == "miss", str(first.get("cache")))
    check("the repeat (case and spacing changed) is an exact hit",
          s2 == 200 and second["cache"]["tier"] == "exact", str(second.get("cache")))
    check("with the same hits", [h["id"] for h in first["hits"]] == [h["id"] for h in second["hits"]] and first["hits"])
    check("and the caller's own query text", second["query"] == f"  {text.upper()}  ")
    other_where = {"$and": [{"company": {"$eq": "meta"}}, {"stage": {"$eq": "system_design"}}]}
    check("another company's filter is a miss", query(text, other_where)[1]["cache"]["tier"] == "miss")
    check("another top_k is a miss", query(text, where, top_k=2)[1]["cache"]["tier"] == "miss")

    print("3. corpus writes invalidate")
    gen_before = int(redis_cli("GET", "ragcache:gen") or 0)
    source = f"phase11-verify-{nonce}"
    status, ingested = call(AI, "POST", "/api/rag/ingest", {"documents": [
        {"source": source, "text": f"Throwaway verification text {nonce}.",
         "metadata": {"company": "phase11-verify", "stage": "none"}}]})
    check("ingest succeeded", status == 200 and ingested.get("ingested") == 1, str(ingested))
    gen_mid = int(redis_cli("GET", "ragcache:gen") or 0)
    check("ingest bumped the generation", gen_mid == gen_before + 1, f"{gen_before} -> {gen_mid}")
    check("the cached query is a miss after the write", query(text, where)[1]["cache"]["tier"] == "miss")
    check("and cached again after it", query(text, where)[1]["cache"]["tier"] == "exact")
    removed = compose("exec", "-T", "ai-service", "python", "-c",
                      f"from app.rag.service import RAGService; print(RAGService().delete_source({source!r}))")
    removed = removed.strip().splitlines()[-1] if removed else ""
    check("the throwaway document was deleted", removed == "1", removed)
    gen_after = int(redis_cli("GET", "ragcache:gen") or 0)
    check("delete bumped the generation", gen_after == gen_mid + 1, f"{gen_mid} -> {gen_after}")
    check("so the query misses again", query(text, where)[1]["cache"]["tier"] == "miss")

    print("4. bounds")
    keys = [k for k in redis_cli("--scan", "--pattern", "ragcache:*").splitlines()
            if k and k != "ragcache:gen"]
    ttls = {k: int(redis_cli("TTL", k)) for k in keys if not k.endswith(":all")}
    check("every entry key has a TTL", ttls and all(0 < t <= 21_600 for t in ttls.values()),
          f"{len(ttls)} keys, min {min(ttls.values()) if ttls else None}")
    stats = cache_stats()["retrievalCache"]
    check("entry count within its cap", stats["entries"] <= stats["maxEntries"],
          f"{stats['entries']} / {stats['maxEntries']}")

    print("5. Redis outage")
    compose("pause", "redis")
    try:
        t0 = time.time()
        status, during = query(text + " outage", where)
        elapsed = time.time() - t0
        check("retrieval still answers with Redis paused", status == 200 and during["hits"],
              f"{status}, {elapsed:.2f}s")
        check("served without the cache", during.get("cache", {}).get("tier") == "off", str(during.get("cache")))
        t0 = time.time()
        query(text + " outage 2", where)
        check("the breaker skips Redis on the next request", time.time() - t0 < 1.5, f"{time.time() - t0:.2f}s")
    finally:
        compose("unpause", "redis")
    print("     waiting out the 30 s breaker...")
    time.sleep(31)
    query(text + " back", where)
    check("the cache is used again after the breaker", query(text + " back", where)[1]["cache"]["tier"] == "exact")

    if not with_llm:
        return
    print("6. interview path (two opening questions)")
    suffix = uuid.uuid4().hex[:10]
    tokens = []
    for n in range(2):
        _, body = call(BACKEND, "POST", "/api/auth/register", {
            "email": f"phase11-{n}-{suffix}@example.com", "password": "Str0ngPassw0rd!",
            "username": f"p11v{n}{suffix}"})
        tokens.append(body.get("token"))
    if not check("registered two throwaway users", all(tokens)):
        return
    # A company/difficulty pair other runs are unlikely to have cached in this generation.
    redis_cli("INCR", "ragcache:gen")
    before = cache_stats()
    status, a = call(BACKEND, "POST", "/api/interviews",
                     {"company": "airbnb", "difficulty": "hard", "useResume": False}, tokens[0], timeout=240)
    mid = cache_stats()
    time.sleep(8)
    status_b, b = call(BACKEND, "POST", "/api/interviews",
                       {"company": "airbnb", "difficulty": "hard", "useResume": False}, tokens[1], timeout=240)
    after = cache_stats()
    check("both interviews opened", status == 201 and status_b == 201, f"{status}, {status_b}")
    # A reranker call that timed out still finishes (and is recorded) in the background.
    time.sleep(25)
    final = cache_stats()
    reranks = lambda s: s.get("byChain", {}).get("rerank", 0)
    rc = lambda s: s["retrievalCache"]
    stored = lambda s: rc(s)["stored"] + rc(s)["degraded"]
    check("the first opening retrieval missed and was cached",
          rc(mid)["miss"] > rc(before)["miss"] and stored(mid) > stored(before),
          f"stored {rc(mid)['stored'] - rc(before)['stored']}, degraded {rc(mid)['degraded'] - rc(before)['degraded']}")
    # An opening can retrieve twice (company filter empty -> whole corpus); every one must hit.
    check("the second's retrievals were all exact hits, no misses",
          rc(after)["exact"] > rc(mid)["exact"] and rc(after)["miss"] == rc(mid)["miss"],
          f"+{rc(after)['exact'] - rc(mid)['exact']} exact, +{rc(after)['miss'] - rc(mid)['miss']} miss")
    check("one reranker call between the two, not two", reranks(final) == reranks(before) + 1,
          f"{reranks(before)} -> {reranks(final)}")
    def opening(r):
        q = r.get("openingQuestion")
        return str(q.get("content", q) if isinstance(q, dict) else q)[:70]

    print(f"     opening questions: {opening(a)!r} / {opening(b)!r}")


if __name__ == "__main__":
    try:
        main(with_llm="--no-llm" not in sys.argv)
    finally:
        print(f"\n{len(PASSES)} passed, {len(FAILS)} failed")
        if FAILS:
            print("FAILED: " + "; ".join(FAILS))
    sys.exit(1 if FAILS else 0)
