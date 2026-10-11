"""
Retrieval cache (Phase 11): reuse a retrieval result for a repeated or near-duplicate query.

What it saves is whatever sits behind the query: the embedding call, the Chroma query, BM25
fusion, neighbour expansion and, on the reranked routes, an LLM call of roughly a second. The
interview path repeats one query per (company, stage, difficulty), so most of its traffic is
an *exact* repeat; near-duplicates come from free-text queries (the agent's searches,
/api/rag/query).

Two tiers, both inside one partition:
  exact     the normalised query text matches; no embedding is needed to find it.
  semantic  cosine(query, cached query) >= RAG_CACHE_SEMANTIC_THRESHOLD; needs the query's
            embedding, which a miss then reuses for retrieval, so a miss costs no extra call.

The semantic tier only runs where a reranker sits behind the query (RetrievalCache.lookup's
`semantic` argument). Elsewhere the embedding *is* most of the cost of retrieval (~180 of
~210 ms, measured), so a semantic hit, which must embed first, saves almost nothing while
still risking a wrong match (docs/eval/phase11.md).

A partition is everything besides the query text that decides the result: the metadata
filter, the route and the flags behind it, top_k, the parent window, the embedding model and
the corpus generation. A query is never matched against a result computed under another
filter, so "Amazon behavioural" can't be served Google's context however similar the wording.

Invalidation is by generation, not by deleting keys: every corpus write (ingest, delete,
live write-back, reindex) increments a counter that is part of the partition, so older
entries become unreachable at once and expire on their TTL.

Memory: Redis runs `noeviction` (BullMQ needs it) with 48 MB in production, so a cache that
grew without bound would eventually fail the code-run queue and the rate limits. Entries are
capped by count (RAG_CACHE_MAX_ENTRIES, oldest dropped first), by size (RAG_CACHE_MAX_ENTRY_BYTES,
larger results are not cached) and by TTL.

Backends follow D-063: REDIS_URL unset = in-process (single process; unit tests); set but
unreachable = bypassed, never an error. A failing Redis opens a short circuit breaker so a hung
server costs one timeout, not one per request.

Only the shared corpus is cached. Résumé retrieval (per-user collections) never comes here.
"""
from __future__ import annotations

import hashlib
import json
import logging
import math
import os
import re
import threading
import time
from array import array
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

log = logging.getLogger(__name__)


def _flag(name: str, default: str) -> bool:
    return os.getenv(name, default).strip().lower() in ("1", "true", "yes")


def _num(name: str, default: float, cast: Callable[[str], Any] = float):
    try:
        return cast(os.getenv(name, str(default)))
    except ValueError:
        return cast(str(default))


ENABLED = _flag("RAG_CACHE_ENABLED", "true")
SEMANTIC_ENABLED = _flag("RAG_CACHE_SEMANTIC_ENABLED", "false")
SEMANTIC_THRESHOLD = _num("RAG_CACHE_SEMANTIC_THRESHOLD", 0.80)
TTL_SECONDS = _num("RAG_CACHE_TTL_SECONDS", 21_600, int)
MAX_ENTRIES = _num("RAG_CACHE_MAX_ENTRIES", 200, int)
MAX_ENTRY_BYTES = _num("RAG_CACHE_MAX_ENTRY_BYTES", 65_536, int)
# A result whose reranker timed out or failed is first-stage order. It is kept only briefly:
# long enough that a slow provider doesn't cost every repeat another timeout and a billed,
# abandoned call; short enough that the properly ranked result replaces it soon.
DEGRADED_TTL_SECONDS = _num("RAG_CACHE_DEGRADED_TTL_SECONDS", 300, int)
# Candidates compared per semantic lookup; also bounds the work a lookup can do.
PARTITION_MAX = _num("RAG_CACHE_PARTITION_MAX", 64, int)
BREAKER_SECONDS = 30.0


def normalise(query: str) -> str:
    """Case and whitespace don't change what retrieval returns in any way that matters."""
    return re.sub(r"\s+", " ", query).strip().lower()


def query_hash(query: str) -> str:
    return hashlib.sha256(normalise(query).encode("utf-8")).hexdigest()[:32]


def partition_key(
    *, where: Optional[Dict[str, Any]], route: Optional[str], rerank: bool, hybrid: bool,
    mmr: bool, top_k: int, parent_window: int, embedding_model: str, generation: int,
) -> str:
    spec = json.dumps(
        {
            "where": where, "route": route, "rerank": rerank, "hybrid": hybrid, "mmr": mmr,
            "top_k": top_k, "parent_window": parent_window, "model": embedding_model,
            "gen": generation,
        },
        sort_keys=True, separators=(",", ":"),
    )
    return hashlib.sha256(spec.encode("utf-8")).hexdigest()[:32]


def pack_vector(vec: Sequence[float]) -> bytes:
    """Unit-normalised float32, so a lookup's cosine is a plain dot product."""
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return array("f", (v / norm for v in vec)).tobytes()


def unpack_vector(raw: bytes) -> array:
    out = array("f")
    out.frombytes(raw)
    return out


def cosine_packed(query: array, other: array) -> float:
    if len(query) != len(other):
        return -1.0
    return sum(map(float.__mul__, query, other))


# --- stores ------------------------------------------------------------------------

class MemoryStore:
    """In-process store with the Redis store's contract: count-capped, TTL'd, oldest out first."""

    backend = "memory"

    def __init__(self, *, max_entries: int, ttl_seconds: int, partition_max: int,
                 clock: Callable[[], float] = time.monotonic) -> None:
        self._lock = threading.Lock()
        self._gen = 0
        self._entries: "OrderedDict[str, Tuple[float, str, bytes, str]]" = OrderedDict()
        self._index: Dict[str, List[str]] = {}
        self._max, self._ttl, self._pmax, self._clock = max_entries, ttl_seconds, partition_max, clock

    def generation(self) -> int:
        return self._gen

    def bump(self) -> int:
        with self._lock:
            self._gen += 1
            return self._gen

    def candidates(self, partition: str) -> List[Tuple[str, str]]:
        now = self._clock()
        with self._lock:
            out = []
            for eid in self._index.get(partition, []):
                entry = self._entries.get(eid)
                if entry and entry[0] > now:
                    out.append((eid, entry[1]))
            return out

    def vectors(self, ids: List[str]) -> List[Optional[bytes]]:
        with self._lock:
            return [self._entries[i][2] if i in self._entries else None for i in ids]

    def result(self, eid: str) -> Optional[str]:
        now = self._clock()
        with self._lock:
            entry = self._entries.get(eid)
            return entry[3] if entry and entry[0] > now else None

    def put(self, partition: str, eid: str, qhash: str, vector: bytes, payload: str,
            ttl: Optional[int] = None) -> None:
        with self._lock:
            self._entries[eid] = (self._clock() + (ttl or self._ttl), qhash, vector, payload)
            self._entries.move_to_end(eid)
            ids = [i for i in self._index.get(partition, []) if i != eid]
            self._index[partition] = ([eid] + ids)[: self._pmax]
            while len(self._entries) > self._max:
                self._entries.popitem(last=False)

    def size(self) -> int:
        return len(self._entries)


class RedisStore:
    """Shared store. Keys:
      ragcache:gen          corpus generation (INCR on every corpus write)
      ragcache:all          ZSET of every entry id by insertion time: the global count cap
      ragcache:idx:<part>   LIST of "<id>:<qhash>", newest first, trimmed to PARTITION_MAX
      ragcache:e:<id>       packed query vector
      ragcache:r:<id>       the retrieval result (JSON)
    An index can name an entry the cap already dropped; readers treat that as a miss."""

    backend = "redis"

    def __init__(self, client: Any, *, max_entries: int, ttl_seconds: int, partition_max: int,
                 prefix: str = "ragcache") -> None:
        self._r = client
        self._max, self._ttl, self._pmax = max_entries, ttl_seconds, partition_max
        # The eval measures lookups against the live Redis under its own prefix.
        self.PREFIX = prefix

    def generation(self) -> int:
        return int(self._r.get(f"{self.PREFIX}:gen") or 0)

    def bump(self) -> int:
        return int(self._r.incr(f"{self.PREFIX}:gen"))

    def candidates(self, partition: str) -> List[Tuple[str, str]]:
        out = []
        for raw in self._r.lrange(f"{self.PREFIX}:idx:{partition}", 0, -1):
            text = raw.decode() if isinstance(raw, bytes) else str(raw)
            eid, _, qhash = text.partition(":")
            out.append((eid, qhash))
        return out

    def vectors(self, ids: List[str]) -> List[Optional[bytes]]:
        if not ids:
            return []
        return list(self._r.mget([f"{self.PREFIX}:e:{i}" for i in ids]))

    def result(self, eid: str) -> Optional[str]:
        raw = self._r.get(f"{self.PREFIX}:r:{eid}")
        if raw is None:
            return None
        return raw.decode() if isinstance(raw, bytes) else str(raw)

    def put(self, partition: str, eid: str, qhash: str, vector: bytes, payload: str,
            ttl: Optional[int] = None) -> None:
        p = self.PREFIX
        idx = f"{p}:idx:{partition}"
        pipe = self._r.pipeline(transaction=True)
        pipe.set(f"{p}:r:{eid}", payload, ex=ttl or self._ttl)
        pipe.set(f"{p}:e:{eid}", vector, ex=ttl or self._ttl)
        pipe.lpush(idx, f"{eid}:{qhash}")
        pipe.ltrim(idx, 0, self._pmax - 1)
        pipe.expire(idx, self._ttl)
        pipe.zadd(f"{p}:all", {eid: time.time()})
        pipe.zcard(f"{p}:all")
        count = pipe.execute()[-1]
        overflow = int(count) - self._max
        if overflow > 0:
            dropped = self._r.zpopmin(f"{p}:all", overflow)
            keys = []
            for member, _ in dropped:
                m = member.decode() if isinstance(member, bytes) else str(member)
                keys += [f"{p}:r:{m}", f"{p}:e:{m}"]
            if keys:
                self._r.delete(*keys)

    def size(self) -> int:
        return int(self._r.zcard(f"{self.PREFIX}:all"))


# --- the cache ---------------------------------------------------------------------

@dataclass
class Lookup:
    tier: str                      # "exact" | "semantic" | "miss" | "off"
    result: Optional[Dict[str, Any]] = None
    vector: Optional[List[float]] = None   # the query embedding, if one was computed
    similarity: Optional[float] = None
    partition: Optional[str] = None
    qhash: Optional[str] = None


class RetrievalCache:
    def __init__(self, store: Any, *, semantic: bool = SEMANTIC_ENABLED,
                 threshold: float = SEMANTIC_THRESHOLD, max_entry_bytes: int = MAX_ENTRY_BYTES,
                 enabled: bool = ENABLED, clock: Callable[[], float] = time.monotonic) -> None:
        self.store = store
        self.semantic = semantic
        self.threshold = threshold
        self.max_entry_bytes = max_entry_bytes
        self.enabled = enabled
        self._clock = clock
        self._broken_until = 0.0
        # A corpus write that couldn't bump the generation; retried before the next read.
        self._pending_bump = False
        self._lock = threading.Lock()
        self.stats = {"exact": 0, "semantic": 0, "miss": 0, "stored": 0, "degraded": 0,
                      "tooLarge": 0, "errors": 0, "invalidations": 0}

    # -- plumbing ----------------------------------------------------------------
    def _count(self, key: str) -> None:
        with self._lock:
            self.stats[key] += 1

    def _available(self) -> bool:
        return self.enabled and self._clock() >= self._broken_until

    def _fail(self, where: str, exc: Exception) -> None:
        self._count("errors")
        self._broken_until = self._clock() + BREAKER_SECONDS
        log.warning("retrieval cache %s failed (%s); bypassing for %.0fs",
                    where, type(exc).__name__, BREAKER_SECONDS)

    # -- public ------------------------------------------------------------------
    def generation(self) -> Optional[int]:
        if not self._available():
            return None
        try:
            if self._pending_bump:
                self.store.bump()
                self._pending_bump = False
            return self.store.generation()
        except Exception as exc:
            self._fail("generation", exc)
            return None

    def invalidate(self) -> None:
        """Every corpus write calls this. A failure is logged, not raised: the write itself
        succeeded. The breaker stops reads, and the bump is retried before this process reads
        again, so the entries the write made stale are never served from here."""
        if not self.enabled:
            return
        try:
            self.store.bump()
            self._count("invalidations")
        except Exception as exc:
            self._pending_bump = True
            self._fail("invalidate", exc)

    def lookup(self, query: str, partition: str, embed: Callable[[str], List[float]],
               *, semantic: bool = True) -> Lookup:
        """Exact first (no embedding), then semantic if both the cache and this call allow it.
        Raises only if `embed` does."""
        qhash = query_hash(query)
        found = Lookup(tier="miss", partition=partition, qhash=qhash)
        try:
            candidates = self.store.candidates(partition)
            for eid, h in candidates:
                if h == qhash:
                    payload = self.store.result(eid)
                    if payload is not None:
                        found.tier, found.result, found.similarity = "exact", json.loads(payload), 1.0
                        self._count("exact")
                        return found
        except Exception as exc:
            self._fail("lookup", exc)
            return Lookup(tier="off")

        if not (self.semantic and semantic):
            self._count("miss")
            return found

        found.vector = embed(query)
        try:
            ids = [eid for eid, _ in candidates]
            packed = unpack_vector(pack_vector(found.vector))
            best_id, best = None, -1.0
            for eid, raw in zip(ids, self.store.vectors(ids)):
                if raw is None:
                    continue
                score = cosine_packed(packed, unpack_vector(raw))
                if score > best:
                    best_id, best = eid, score
            if best_id is not None and best >= self.threshold:
                payload = self.store.result(best_id)
                if payload is not None:
                    found.tier, found.result, found.similarity = "semantic", json.loads(payload), round(best, 4)
                    self._count("semantic")
                    return found
            found.similarity = round(best, 4) if best_id is not None else None
        except Exception as exc:
            self._fail("lookup", exc)
            found.tier = "off"
            return found
        self._count("miss")
        return found

    def store_result(self, found: Lookup, result: Dict[str, Any], vector: List[float],
                     *, degraded: bool = False) -> None:
        if found.tier != "miss" or not found.partition:
            return
        payload = json.dumps(result, separators=(",", ":"), default=str)
        if len(payload) > self.max_entry_bytes:
            self._count("tooLarge")
            return
        eid = hashlib.sha256(f"{found.partition}:{found.qhash}".encode()).hexdigest()[:32]
        try:
            self.store.put(found.partition, eid, found.qhash or "", pack_vector(vector), payload,
                           ttl=DEGRADED_TTL_SECONDS if degraded else None)
            self._count("degraded" if degraded else "stored")
        except Exception as exc:
            self._fail("store", exc)

    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            stats = dict(self.stats)
        hits = stats["exact"] + stats["semantic"]
        lookups = hits + stats["miss"]
        try:
            size = self.store.size() if self._available() else None
        except Exception:
            size = None
        return {
            "enabled": self.enabled, "backend": getattr(self.store, "backend", "?"),
            "semanticEnabled": self.semantic, "threshold": self.threshold,
            "entries": size, "maxEntries": getattr(self.store, "_max", None),
            "hitRate": round(hits / lookups, 4) if lookups else None,
            **stats,
        }


def _build() -> RetrievalCache:
    url = os.getenv("REDIS_URL", "").strip()
    sizes = dict(max_entries=MAX_ENTRIES, ttl_seconds=TTL_SECONDS, partition_max=PARTITION_MAX)
    if not url:
        return RetrievalCache(MemoryStore(**sizes))
    import redis

    # Tighter timeouts than the live-fetch limiter: a cache is never worth waiting for.
    client = redis.Redis.from_url(url, socket_timeout=0.25, socket_connect_timeout=0.25)
    return RetrievalCache(RedisStore(client, **sizes))


cache = _build()
