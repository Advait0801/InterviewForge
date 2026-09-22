import { describe, it, expect, vi } from "vitest";
import { resolveJwtSecret, MIN_JWT_SECRET_LENGTH, signAccessToken } from "../auth";
import { optionalAuth, type AuthRequest } from "../middleware/auth.middleware";
import { userOrIpKey } from "../middleware/rate-limit.middleware";

describe("resolveJwtSecret", () => {
  it("refuses a missing secret instead of falling back", () => {
    expect(() => resolveJwtSecret({})).toThrow(/not set/);
    expect(() => resolveJwtSecret({ JWT_SECRET: "   " })).toThrow(/not set/);
  });

  it("refuses the old published default even though it used to work", () => {
    expect(() => resolveJwtSecret({ JWT_SECRET: "dev-secret-change-me" })).toThrow(/published default/);
  });

  it("refuses a secret shorter than the minimum", () => {
    expect(() => resolveJwtSecret({ JWT_SECRET: "x".repeat(MIN_JWT_SECRET_LENGTH - 1) })).toThrow(/at least/);
  });

  it("accepts a long enough secret", () => {
    const secret = "k".repeat(MIN_JWT_SECRET_LENGTH);
    expect(resolveJwtSecret({ JWT_SECRET: secret })).toBe(secret);
  });
});

// F-23: apiLimiter is mounted after optionalAuth, so the key it sees depends on the token.
describe("apiLimiter keying after optionalAuth", () => {
  function keyFor(authorization?: string): string {
    const req = {
      headers: authorization ? { authorization } : {},
      ip: "203.0.113.7",
    } as unknown as AuthRequest;
    const next = vi.fn();
    optionalAuth(req, {} as never, next);
    expect(next).toHaveBeenCalledOnce();
    return userOrIpKey(req);
  }

  it("keys a valid token on the user, so users behind one NAT get separate buckets", () => {
    const a = keyFor(`Bearer ${signAccessToken({ userId: "user-a" })}`);
    const b = keyFor(`Bearer ${signAccessToken({ userId: "user-b" })}`);
    expect(a).toBe("user:user-a");
    expect(b).toBe("user:user-b");
  });

  it("falls back to IP for an anonymous request", () => {
    expect(keyFor()).toMatch(/^ip:/);
  });

  it("falls back to IP for a forged token, so a caller can't pick someone else's bucket", () => {
    const token = signAccessToken({ userId: "victim" });
    const [header, , sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ userId: "victim" })).toString("base64url");
    expect(keyFor(`Bearer ${header}.${forged}x.${sig}`)).toMatch(/^ip:/);
  });
});
