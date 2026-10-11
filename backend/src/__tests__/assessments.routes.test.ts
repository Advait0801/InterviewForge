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
/** assessment_events, in memory: what the proctoring routes have recorded. */
let stored: Array<{ type: string; at: string; chars: number | null }> = [];
beforeEach(() => {
  resetDb(db);
  stored = [];
  db.handlers.push(
    { match: "SELECT type, client_at::text AS at, chars FROM assessment_events", reply: () => stored },
    { match: "COUNT(*)::int AS n FROM assessment_events", reply: () => [{ n: stored.length }] },
    {
      match: "INSERT INTO assessment_events",
      reply: (params) => {
        const [, types, ats, chars] = params as [string, string[], string[], (number | null)[]];
        types.forEach((type, i) => stored.push({ type, at: ats[i], chars: chars[i] }));
        return [];
      },
    }
  );
});

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

/** An assessment_problems row joined with its problem, as the detail query selects it. */
function assessmentProblem(problemId: string, order: number) {
  return {
    id: `aaaa1111-0000-4000-8000-00000000000${order}`,
    assessment_id: ASSESSMENT,
    problem_id: problemId,
    problem_order: order,
    submission_id: null,
    title: `Problem ${order + 1}`,
    slug: `problem-${order + 1}`,
    difficulty: "easy",
    submission_status: null,
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
    db.handlers.push({ match: "FROM assessment_problems ap", reply: [assessmentProblem(PROBLEM_A, 0), assessmentProblem(PROBLEM_B, 1)] });
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
    expect(r.body).toMatchObject({ score: 33.33, passed: 1, total: 3, status: "completed", integrity: { events: 0, flags: [] } });
  });

  it("can't be submitted twice", async () => {
    assessmentLookup(assessment({ status: "completed" }));
    const r = await api.request("POST", `/api/assessments/${ASSESSMENT}/submit`);
    expect(r.status).toBe(400);
  });
});

describe("POST /api/assessments/:id/events (proctoring)", () => {
  const at = (secondsAgo: number) => new Date(Date.now() - secondsAgo * 1000).toISOString();
  const post = (events: unknown, token?: string | null) =>
    api.request("POST", `/api/assessments/${ASSESSMENT}/events`, { body: { events }, ...(token !== undefined ? { token } : {}) });

  it("records a batch and returns the summary, with flags", async () => {
    assessmentLookup(assessment());
    const r = await post([
      { type: "tab_hidden", at: at(300) },
      { type: "tab_visible", at: at(200) },
      { type: "tab_hidden", at: at(150) },
      { type: "tab_visible", at: at(140) },
      { type: "tab_hidden", at: at(100) },
      { type: "tab_visible", at: at(99) },
      { type: "paste", at: at(90), chars: 450 },
      { type: "copy", at: at(80), chars: 12 },
      { type: "window_blur", at: at(70) },
    ]);
    expect(r.status).toBe(201);
    expect(r.body.recorded).toBe(9);
    expect(r.body.integrity).toMatchObject({
      tabSwitches: 3,
      hiddenSeconds: 111,
      pastes: 1,
      pastedChars: 450,
      largestPaste: 450,
      copies: 1,
      windowBlurs: 1,
    });
    expect(r.body.integrity.flags).toEqual(["Left the tab 3 times", "Away from the tab for 111 seconds", "Pasted 450 characters at once"]);
  });

  it("the summary shows on the assessment too", async () => {
    assessmentLookup(assessment());
    db.handlers.push({ match: "FROM assessment_problems ap", reply: [assessmentProblem(PROBLEM_A, 0), assessmentProblem(PROBLEM_B, 1)] });
    stored = [{ type: "paste", at: at(60), chars: 5 }];
    const r = await api.request("GET", `/api/assessments/${ASSESSMENT}`);
    expect(r.body.integrity).toMatchObject({ events: 1, pastes: 1, flags: [] });
  });

  it.each([
    ["pasted text", [{ type: "paste", at: at(5), chars: 3, text: "abc" }], /unexpected field text/],
    ["an unknown type", [{ type: "screenshot", at: at(5) }], /type must be/],
    ["a paste without chars", [{ type: "paste", at: at(5) }], /needs chars/],
    ["chars on a tab event", [{ type: "tab_hidden", at: at(5), chars: 1 }], /only for paste and copy/],
    ["a bad timestamp", [{ type: "copy", at: "yesterday", chars: 1 }], /ISO 8601/],
    ["an empty batch", [], /1-50/],
    ["too many in a batch", Array.from({ length: 51 }, () => ({ type: "window_blur", at: at(5) })), /1-50/],
  ])("400 for %s, recording nothing", async (_label, events, message) => {
    assessmentLookup(assessment());
    const r = await post(events);
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(message);
    expect(stored).toHaveLength(0);
  });

  it("400 for an event stamped outside the assessment", async () => {
    assessmentLookup(assessment());
    const r = await post([{ type: "window_blur", at: at(60 * 60 * 3) }]);
    expect(r.status).toBe(400);
    expect(stored).toHaveLength(0);
  });

  it("409 once the assessment is submitted", async () => {
    assessmentLookup(assessment({ status: "completed", finished_at: new Date().toISOString() }));
    const r = await post([{ type: "window_blur", at: at(5) }]);
    expect(r).toMatchObject({ status: 409, body: { code: "assessment_closed" } });
  });

  it("409 past the per-assessment limit", async () => {
    assessmentLookup(assessment());
    stored = Array.from({ length: 1990 }, () => ({ type: "window_blur", at: at(100), chars: null }));
    const r = await post(Array.from({ length: 11 }, () => ({ type: "window_blur", at: at(5) })));
    expect(r).toMatchObject({ status: 409, body: { code: "event_limit" } });
    expect(stored).toHaveLength(1990);
  });

  it("404 for someone else's assessment; 401 anonymous", async () => {
    assessmentLookup(assessment({ user_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }));
    expect((await post([{ type: "window_blur", at: at(5) }])).status).toBe(404);
    expect((await post([{ type: "window_blur", at: at(5) }], null)).status).toBe(401);
    expect(stored).toHaveLength(0);
  });
});
