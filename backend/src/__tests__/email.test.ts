import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  EmailConfigError,
  EmailDeliveryError,
  ResendMailer,
  deliverInBackground,
  maskAddress,
  resetEmail,
  resolveEmailConfig,
  setMailer,
  settleEmails,
  verificationEmail,
} from "../services/email";

const KEY = "re_test_SECRETKEY123";

/** A stand-in for Resend's API on a real socket, so the mailer's own fetch is exercised. */
const fake = { mode: "ok" as "ok" | "reject" | "hang", requests: [] as Array<{ headers: Record<string, unknown>; body: any }> };
let server: Server;
let url: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      fake.requests.push({ headers: req.headers, body: JSON.parse(raw) });
      if (fake.mode === "hang") return; // never answers
      if (fake.mode === "reject") {
        res.writeHead(403, { "Content-Type": "application/json" }).end(JSON.stringify({ name: "validation_error", message: "You can only send testing emails to your own email address" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ id: "email_123" }));
    });
  });
  server.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/emails`;
});
afterAll(() => {
  server.closeAllConnections();
  server.close();
});
afterEach(() => {
  fake.mode = "ok";
  fake.requests = [];
  setMailer(null);
  vi.restoreAllMocks();
});

describe("resolveEmailConfig", () => {
  it("defaults to log, even when a key is present (local dev keeps logging)", () => {
    expect(resolveEmailConfig({ RESEND_API_KEY: KEY })).toEqual({ provider: "log" });
    expect(resolveEmailConfig({})).toEqual({ provider: "log" });
  });

  it("resend needs a key, or startup fails", () => {
    expect(() => resolveEmailConfig({ EMAIL_PROVIDER: "resend" })).toThrow(EmailConfigError);
    expect(() => resolveEmailConfig({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "  " })).toThrow(/not set/);
    expect(() => resolveEmailConfig({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "sk_live_x" })).toThrow(/re_/);
  });

  it("rejects an unknown provider instead of falling back", () => {
    expect(() => resolveEmailConfig({ EMAIL_PROVIDER: "smtp" })).toThrow(/log or resend/);
  });

  it("resend with a key, and the default sender", () => {
    expect(resolveEmailConfig({ EMAIL_PROVIDER: "Resend", RESEND_API_KEY: KEY })).toEqual({
      provider: "resend",
      apiKey: KEY,
      from: "InterviewForge <onboarding@resend.dev>",
    });
  });
});

describe("ResendMailer", () => {
  it("posts Resend's shape with the key as a bearer token", async () => {
    await new ResendMailer(KEY, "IF <a@b.dev>", url).send(resetEmail("ada@example.com", "http://x/reset?token=t"));
    const [r] = fake.requests;
    expect(r.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(r.body).toMatchObject({ from: "IF <a@b.dev>", to: ["ada@example.com"], subject: "Reset your InterviewForge password" });
    expect(r.body.text).toContain("http://x/reset?token=t");
    expect(r.body.html).toContain('href="http://x/reset?token=t"');
  });

  it("a refusal is an EmailDeliveryError carrying Resend's reason and never the key", async () => {
    fake.mode = "reject";
    const err = await new ResendMailer(KEY, "x", url).send(resetEmail("a@b.c", "l")).catch((e) => e);
    expect(err).toBeInstanceOf(EmailDeliveryError);
    expect(err.message).toMatch(/403.*own email address/);
    expect(err.message).not.toContain(KEY);
  });

  it("times out instead of hanging", async () => {
    fake.mode = "hang";
    const err = await new ResendMailer(KEY, "x", url, 100).send(resetEmail("a@b.c", "l")).catch((e) => e);
    expect(err).toBeInstanceOf(EmailDeliveryError);
    expect(err.message).toBe("Email provider timed out");
  });

  it("unreachable is reported as such, without the key", async () => {
    const err = await new ResendMailer(KEY, "x", "http://127.0.0.1:1/emails").send(resetEmail("a@b.c", "l")).catch((e) => e);
    expect(err.message).toBe("Email provider unreachable");
  });

  it("logs a masked address on success, never the key or the link", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await new ResendMailer(KEY, "x", url).send(resetEmail("ada@example.com", "http://x/reset?token=SECRETTOKEN"));
    const logged = log.mock.calls.flat().join(" ");
    expect(logged).toContain("a***@example.com");
    expect(logged).toContain("email_123");
    for (const secret of [KEY, "SECRETTOKEN", "ada@example.com"]) expect(logged).not.toContain(secret);
  });
});

describe("deliverInBackground", () => {
  it("never throws to the caller; a failure is logged with a masked address", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    setMailer({ provider: "resend", send: async () => { throw new EmailDeliveryError("Email provider returned 500"); } });
    expect(() => deliverInBackground(resetEmail("ada@example.com", "l"), "reset email")).not.toThrow();
    await settleEmails();
    expect(error.mock.calls.flat().join(" ")).toMatch(/reset email to a\*\*\*@example\.com failed: Email provider returned 500/);
  });
});

describe("templates", () => {
  it("escape what the user chose (a username) in the HTML", () => {
    const e = verificationEmail("a@b.c", "<script>x</script>", "http://x/verify?token=t&a=1");
    expect(e.html).not.toContain("<script>x</script>");
    expect(e.html).toContain("&lt;script&gt;");
    expect(e.html).toContain('href="http://x/verify?token=t&amp;a=1"');
    expect(e.text).toContain("http://x/verify?token=t&a=1");
  });

  it("mask addresses for logs", () => {
    expect(maskAddress("ada@example.com")).toBe("a***@example.com");
    expect(maskAddress("nope")).toBe("***");
  });
});
