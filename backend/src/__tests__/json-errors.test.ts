import { readFileSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { serve, type FakeDb, type TestServer } from "./helpers/harness";

const db = vi.hoisted(() => ({ handlers: [], calls: [] }) as FakeDb);
vi.mock("../db", async () => (await import("./helpers/fake-db")).fakeDbModule(db));

import authRouter from "../routes/auth.routes";

// A route that fails without answering, as a bug would: Express 5 forwards both.
const broken = Router();
broken.get("/sync", () => {
  throw new Error("boom at /app/src/secret.ts:12");
});
broken.get("/async", async () => {
  throw new Error("boom at /app/src/secret.ts:34");
});

let auth: TestServer;
let failing: TestServer;
beforeAll(async () => {
  auth = await serve("/api/auth", authRouter);
  failing = await serve("/api/broken", broken);
});
afterAll(async () => {
  await auth.close();
  await failing.close();
});

/** A raw request, so the body can be anything and the reply is taken as it comes. */
async function raw(server: TestServer, method: string, url: string, body?: string) {
  const res = await fetch(`${server.url}${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body,
  });
  return { status: res.status, type: res.headers.get("content-type") ?? "", text: await res.text() };
}

const STACK = /\bat \S+ \(|node_modules|\/app\/|<html|<pre>/i;

describe("errors are JSON and never carry a stack trace", () => {
  it("malformed JSON is a 400", async () => {
    const r = await raw(auth, "POST", "/api/auth/login", '{"identifier": ');
    expect(r.status).toBe(400);
    expect(r.type).toMatch(/^application\/json/);
    expect(JSON.parse(r.text)).toEqual({ error: "Request body is not valid JSON" });
    expect(r.text).not.toMatch(STACK);
  });

  it("a body over the 8 MB limit is a 413", async () => {
    const r = await raw(auth, "POST", "/api/auth/login", JSON.stringify({ identifier: "x".repeat(9 * 1024 * 1024) }));
    expect(r.status).toBe(413);
    expect(JSON.parse(r.text)).toEqual({ error: "Request body is too large" });
  });

  it("an unknown path is a 404", async () => {
    for (const url of ["/api/nope", "/api/users/../../etc/passwd", "/"]) {
      const r = await raw(auth, "GET", url);
      expect(r.status).toBe(404);
      expect(JSON.parse(r.text)).toEqual({ error: "Not found" });
    }
  });

  it.each(["/api/broken/sync", "/api/broken/async"])("a route failing without answering (%s) is a 500", async (url) => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await raw(failing, "GET", url);
    expect(r.status).toBe(500);
    expect(JSON.parse(r.text)).toEqual({ error: "Internal server error" });
    expect(r.text).not.toMatch(/secret\.ts/);
    expect(errors).toHaveBeenCalled(); // logged for us, not sent to them
    errors.mockRestore();
  });
});

describe("index.ts", () => {
  const source = readFileSync(path.join(__dirname, "..", "index.ts"), "utf8");

  it("installs both handlers after the routes, error handler last", () => {
    const routes = source.indexOf("for (const [mountPath, router] of API_ROUTES)");
    const nf = source.indexOf("app.use(notFound)");
    const eh = source.indexOf("app.use(errorHandler)");
    expect(routes).toBeGreaterThan(-1);
    expect(nf).toBeGreaterThan(routes);
    expect(eh).toBeGreaterThan(nf);
  });

  it("the production image runs with NODE_ENV=production", () => {
    const dockerfile = readFileSync(path.join(__dirname, "..", "..", "Dockerfile.prod"), "utf8");
    const runtimeStage = dockerfile.slice(dockerfile.lastIndexOf("FROM "));
    expect(runtimeStage).toMatch(/^ENV NODE_ENV=production$/m);
  });
});
