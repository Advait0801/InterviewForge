import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  callsMatching,
  fakeQuery,
  resetDb,
  serve,
  tokenFor,
  OTHER_USER_ID,
  USER_ID,
  type FakeDb,
  type TestServer,
} from "./helpers/harness";
import { COMPANIES } from "../services/interview-state.service";

const db = vi.hoisted(() => ({ handlers: [], calls: [] }) as FakeDb);
vi.mock("../db", () => ({ query: vi.fn((sql: string, params: unknown[]) => fakeQuery(db, sql, params)) }));

const ai = vi.hoisted(() => ({
  generateNextQuestion: vi.fn(),
  evaluateAnswer: vi.fn(),
  generateFollowup: vi.fn(),
  generateReport: vi.fn(),
  transcribeSpeech: vi.fn(),
  evaluateVoiceExplanation: vi.fn(),
  analyzeSystemDesign: vi.fn(),
}));
vi.mock("../services/ai.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/ai.service")>()),
  ...ai,
}));

import { AIServiceError } from "../services/ai.service";
import interviewsRouter from "../routes/interviews.routes";

const SESSION = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const QUESTION = {
  question: "Tell me about a time you disagreed with your manager.",
  reasoningFocus: "conflict",
  expectedCompetencies: ["ownership"],
  context: "retrieved context",
};
const EVAL = (shouldAskFollowup: boolean) => ({
  score: 7,
  strengths: ["clear"],
  weaknesses: [],
  suggestions: [],
  shouldAskFollowup,
  followupFocus: "",
});

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION,
    user_id: USER_ID,
    company: "amazon",
    current_stage: "behavioral",
    status: "active",
    stage_turn_count: 0,
    resume_grounded: false,
    report_json: null,
    created_at: "2026-09-22T00:00:00Z",
    updated_at: "2026-09-22T00:00:00Z",
    ...overrides,
  };
}

/** Session lookup scoped to the caller, as the route issues it: WHERE id = $1 AND user_id = $2. */
function sessionLookup(row: Record<string, unknown> | null) {
  db.handlers.push({
    match: "FROM interview_sessions WHERE id = $1 AND user_id = $2",
    reply: (params) => (row && params[1] === row.user_id ? [row] : []),
  });
}

let api: TestServer;
beforeAll(async () => {
  api = await serve("/api/interviews", interviewsRouter);
});
afterAll(() => api.close());
beforeEach(() => {
  resetDb(db);
  Object.values(ai).forEach((fn) => fn.mockReset());
});

describe("auth", () => {
  it.each([
    ["GET", "/api/interviews"],
    ["POST", "/api/interviews"],
    ["GET", `/api/interviews/${SESSION}`],
    ["POST", `/api/interviews/${SESSION}/answer`],
    ["GET", `/api/interviews/${SESSION}/report`],
  ])("%s %s requires a session", async (method, path) => {
    const r = await api.request(method, path, { token: null, body: method === "POST" ? {} : undefined });
    expect(r.status).toBe(401);
  });
});

describe("POST /api/interviews", () => {
  beforeEach(() => {
    db.handlers.push(
      { match: "FROM resumes", reply: [{ exists: false }] },
      { match: "INSERT INTO interview_sessions", reply: [] },
      { match: "INSERT INTO interview_messages", reply: [] }
    );
  });

  it("400s without a company", async () => {
    const r = await api.request("POST", "/api/interviews", { body: {} });
    expect(r.status).toBe(400);
  });

  it("400s on an unknown company, listing every supported one", async () => {
    const r = await api.request("POST", "/api/interviews", { body: { company: "enron" } });
    expect(r.status).toBe(400);
    for (const company of COMPANIES) expect(r.body.error).toContain(company);
  });

  it("creates the session and stores the opening question", async () => {
    ai.generateNextQuestion.mockResolvedValue(QUESTION);
    const r = await api.request("POST", "/api/interviews", { body: { company: "Google" } });
    expect(r.status).toBe(201);
    expect(r.body.session).toMatchObject({ company: "google", currentStage: "behavioral", status: "active" });
    expect(r.body.openingQuestion.question).toBe(QUESTION.question);
    const insert = callsMatching(db, "INSERT INTO interview_sessions")[0];
    expect(insert.params[0]).toBe(r.body.session.id);
    expect(insert.params[1]).toBe(USER_ID);
  });

  it("leaves no orphan session when question generation fails", async () => {
    ai.generateNextQuestion.mockRejectedValue(new AIServiceError(502, "upstream down"));
    const r = await api.request("POST", "/api/interviews", { body: { company: "amazon" } });
    expect(r.status).toBe(503);
    expect(r.body.retryable).toBe(true);
    expect(callsMatching(db, "INSERT INTO interview_sessions")).toHaveLength(0);
  });

  it("passes a provider rate limit through as 429", async () => {
    ai.generateNextQuestion.mockRejectedValue(new AIServiceError(429, "slow down"));
    const r = await api.request("POST", "/api/interviews", { body: { company: "amazon" } });
    expect(r.status).toBe(429);
  });

  it("grounds in the resume only when one exists and the user didn't opt out", async () => {
    ai.generateNextQuestion.mockResolvedValue(QUESTION);
    db.handlers.unshift({ match: "FROM resumes", reply: [{ exists: true }] });
    await api.request("POST", "/api/interviews", { body: { company: "amazon" } });
    expect(ai.generateNextQuestion.mock.calls[0][0].resume_grounded).toBe(true);

    await api.request("POST", "/api/interviews", { body: { company: "amazon", useResume: false } });
    expect(ai.generateNextQuestion.mock.calls[1][0].resume_grounded).toBe(false);
  });
});

describe("GET /api/interviews/:id", () => {
  it("400s on a malformed id without touching the database", async () => {
    const r = await api.request("GET", "/api/interviews/not-a-uuid");
    expect(r.status).toBe(400);
    expect(db.calls.filter((c) => !c.sql.includes("token_version"))).toHaveLength(0);
  });

  it("404s on another user's session", async () => {
    sessionLookup(session({ user_id: OTHER_USER_ID }));
    const r = await api.request("GET", `/api/interviews/${SESSION}`);
    expect(r.status).toBe(404);
  });

  it("returns the session with its transcript", async () => {
    sessionLookup(session());
    db.handlers.push({ match: "FROM interview_messages WHERE session_id = $1 ORDER BY", reply: [{ id: "m1" }] });
    const r = await api.request("GET", `/api/interviews/${SESSION}`);
    expect(r.status).toBe(200);
    expect(r.body.messages).toHaveLength(1);
  });
});

describe("POST /api/interviews/:id/answer", () => {
  const latestQuestion = {
    match: "metadata_json->>'kind' = 'question'",
    reply: [{ id: "q1", content: QUESTION.question, metadata_json: { context: "ctx" } }],
  };
  const writes = () => {
    db.handlers.push(
      { match: "INSERT INTO interview_messages", reply: [] },
      { match: "UPDATE interview_sessions", reply: [] }
    );
  };

  it("400s on an empty answer", async () => {
    const r = await api.request("POST", `/api/interviews/${SESSION}/answer`, { body: { answer: "  " } });
    expect(r.status).toBe(400);
  });

  it("400s once the interview is no longer active", async () => {
    sessionLookup(session({ status: "completed" }));
    const r = await api.request("POST", `/api/interviews/${SESSION}/answer`, { body: { answer: "hi" } });
    expect(r.status).toBe(400);
  });

  it("asks one follow-up on the first turn of a stage when the evaluator wants one", async () => {
    sessionLookup(session({ stage_turn_count: 0 }));
    db.handlers.push(latestQuestion);
    writes();
    ai.evaluateAnswer.mockResolvedValue(EVAL(true));
    ai.generateFollowup.mockResolvedValue({ question: "Why?", focus: "depth", reason: "thin" });

    const r = await api.request("POST", `/api/interviews/${SESSION}/answer`, { body: { answer: "An answer" } });
    expect(r.status).toBe(200);
    expect(r.body.action).toBe("followup");
    expect(callsMatching(db, "SET stage_turn_count = stage_turn_count + 1")).toHaveLength(1);
  });

  it("advances instead of a second follow-up, capping follow-ups at one per stage", async () => {
    sessionLookup(session({ stage_turn_count: 1 }));
    db.handlers.push(latestQuestion);
    writes();
    ai.evaluateAnswer.mockResolvedValue(EVAL(true));
    ai.generateNextQuestion.mockResolvedValue(QUESTION);

    const r = await api.request("POST", `/api/interviews/${SESSION}/answer`, { body: { answer: "An answer" } });
    expect(r.body).toMatchObject({ action: "advance_stage", previousStage: "behavioral", currentStage: "coding" });
    expect(ai.generateFollowup).not.toHaveBeenCalled();
  });

  it("completes the interview after the last stage", async () => {
    sessionLookup(session({ current_stage: "core_cs", stage_turn_count: 1 }));
    db.handlers.push(latestQuestion);
    writes();
    ai.evaluateAnswer.mockResolvedValue(EVAL(false));

    const r = await api.request("POST", `/api/interviews/${SESSION}/answer`, { body: { answer: "An answer" } });
    expect(r.body.action).toBe("completed");
    expect(callsMatching(db, "status = 'completed'")).toHaveLength(1);
  });

  it("stores nothing when evaluation fails, so the answer can be retried", async () => {
    sessionLookup(session());
    db.handlers.push(latestQuestion);
    ai.evaluateAnswer.mockRejectedValue(new AIServiceError(500, "boom"));

    const r = await api.request("POST", `/api/interviews/${SESSION}/answer`, { body: { answer: "An answer" } });
    expect(r.status).toBe(503);
    expect(callsMatching(db, "INSERT INTO interview_messages")).toHaveLength(0);
  });
});

describe("GET /api/interviews/:id/report", () => {
  const REPORT = {
    overallScore: 7,
    stageScores: { behavioral: { score: 8 }, coding: { score: "6" } },
    summary: "Solid.",
  };

  it("400s before the interview is completed", async () => {
    sessionLookup(session({ status: "active" }));
    const r = await api.request("GET", `/api/interviews/${SESSION}/report`);
    expect(r.status).toBe(400);
    expect(ai.generateReport).not.toHaveBeenCalled();
  });

  it("generates the report once, records scores once, and serves the stored copy after", async () => {
    const row = session({ status: "completed", current_stage: "report" });
    sessionLookup(row);
    db.handlers.push(
      { match: "FROM interview_messages WHERE session_id = $1 ORDER BY", reply: [] },
      {
        // Stores the report only if none is stored yet; only the winner records scores.
        match: "SET report_json",
        reply: (params) => {
          if (row.report_json) return [];
          row.report_json = JSON.parse(params[1] as string);
          return [{ id: SESSION }];
        },
      },
      { match: "INSERT INTO scores", reply: [] }
    );
    ai.generateReport.mockResolvedValue(REPORT);

    const first = await api.request("GET", `/api/interviews/${SESSION}/report`);
    const second = await api.request("GET", `/api/interviews/${SESSION}/report`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(first.body).toMatchObject({ sessionId: SESSION, company: "amazon", overallScore: 7 });
    // One LLM call, and one score row per stage plus overall -- not per page view.
    expect(ai.generateReport).toHaveBeenCalledTimes(1);
    expect(callsMatching(db, "INSERT INTO scores")).toHaveLength(3);
  });
});

describe("speech and system design", () => {
  it.each([
    ["/api/interviews/speech/transcribe", {}],
    ["/api/interviews/speech/evaluate-explanation", { audioBase64: "AAAA" }],
    ["/api/interviews/system-design/analyze", { prompt: "Design a URL shortener" }],
  ])("%s 400s on missing input", async (path, body) => {
    const r = await api.request("POST", path, { body });
    expect(r.status).toBe(400);
  });

  it("system design analysis maps an AI outage to a retryable 503", async () => {
    ai.analyzeSystemDesign.mockRejectedValue(new AIServiceError(500, "boom"));
    const r = await api.request("POST", "/api/interviews/system-design/analyze", {
      body: { prompt: "p", explanation: "e" },
    });
    expect(r.status).toBe(503);
    expect(r.body.retryable).toBe(true);
  });
});

describe("isolation", () => {
  it("never answers into another user's session", async () => {
    sessionLookup(session({ user_id: OTHER_USER_ID }));
    const r = await api.request("POST", `/api/interviews/${SESSION}/answer`, {
      body: { answer: "hi" },
      token: tokenFor(USER_ID),
    });
    expect(r.status).toBe(404);
    expect(ai.evaluateAnswer).not.toHaveBeenCalled();
  });
});
