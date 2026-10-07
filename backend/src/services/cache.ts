import { getRedis } from "../redis";

/**
 * A small read-through cache in Redis (D-063). Every failure falls through to computing the
 * value, so a Redis outage costs speed, never correctness. Invalidation is by version: a
 * write bumps `cache:<name>:v`, and every key built from the old version is simply never
 * read again (and expires on its TTL).
 */

/** The current version for `name`, or null when there's no usable cache. */
async function cacheVersion(name: string): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    return (await redis.get(`cache:${name}:v`)) ?? "0";
  } catch {
    return null;
  }
}

export async function bumpCacheVersion(name: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.incr(`cache:${name}:v`);
  } catch {
    // The TTL bounds staleness if this write is lost.
  }
}

/** `compute()` once per (name, version, key) within `ttlSeconds`. */
export async function cached<T>(name: string, key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  const version = await cacheVersion(name);
  if (version === null) return compute();
  const redis = getRedis()!;
  const fullKey = `cache:${name}:${version}:${key}`;
  try {
    const hit = await redis.get(fullKey);
    if (hit !== null) return JSON.parse(hit) as T;
  } catch {
    return compute();
  }
  const value = await compute();
  await redis.set(fullKey, JSON.stringify(value), "EX", ttlSeconds).catch(() => undefined);
  return value;
}
