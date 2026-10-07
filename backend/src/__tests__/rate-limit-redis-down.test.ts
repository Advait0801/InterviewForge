import { describe, expect, it, vi } from "vitest";

/**
 * Booting with REDIS_URL set but Redis unreachable must not crash the process: the
 * rate-limit store loads Lua scripts in its constructor, and an unhandled rejection exits
 * Node (D-063). Vitest also fails the run on any unhandled rejection.
 */
describe("rate limiters with Redis unreachable", () => {
  it("construct without an unhandled rejection and still limit from memory", async () => {
    vi.resetModules();
    process.env.REDIS_URL = "redis://127.0.0.1:1"; // nothing listens on port 1
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => rejections.push(reason);
    process.on("unhandledRejection", onRejection);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { loginLimiter } = await import("../middleware/rate-limit.middleware");
      await new Promise((r) => setTimeout(r, 300));
      expect(rejections).toEqual([]);

      // A request through the limiter is still counted (memory fallback), not an error.
      const req = { ip: "203.0.113.9", app: { get: () => false }, headers: {} } as never;
      const headers: Record<string, string> = {};
      const res = { setHeader: (k: string, v: string) => (headers[k] = v), statusCode: 200, on: () => {}, once: () => {} } as never;
      await new Promise<void>((resolve, reject) => loginLimiter(req, res, (err?: unknown) => (err ? reject(err) : resolve())));
    } finally {
      process.off("unhandledRejection", onRejection);
      warn.mockRestore();
      error.mockRestore();
      const { resetRedisForTests } = await import("../redis");
      await resetRedisForTests();
      delete process.env.REDIS_URL;
    }
  });
});
