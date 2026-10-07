import { Redis, type RedisOptions } from "ioredis";

/**
 * Redis connections (D-063). Everything that uses Redis degrades when REDIS_URL is unset
 * or Redis is down: rate limits fall back to per-instance memory, the leaderboard is
 * computed directly, and code runs bypass the queue only when REDIS_URL is unset (a set
 * but unreachable Redis makes runs a retryable 503, never an unbounded fan-out).
 */
export function redisUrl(): string | null {
  return process.env.REDIS_URL?.trim() || null;
}

let shared: Redis | null | undefined;

/**
 * The shared client for commands (rate limits, cache). Fails fast while Redis is down
 * instead of queueing commands, so callers can fall back immediately.
 */
export function getRedis(): Redis | null {
  if (shared !== undefined) return shared;
  const url = redisUrl();
  shared = url ? createConnection({ enableOfflineQueue: false, maxRetriesPerRequest: 1 }) : null;
  return shared;
}

/** A dedicated connection; BullMQ needs its own with maxRetriesPerRequest: null. */
export function createConnection(options: RedisOptions = {}, url = redisUrl()): Redis {
  if (!url) throw new Error("REDIS_URL is not set");
  const client = new Redis(url, { lazyConnect: false, ...options });
  // Without a listener a dropped connection is an unhandled error (cf. the pg pool, D-055).
  client.on("error", (err) => {
    console.error(JSON.stringify({ level: "error", event: "redis_error", message: err.message }));
  });
  return client;
}

/** Test hook: drop the cached client so the next getRedis() re-reads REDIS_URL. */
export async function resetRedisForTests(): Promise<void> {
  if (shared) await shared.quit().catch(() => undefined);
  shared = undefined;
}
