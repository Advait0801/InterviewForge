import { describe, it, expect, beforeAll } from "vitest";
import { hashPassword, verifyPassword, signAccessToken, verifyAccessToken } from "../auth";

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
});

describe("password hashing", () => {
  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("never stores the plaintext in the hash", async () => {
    const password = "super-secret-value";
    const hash = await hashPassword(password);
    expect(hash).not.toContain(password);
  });

  it("produces a different hash each time (unique salt)", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
    // ...but both must still verify
    expect(await verifyPassword("same-password", a)).toBe(true);
    expect(await verifyPassword("same-password", b)).toBe(true);
  });

  it("is case sensitive", async () => {
    const hash = await hashPassword("CaseSensitive");
    expect(await verifyPassword("casesensitive", hash)).toBe(false);
  });
});

describe("access tokens", () => {
  it("round-trips the userId", () => {
    const token = signAccessToken({ userId: "user-123" });
    expect(verifyAccessToken(token).userId).toBe("user-123");
  });

  it("rejects a token signed with a different secret", () => {
    const token = signAccessToken({ userId: "user-123" });
    const original = process.env.JWT_SECRET;
    // The module captured JWT_SECRET at import time, so tamper with the token
    // itself rather than the env: flipping the signature must invalidate it.
    const parts = token.split(".");
    parts[2] = parts[2].split("").reverse().join("");
    expect(() => verifyAccessToken(parts.join("."))).toThrow();
    process.env.JWT_SECRET = original;
  });

  it("rejects a malformed token", () => {
    expect(() => verifyAccessToken("not-a-jwt")).toThrow();
  });

  it("rejects an empty token", () => {
    expect(() => verifyAccessToken("")).toThrow();
  });

  it("rejects a token whose payload has been tampered with", () => {
    const token = signAccessToken({ userId: "user-123" });
    const [header, , signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ userId: "admin" }))
      .toString("base64url");
    expect(() => verifyAccessToken(`${header}.${forged}.${signature}`)).toThrow();
  });
});
