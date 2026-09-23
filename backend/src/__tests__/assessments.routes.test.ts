import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  callsMatching,
  resetDb,
  serve,
  OTHER_USER_ID,
  USER_ID,
  type FakeDb,
  type TestServer,
} from "./helpers/harness";

const db = vi.hoisted(() => ({ handlers: [], calls: [] }) as FakeDb);
vi.mock("../db", async () => (await import("./helpers/fake-db")).fakeDbModule(db));

import assessmentsRouter from "../routes/assessments.routes";

const ASSESSMENT = "11111111-2222-4333-8444-555555555555";
const PROBLEM_A = "aaaa0000-0000-4000-8000-000000000001";
const PROBLEM_B = "aaaa0000-0000-4000-8000-000000000002";
const SUB = "5ab00000-0000-4000-8000-000000000001";

let api: TestServer;
beforeAll(async () => {
  api = await serve("/api/assessments", assessmentsRouter);
});
afterAll(() => api.close());
beforeEach(() => resetDb(db));

function assessment(overrides: Record<string, unknown> = {}) {
  return {
    id: ASSESSMENT,
    user_id: USER_ID,
    status: "active",
    time_limit_minutes: 60,
    difficulty_mix: "mixed",
    problem_count: 2,
    started_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    finished_at: null,
    score: null,
    created_at: "2026-09-22T00:00:00Z",
    ...overrides,
  };
}

function assessmentLookup(row: Record<string, unknown>) {
  db.handlers.push({
    match: "FROM assessments WHERE id = $1 AND user_id = $2",
    reply: (params) => (params[1] === row.user_id ? [row] : []),
  });
}

describe("POST /api/assessments", () => {
  beforeEach(() => {
    db.handlers.push(
      { match: "FROM problems", reply: [{ id: PROBLEM_A }, { id: PROBLEM_B }] },
      { match: "INSERT INTO assessments", reply: [{ id: ASSESSMENT }] },
      { match: "INSERT INTO assessment_problems", reply: [] }
    );
  });

  it("clamps count and time limit into range", async () => {
    const r = await api.request("POST", "/api/assessments", {
      body: { problemCount: 50, timeLimitMinutes: 1 },
    });
    expect(r.status).toBe(201);
    expect(r.body.timeLimitMinutes).toBe(15);
    expect(callsMatching(db, "FROM problems")[0].params[0]).toBe(10);
    expect(callsMatching(db, "INSERT INTO assessment_problems")).toHaveLength(2);
    // Assessment and its problem rows land together, or not at all (D-057).
    const sqls = db.calls.map((c) => c.sql);
    expect(sqls.indexOf("BEGIN")).toBeLessThan(sqls.findIndex((s) => s.includes("INSERT INTO assessments")));
    expect(sqls.lastIndexOf("COMMIT")).toBeGreaterThan(sqls.findLastIndex((s) => s.includes("INSERT INTO assessment_problems")));
  });

  it.each([
    ["a non-numeric problem count", { problemCount: "lots" }],
    ["a non-numeric time limit", { timeLimitMinutes: "forever" }],
    ["an unknown difficulty mix", { difficultyMix: "nightmare" }],
  ])("400s on %s instead of reaching the database", async (_label, body) => {
    const r = await api.request("POST", "/api/assessments", { body });
    expect(r.status).toBe(400);
    expect(callsMatching(db, "FROM problems")).toHaveLength(0);
  });

  it("400s when no problem matches", async () => {
    db.handlers.unshift({ match: "FROM problems", reply: [] });
    const r = await api.request("POST", "/api/assessments", { body: { difficultyMix: "hard" } });
    expect(r.status).toBe(400);
  });
});

describe("GET /api/assessments/:id", () => {
  it("400s on a malformed id and 404s on another user's assessment", async () => {
    expect((await api.request("GET", "/api/assessments/nope")).status).toBe(400);
    assessmentLookup(assessment({ user_id: OTHER_USER_ID }));
    expect((await api.request("GET", `/api/assessments/${ASSESSMENT}`)).status).toBe(404);
  });

  it("reports time remaining while active", async () => {
    assessmentLookup(assessment());
    db.handlers.push({ match: "FROM assessment_problems ap", reply: [{ id: "1" }, { id: "2" }] });
    const r = await api.request("GET", `/api/assessments/${ASSESSMENT}`);
    expect(r.status).toBe(200);
    // 60-minute limit, started 10 minutes ago.
    expect(r.body.remainingMs).toBeGreaterThan(49 * 60 * 1000);
    expect(r.body.remainingMs).toBeLessThanOrEqual(50 * 60 * 1000);
  });
});

describe("POST /api/assessments/:id/solve", () => {
  const link = (body: Record<string, unknown>) =>
    api.request("POST", `/api/assessments/${ASSESSMENT}/solve`, { body });

  beforeEach(() => {
    assessmentLookup(assessment());
    db.handlers.push({ match: "UPDATE assessment_problems", reply: { rows: [], rowCount: 1 } });
  });

  it("links the caller's own submission for that problem", async () => {
    db.handlers.push({
      match: "FROM submissions WHERE id = $1 AND user_id = $2",
      reply: [{ problem_id: PROBLEM_A }],
    });
    const r = await link({ problemId: PROBLEM_A, submissionId: SUB });
    expect(r.status).toBe(200);
  });

  it("refuses a submission the caller doesn't own", async () => {
    // Before D-056 any submission id was accepted, including another user's passed one.
    db.handlers.push({ match: "FROM submissions WHERE id = $1 AND user_id = $2", reply: [] });
    const r = await link({ problemId: PROBLEM_A, submissionId: SUB });
    expect(r.status).toBe(404);
    expect(callsMatching(db, "UPDATE assessment_problems")).toHaveLength(0);
  });

  it("refuses a submission for a different problem", async () => {
    // ...or the caller's own passed solution to an easier problem, for full marks.
    db.handlers.push({
      match: "FROM submissions WHERE id = $1 AND user_id = $2",
      reply: [{ problem_id: PROBLEM_B }],
    });
    const r = await link({ problemId: PROBLEM_A, submissionId: SUB });
    expect(r.status).toBe(400);
    expect(callsMatching(db, "UPDATE assessment_problems")).toHaveLength(0);
  });

  it("refuses to link once time is up", async () => {
    // Postgres computes `expired` against started_at + limit + 30 s grace (D-057).
    db.handlers.unshift({
      match: "FROM assessments WHERE id = $1 AND user_id = $2",
      reply: [assessment({ expired: true })],
    });
    db.handlers.push({
      match: "FROM submissions WHERE id = $1 AND user_id = $2",
      reply: [{ problem_id: PROBLEM_A }],
    });
    const r = await link({ problemId: PROBLEM_A, submissionId: SUB });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/time is up/i);
    expect(callsMatching(db, "UPDATE assessment_problems")).toHaveLength(0);
    expect(callsMatching(db, "FROM assessments WHERE")[0].sql).toContain("make_interval(mins => time_limit_minutes)");
  });

  it("400s on malformed ids", async () => {
    expect((await link({ problemId: "x", submissionId: SUB })).status).toBe(400);
    expect((await link({ problemId: PROBLEM_A, submissionId: "y" })).status).toBe(400);
  });
});

describe("POST /api/assessments/:id/submit", () => {
  it("scores the share of problems with a passed submission", async () => {
    assessmentLookup(assessment());
    db.handlers.push(
      {
        match: "SELECT s.status AS submission_status",
        reply: [{ submission_status: "passed" }, { submission_status: "failed" }, { submission_status: null }],
      },
      { match: "UPDATE assessments SET status = 'completed'", reply: [] }
    );
    const r = await api.request("POST", `/api/assessments/${ASSESSMENT}/submit`);
    expect(r.body).toMatchObject({ score: 33.33, passed: 1, total: 3, status: "completed" });
  });

  it("can't be submitted twice", async () => {
    assessmentLookup(assessment({ status: "completed" }));
    const r = await api.request("POST", `/api/assessments/${ASSESSMENT}/submit`);
    expect(r.status).toBe(400);
  });
});
