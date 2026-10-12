import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb, serve, type FakeDb, type TestServer } from "./helpers/harness";

const db = vi.hoisted(() => ({ handlers: [], calls: [] }) as FakeDb);
vi.mock("../db", async () => (await import("./helpers/fake-db")).fakeDbModule(db));

import authRouter from "../routes/auth.routes";
import problemsRouter from "../routes/problems.routes";
import leaderboardRouter from "../routes/leaderboard.routes";
import { isDatabaseUnavailable } from "../services/errors";

/** What `pg` throws for a query while the database can't be reached. */
function pgError(message: string, code?: string) {
  return Object.assign(new Error(message), code ? { code } : {});
}

function failEveryQuery(err: Error) {
  db.handlers.push({
    match: /./,
    reply: () => {
      throw err;
    },
  });
}

let auth: TestServer;
let problems: TestServer;
let leaderboard: TestServer;
beforeAll(async () => {
  auth = await serve("/api/auth", authRouter);
  problems = await serve("/api/problems", problemsRouter);
  leaderboard = await serve("/api/leaderboard", leaderboardRouter);
});
afterAll(async () => {
  await auth.close();
  await problems.close();
  await leaderboard.close();
});
beforeEach(() => resetDb(db));

describe("database unreachable: a retryable 503, like every other dependency (D-055)", () => {
  const down = () => pgError("getaddrinfo ENOTFOUND postgres", "ENOTFOUND");

  it("on a public read", async () => {
    failEveryQuery(down());
    const r = await problems.request("GET", "/api/problems", { token: null });
    expect(r.status).toBe(503);
    expect(r.body).toEqual({ error: "Service temporarily unavailable. Please retry.", retryable: true });
  });

  it("on login: never a 401 or a 500 that reads as a wrong password or a bug", async () => {
    failEveryQuery(down());
    const r = await auth.request("POST", "/api/auth/login", {
      token: null,
      body: { identifier: "someone", password: "Str0ngPassw0rd!" },
    });
    expect(r.status).toBe(503);
    expect(r.body.retryable).toBe(true);
  });

  it("while Postgres restarts (57P01)", async () => {
    failEveryQuery(pgError("terminating connection due to administrator command", "57P01"));
    expect((await leaderboard.request("GET", "/api/leaderboard", { token: null })).status).toBe(503);
  });

  it("but a query error is still a 500", async () => {
    failEveryQuery(pgError('relation "problems" does not exist', "42P01"));
    const r = await problems.request("GET", "/api/problems", { token: null });
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ error: "Internal server error" });
  });
});

describe("isDatabaseUnavailable", () => {
  it.each([
    ["ENOTFOUND", "getaddrinfo ENOTFOUND postgres"],
    ["ECONNREFUSED", "connect ECONNREFUSED 172.18.0.2:5432"],
    ["08006", "connection failure"],
    ["57P03", "the database system is starting up"],
    ["53300", "sorry, too many clients already"],
  ])("%s is an outage", (code, message) => {
    expect(isDatabaseUnavailable(pgError(message, code))).toBe(true);
  });

  it.each(["Connection terminated unexpectedly", "timeout exceeded when trying to connect"])(
    "pg's uncoded '%s' is an outage",
    (message) => {
      expect(isDatabaseUnavailable(pgError(message))).toBe(true);
    }
  );

  it.each([
    ["23505", "duplicate key value violates unique constraint"],
    ["22P02", "invalid input syntax for type uuid"],
    ["42703", 'column "nope" does not exist'],
  ])("%s is a bug or bad input, not an outage", (code, message) => {
    expect(isDatabaseUnavailable(pgError(message, code))).toBe(false);
  });

  it("ignores non-errors", () => {
    expect(isDatabaseUnavailable("ECONNREFUSED")).toBe(false);
    expect(isDatabaseUnavailable(null)).toBe(false);
  });
});
