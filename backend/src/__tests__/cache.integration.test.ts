import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/** The read-through cache against a real Redis (D-063). Set REDIS_TEST_URL to run. */
const url = process.env.REDIS_TEST_URL;

describe.skipIf(!url)("cache (Redis)", () => {
  let cache: typeof import("../services/cache");
  let redis: typeof import("../redis");
  const name = `test-${process.pid}-${Date.now()}`;

  beforeAll(async () => {
    process.env.REDIS_URL = url;
    redis = await import("../redis");
    await redis.resetRedisForTests();
    cache = await import("../services/cache");
  });
  afterAll(async () => {
    const client = redis.getRedis();
    if (client) {
      const keys = await client.keys(`cache:${name}:*`);
      if (keys.length) await client.del(...keys);
    }
    await redis.resetRedisForTests();
    delete process.env.REDIS_URL;
  });
  beforeEach(async () => {
    // Before it connects the client fails fast and the cache is bypassed, by design.
    const client = redis.getRedis()!;
    if (client.status !== "ready") await new Promise((r) => client.once("ready", r));
  });

  it("computes once, then serves from Redis", async () => {
    const compute = vi.fn(async () => ({ value: 42 }));
    expect(await cache.cached(name, "k", 60, compute)).toEqual({ value: 42 });
    expect(await cache.cached(name, "k", 60, compute)).toEqual({ value: 42 });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("recomputes after a version bump", async () => {
    const compute = vi.fn(async () => "fresh");
    await cache.cached(name, "v", 60, compute);
    await cache.bumpCacheVersion(name);
    await cache.cached(name, "v", 60, compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });
});

describe("cache without Redis", () => {
  it("always computes", async () => {
    delete process.env.REDIS_URL;
    const { cached } = await import("../services/cache");
    const compute = vi.fn(async () => 1);
    await cached("none", "k", 60, compute);
    await cached("none", "k", 60, compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });
});
