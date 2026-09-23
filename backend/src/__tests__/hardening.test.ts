import { describe, it, expect, vi } from "vitest";

// optionalAuth checks token_version in the database (D-055); every user here is at 0.
vi.mock("../db", () => ({ query: vi.fn(async () => ({ rows: [{ token_version: 0 }] })) }));
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
  async function keyFor(authorization?: string): Promise<string> {
    const req = {
      headers: authorization ? { authorization } : {},
      ip: "203.0.113.7",
    } as unknown as AuthRequest;
    const next = vi.fn();
    await optionalAuth(req, {} as never, next);
    expect(next).toHaveBeenCalledOnce();
    return userOrIpKey(req);
  }

  it("keys a valid token on the user, so users behind one NAT get separate buckets", async () => {
    const a = await keyFor(`Bearer ${signAccessToken({ userId: "user-a", tokenVersion: 0 })}`);
    const b = await keyFor(`Bearer ${signAccessToken({ userId: "user-b", tokenVersion: 0 })}`);
    expect(a).toBe("user:user-a");
    expect(b).toBe("user:user-b");
  });

  it("falls back to IP for an anonymous request", async () => {
    expect(await keyFor()).toMatch(/^ip:/);
  });

  it("falls back to IP for a forged token, so a caller can't pick someone else's bucket", async () => {
    const token = signAccessToken({ userId: "victim", tokenVersion: 0 });
    const [header, , sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ userId: "victim" })).toString("base64url");
    expect(await keyFor(`Bearer ${header}.${forged}x.${sig}`)).toMatch(/^ip:/);
  });
});
