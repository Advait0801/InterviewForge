/**
 * The auth routes that send email (D-072): what gets sent, and that sending never changes a
 * response -- not on failure, and not by revealing whether an account exists.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { USER_ID, callsMatching, resetDb, serve, type FakeDb, type TestServer } from "./helpers/harness";
import { setMailer, settleEmails, type Email } from "../services/email";

const db = vi.hoisted(() => ({ handlers: [], calls: [] }) as FakeDb);
vi.mock("../db", async () => (await import("./helpers/fake-db")).fakeDbModule(db));

const sent: Email[] = [];
let failing = false;
let api: TestServer;

beforeAll(async () => {
  process.env.FRONTEND_URL = "https://app.example.com";
  api = await serve("/api/auth", (await import("../routes/auth.routes")).default);
});
afterAll(() => api.close());

beforeEach(() => {
  resetDb(db);
  sent.length = 0;
  failing = false;
  setMailer({
    provider: "resend",
    send: async (email) => {
      if (failing) throw new Error("provider down");
      sent.push(email);
    },
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const existing = "ada@example.com";

describe("register", () => {
  beforeEach(() => {
    db.handlers.push(
      { match: "SELECT id FROM users WHERE LOWER(email) = LOWER($1)", reply: [] },
      { match: "SELECT id FROM users WHERE LOWER(username) = LOWER($1)", reply: [] },
      { match: "INSERT INTO users", reply: [{ id: USER_ID, token_version: 0 }] }
    );
  });

  it("sends a verification email with the stored token's link", async () => {
    const r = await api.request("POST", "/api/auth/register", { body: { username: "ada", email: existing, password: "Str0ngPass!" }, token: null });
    expect(r.status).toBe(201);
    await settleEmails();
    expect(sent).toHaveLength(1);
    const token = callsMatching(db, "INSERT INTO users")[0].params.find((p) => typeof p === "string" && /^[0-9a-f]{40,}$/i.test(p)) as string;
    expect(token).toBeTruthy();
    expect(sent[0]).toMatchObject({ to: existing, subject: "Confirm your email for InterviewForge" });
    expect(sent[0].text).toContain(`https://app.example.com/verify-email?token=${token}`);
  });

  it("a failing provider doesn't fail sign-up", async () => {
    failing = true;
    const r = await api.request("POST", "/api/auth/register", { body: { username: "ada", email: existing, password: "Str0ngPass!" }, token: null });
    expect(r.status).toBe(201);
    expect(r.body.token).toBeTruthy();
  });
});

describe("forgot-password", () => {
  beforeEach(() => {
    db.handlers.push(
      { match: "AND password_hash IS NOT NULL", reply: (p) => (String(p[0]).toLowerCase() === existing ? [{ id: USER_ID }] : []) },
      { match: "UPDATE users SET password_reset_token", reply: [] }
    );
  });

  const ask = (email: string) => api.request("POST", "/api/auth/forgot-password", { body: { email }, token: null });

  it("emails a reset link to an existing account", async () => {
    expect((await ask(existing)).status).toBe(200);
    await settleEmails();
    const token = callsMatching(db, "UPDATE users SET password_reset_token")[0].params[0] as string;
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain(`https://app.example.com/reset-password?token=${token}`);
  });

  it("the same answer whether or not the account exists, and nothing sent for one that doesn't", async () => {
    const yes = await ask(existing);
    const no = await ask("nobody@example.com");
    await settleEmails();
    expect(no).toEqual(yes);
    expect(sent.map((e) => e.to)).toEqual([existing]);
  });

  it("doesn't wait for the provider: the response comes before a slow send finishes", async () => {
    let release!: () => void;
    setMailer({ provider: "resend", send: () => new Promise<void>((r) => (release = r)) });
    const r = await ask(existing);
    expect(r.status).toBe(200);
    release();
    await settleEmails();
  });

  it("a failing provider doesn't change the answer", async () => {
    failing = true;
    expect(await ask(existing)).toEqual(await ask("nobody@example.com"));
  });
});

describe("resend-verification", () => {
  const state = (overrides: Record<string, unknown> = {}) => ({
    email: existing,
    username: "ada",
    email_verified: false,
    // Issued 10 minutes ago: expiry is issue + 7 days.
    email_verification_expires_at: new Date(Date.now() - 10 * 60_000 + 7 * 86_400_000).toISOString(),
    ...overrides,
  });

  it("sends a new link and replaces the old token", async () => {
    db.handlers.push(
      { match: "SELECT email, username, email_verified", reply: [state()] },
      { match: "UPDATE users SET email_verification_token", reply: [] }
    );
    expect((await api.request("POST", "/api/auth/resend-verification")).status).toBe(200);
    await settleEmails();
    const token = callsMatching(db, "UPDATE users SET email_verification_token")[0].params[1];
    expect(sent[0].text).toContain(`verify-email?token=${token}`);
  });

  it("409 already_verified", async () => {
    db.handlers.push({ match: "SELECT email, username, email_verified", reply: [state({ email_verified: true })] });
    expect(await api.request("POST", "/api/auth/resend-verification")).toMatchObject({ status: 409, body: { code: "already_verified" } });
  });

  it("429 within a minute of the last email, with how long to wait", async () => {
    db.handlers.push({
      match: "SELECT email, username, email_verified",
      reply: [state({ email_verification_expires_at: new Date(Date.now() - 20_000 + 7 * 86_400_000).toISOString() })],
    });
    const r = await api.request("POST", "/api/auth/resend-verification");
    expect(r.status).toBe(429);
    expect(r.body.retryAfterSeconds).toBeGreaterThanOrEqual(39);
    expect(r.body.retryAfterSeconds).toBeLessThanOrEqual(41);
    expect(callsMatching(db, "UPDATE users SET email_verification_token")).toHaveLength(0);
    await settleEmails();
    expect(sent).toHaveLength(0);
  });

  it("401 when signed out", async () => {
    expect((await api.request("POST", "/api/auth/resend-verification", { token: null })).status).toBe(401);
  });
});
