import { describe, it, expect } from "vitest";
import { randomToken, hoursFromNow } from "../auth-tokens";

describe("randomToken", () => {
  it("returns 64 hex characters (32 bytes)", () => {
    expect(randomToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not repeat across many calls", () => {
    const tokens = new Set(Array.from({ length: 500 }, () => randomToken()));
    expect(tokens.size).toBe(500);
  });
});

describe("hoursFromNow", () => {
  it("returns a time the given number of hours ahead", () => {
    const before = Date.now();
    const result = hoursFromNow(2).getTime();
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before + 2 * 3600_000);
    expect(result).toBeLessThanOrEqual(after + 2 * 3600_000);
  });

  it("supports fractional hours", () => {
    const delta = hoursFromNow(0.5).getTime() - Date.now();
    expect(delta).toBeGreaterThan(29 * 60_000);
    expect(delta).toBeLessThan(31 * 60_000);
  });

  it("returns a past date for a negative value", () => {
    expect(hoursFromNow(-1).getTime()).toBeLessThan(Date.now());
  });
});
