import type { ClientRateLimitInfo, Options, Store } from "express-rate-limit";
import { describe, expect, it, vi } from "vitest";
import { FallbackStore } from "../middleware/fallback-rate-limit-store";

class FlakyStore implements Store {
  down = false;
  hits = new Map<string, number>();
  init() {}
  async increment(key: string): Promise<ClientRateLimitInfo> {
    if (this.down) throw new Error("ECONNREFUSED");
    const totalHits = (this.hits.get(key) ?? 0) + 1;
    this.hits.set(key, totalHits);
    return { totalHits, resetTime: undefined };
  }
  async decrement() {}
  async resetKey() {}
}

const options = { windowMs: 60_000 } as Options;

describe("FallbackStore (D-063)", () => {
  it("counts in Redis while it's up", async () => {
    const primary = new FlakyStore();
    const store = new FallbackStore(primary, "rl:test:");
    store.init(options);
    await store.increment("k");
    expect((await store.increment("k")).totalHits).toBe(2);
    expect(primary.hits.get("k")).toBe(2);
  });

  it("keeps limiting from memory while Redis is down, and warns once", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const primary = new FlakyStore();
    primary.down = true;
    const store = new FallbackStore(primary, "rl:test:");
    store.init(options);
    const counts = [];
    for (let i = 0; i < 3; i++) counts.push((await store.increment("k")).totalHits);
    expect(counts).toEqual([1, 2, 3]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("goes back to Redis when it recovers", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const primary = new FlakyStore();
    const store = new FallbackStore(primary, "rl:test:");
    store.init(options);
    primary.down = true;
    await store.increment("k");
    primary.down = false;
    await store.increment("k");
    expect(primary.hits.get("k")).toBe(1);
  });
});
