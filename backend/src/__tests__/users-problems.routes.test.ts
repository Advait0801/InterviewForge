import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  callsMatching,
  fakeQuery,
  resetDb,
  serve,
  USER_ID,
  type FakeDb,
  type TestServer,
} from "./helpers/harness";

const db = vi.hoisted(() => ({ handlers: [], calls: [] }) as FakeDb);
vi.mock("../db", () => ({ query: vi.fn((sql: string, params: unknown[]) => fakeQuery(db, sql, params)) }));

import usersRouter from "../routes/users.routes";
import problemsRouter from "../routes/problems.routes";

const PROBLEM = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

let users: TestServer;
let problems: TestServer;
beforeAll(async () => {
  users = await serve("/api/users", usersRouter);
  problems = await serve("/api/problems", problemsRouter);
});
afterAll(async () => {
  await users.close();
  await problems.close();
});
beforeEach(() => resetDb(db));

describe("users: own account", () => {
  it.each(["/api/users/me", "/api/users/stats", "/api/users/activity", "/api/users/analytics"])(
    "%s requires a session",
    async (path) => {
      expect((await users.request("GET", path, { token: null })).status).toBe(401);
    }
  );

  it("/me 404s when the account row is gone", async () => {
    db.handlers.push({ match: "FROM users WHERE id = $1", reply: [] });
    expect((await users.request("GET", "/api/users/me")).status).toBe(404);
  });

  it("/stats turns Postgres count strings into numbers and computes acceptance", async () => {
    db.handlers.push(
      { match: "COUNT(DISTINCT problem_id) AS count FROM submissions WHERE user_id = $1 AND status", reply: [{ count: "4" }] },
      { match: "COUNT(DISTINCT problem_id) AS count FROM submissions WHERE user_id = $1", reply: [{ count: "6" }] },
      // Before the interview count: the streak query also reads interview_sessions.
      { match: "best_streak", reply: [{ best_streak: "5" }] },
      { match: "FROM interview_sessions WHERE user_id = $1", reply: [{ count: "2" }] },
      { match: "AS submissions_count", reply: [{ submissions_count: "10", accepted_count: "7" }] }
    );
    const r = await users.request("GET", "/api/users/stats");
    expect(r.body).toEqual({
      problemsAttempted: 6,
      problemsSolved: 4,
      interviewsStarted: 2,
      bestStreak: 5,
      submissionsCount: 10,
      acceptanceRate: 70,
    });
  });
});

describe("users: avatar", () => {
  const upload = (avatar: unknown) => users.request("POST", "/api/users/avatar", { body: { avatar } });

  it.each([
    ["missing", undefined],
    ["not an image data URI", "https://example.com/a.png"],
    ["an SVG, which can carry script", "data:image/svg+xml;base64,PHN2Zz4="],
    ["over 500KB", `data:image/png;base64,${"A".repeat(500_001)}`],
  ])("rejects an avatar that is %s", async (_label, avatar) => {
    expect((await upload(avatar)).status).toBe(400);
    expect(callsMatching(db, "UPDATE users")).toHaveLength(0);
  });

  it("stores a small PNG against the caller", async () => {
    db.handlers.push({ match: "UPDATE users SET avatar_url", reply: [] });
    const r = await upload("data:image/png;base64,iVBORw0KGgo=");
    expect(r.status).toBe(200);
    expect(callsMatching(db, "UPDATE users SET avatar_url")[0].params[1]).toBe(USER_ID);
  });
});

describe("users: public profile", () => {
  it("400s on an invalid username and 404s on an unknown one", async () => {
    expect((await users.request("GET", "/api/users/no%20spaces", { token: null })).status).toBe(400);
    db.handlers.push({ match: "WHERE LOWER(username) = LOWER($1)", reply: [] });
    expect((await users.request("GET", "/api/users/ghost_user", { token: null })).status).toBe(404);
  });

  it("never exposes the email address", async () => {
    db.handlers.push(
      {
        match: "WHERE LOWER(username) = LOWER($1)",
        reply: [{ id: USER_ID, username: "ada", name: "Ada", avatar_url: null, created_at: "2026-01-01" }],
      },
      { match: "AS attempted_count", reply: [{ submissions_count: "2", accepted_count: "1", attempted_count: "1" }] },
      { match: "AS solved_count", reply: [{ solved_count: "1" }] },
      { match: "SELECT COUNT(*) AS count FROM interview_sessions", reply: [{ count: "0" }] },
      { match: "ORDER BY activity.created_at DESC", reply: [] },
      { match: "SELECT d::text, cnt", reply: [] }
    );
    const r = await users.request("GET", "/api/users/ada", { token: null });
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toContain("@");
    expect(r.body.profile.username).toBe("ada");
  });
});

describe("problems", () => {
  it.each([
    ["an unknown difficulty", "?difficulty=impossible"],
    ["an unknown solved filter", "?solved=maybe"],
    ["an oversized company filter", `?company=${"x".repeat(65)}`],
  ])("400s on %s", async (_label, qs) => {
    expect((await problems.request("GET", `/api/problems${qs}`)).status).toBe(400);
  });

  it("the solved filter needs a session", async () => {
    const r = await problems.request("GET", "/api/problems?solved=solved", { token: null });
    expect(r.status).toBe(401);
  });

  it("anonymous listing marks nothing solved and binds no user", async () => {
    db.handlers.push({ match: "FROM problems p", reply: [] });
    await problems.request("GET", "/api/problems?difficulty=easy", { token: null });
    const list = callsMatching(db, "FROM problems p")[0];
    expect(list.sql).toContain("false AS is_solved");
    expect(list.params).toEqual(["easy"]);
  });

  it("signed-in listing binds the caller for solved and bookmark flags", async () => {
    db.handlers.push({ match: "FROM problems p", reply: [] });
    await problems.request("GET", "/api/problems?company=Amazon");
    const list = callsMatching(db, "FROM problems p")[0];
    expect(list.params).toEqual(["amazon", USER_ID]);
    expect(list.sql).toContain("AS is_bookmarked");
  });

  it("GET /:id 400s on a malformed id and 404s on an unknown one", async () => {
    expect((await problems.request("GET", "/api/problems/not-a-uuid")).status).toBe(400);
    db.handlers.push({ match: "WHERE p.id = $1", reply: [] });
    expect((await problems.request("GET", `/api/problems/${PROBLEM}`)).status).toBe(404);
  });
});
