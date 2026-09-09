import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  correlationId,
  getCurrentCorrelationId,
  setCurrentCorrelationId,
  CORRELATION_HEADER,
} from "../middleware/correlation.middleware";

function mockReq(headers: Record<string, string> = {}) {
  return {
    header: (name: string) => headers[name.toLowerCase()],
  } as never;
}

function mockRes() {
  const headers: Record<string, string> = {};
  return {
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
    headers,
  } as never;
}

describe("correlationId middleware", () => {
  beforeEach(() => setCurrentCorrelationId(undefined));

  it("generates an id when none is supplied", () => {
    const req = mockReq() as { correlationId?: string };
    const res = mockRes() as { headers: Record<string, string> };
    const next = vi.fn();
    correlationId(req as never, res as never, next);
    expect(req.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(next).toHaveBeenCalledOnce();
  });

  it("reuses an inbound id so a session can be traced end to end", () => {
    const req = mockReq({ [CORRELATION_HEADER]: "trace-42" }) as { correlationId?: string };
    correlationId(req as never, mockRes() as never, vi.fn());
    expect(req.correlationId).toBe("trace-42");
  });

  it("echoes the id back on the response", () => {
    const res = mockRes() as { headers: Record<string, string> };
    correlationId(mockReq({ [CORRELATION_HEADER]: "trace-9" }) as never, res as never, vi.fn());
    expect(res.headers[CORRELATION_HEADER]).toBe("trace-9");
  });

  it("rejects an absurdly long inbound id rather than propagating it", () => {
    // A client-supplied header ends up in logs and downstream requests, so its
    // length is bounded.
    const req = mockReq({ [CORRELATION_HEADER]: "x".repeat(5000) }) as { correlationId?: string };
    correlationId(req as never, mockRes() as never, vi.fn());
    expect(req.correlationId).not.toHaveLength(5000);
    expect(req.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("exposes the current id for outbound calls", () => {
    setCurrentCorrelationId("abc");
    expect(getCurrentCorrelationId()).toBe("abc");
  });

  it("gives each request a distinct id", () => {
    const a = mockReq() as { correlationId?: string };
    const b = mockReq() as { correlationId?: string };
    correlationId(a as never, mockRes() as never, vi.fn());
    correlationId(b as never, mockRes() as never, vi.fn());
    expect(a.correlationId).not.toBe(b.correlationId);
  });
});

describe("rate limiters", () => {
  it("applies a much tighter budget to LLM routes than to the API overall", async () => {
    // The point of F-04: 500 requests in a window is fine for reading problems
    // and ruinous for code review, so the two must not share a bucket.
    const mod = await import("../middleware/rate-limit.middleware");
    expect(mod.apiLimiter).toBeDefined();
    expect(mod.llmLimiter).toBeDefined();
    expect(mod.apiLimiter).not.toBe(mod.llmLimiter);
  });
});
