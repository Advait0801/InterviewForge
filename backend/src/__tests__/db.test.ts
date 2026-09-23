import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

const pools = vi.hoisted(() => [] as EventEmitter[]);

vi.mock("pg", () => ({
  Pool: class extends EventEmitter {
    constructor() {
      super();
      pools.push(this);
    }
  },
}));

describe("db pool", () => {
  it("survives Postgres dropping an idle connection instead of crashing the process", async () => {
    await import("../db");
    expect(pools).toHaveLength(1);
    // An EventEmitter with no "error" listener throws on emit -- in production that
    // was an uncaught exception that killed the backend whenever Postgres restarted.
    expect(() =>
      pools[0].emit("error", new Error("terminating connection due to administrator command"))
    ).not.toThrow();
  });
});
