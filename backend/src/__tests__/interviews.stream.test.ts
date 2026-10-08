/**
 * The streamed interview endpoints (D-065): the same turn as the JSON endpoints, sent as
 * server-sent events. Every event the harness receives is validated against the spec.
 * The disconnect and slow-reader tests use raw node:http connections, because fetch can
 * neither stop reading on cue nor show how far the server got.
 */
import http from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  callsMatching,
  parseEventStream,
  resetDb,
  serve,
  tokenFor,
  OTHER_USER_ID,
  USER_ID,
  type FakeDb,
  type TestServer,
} from "./helpers/harness";

const db = vi.hoisted(() => ({ handlers: [], calls: [] }) as FakeDb);
vi.mock("../db", async () => (await import("./helpers/fake-db")).fakeDbModule(db));

const ai = vi.hoisted(() => ({
  generateNextQuestion: vi.fn(),
  evaluateAnswer: vi.fn(),
  generateFollowup: vi.fn(),
  streamNextQuestion: vi.fn(),
  streamFollowup: vi.fn(),
}));
vi.mock("../services/ai.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/ai.service")>()),
  ...ai,
}));

import {
  AIServiceError,
  type QuestionStreamOptions,
  type StructuredEvaluation,
  type StructuredQuestion,
} from "../services/ai.service";
import interviewsRouter from "../routes/interviews.routes";

const SESSION = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const QUESTION: StructuredQuestion = {
  question: "Tell me about a time you disagreed with your manager.",
  reasoningFocus: "conflict",
  expectedCompetencies: ["ownership"],
  context: "retrieved context",
  retrievalHits: 3,
  retrievalConfidence: null,
  liveIngestion: { triggered: false, reason: "not attempted" },
  resumeGrounded: false,
  resumeHits: 0,
  resumeEvidence: [],
};
const FOLLOWUP = { question: "Why did you pick that?", focus: "depth", reason: "thin" };
const EVAL = (shouldAskFollowup: boolean): StructuredEvaluation => ({
  score: 7,
  strengths: ["clear"],
  weaknesses: [],
  suggestions: [],
  shouldAskFollowup,
  followupFocus: "",
});

/** A fake ai-service stream: the question in word-sized deltas, then the full result. */
function streams<T extends { question: string }>(result: T) {
  return async (_params: unknown, options: QuestionStreamOptions) => {
    for (const piece of result.question.match(/\S+\s*/g) ?? []) await options.onDelta(piece);
    return result;
  };
}

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

function sessionLookup(row: Record<string, unknown> | null) {
  db.handlers.push({
    match: "FROM interview_sessions WHERE id = $1 AND user_id = $2",
    reply: (params) => (row && params[1] === row.user_id ? [row] : []),
  });
}

const latestQuestion = {
  match: "metadata_json->>'kind' = 'question'",
  reply: [{ id: "q1", content: QUESTION.question, metadata_json: { context: "ctx" } }],
};
const turnWrites = () =>
  db.handlers.push(
    { match: "INSERT INTO interview_messages", reply: [] },
    { match: "UPDATE interview_sessions", reply: [{ id: SESSION }] }
  );
const startWrites = () =>
  db.handlers.push(
    { match: "FROM resumes", reply: [{ exists: false }] },
    { match: "INSERT INTO interview_sessions", reply: [] },
    { match: "INSERT INTO interview_messages", reply: [] }
  );
const types = (events: Record<string, any>[]) => events.map((e) => e.type);
const text = (events: Record<string, any>[]) =>
  events.filter((e) => e.type === "delta").map((e) => e.text).join("");
const writesOf = () => db.calls.filter((c) => /INSERT|UPDATE|BEGIN/.test(c.sql));

let api: TestServer;
beforeAll(async () => {
  api = await serve("/api/interviews", interviewsRouter);
});
afterAll(() => api.close());
beforeEach(() => {
  resetDb(db);
  Object.values(ai).forEach((fn) => fn.mockReset());
});

describe("POST /api/interviews/stream", () => {
  it("requires a session", async () => {
    const r = await api.request("POST", "/api/interviews/stream", { token: null, body: {} });
    expect(r.status).toBe(401);
  });

  it("rejects bad input as JSON before any stream opens", async () => {
    const r = await api.request("POST", "/api/interviews/stream", { body: { company: "enron" } });
    expect(r.status).toBe(400);
    expect(r.events).toBeUndefined();
    expect(r.body.error).toContain("amazon");
  });

  it("streams the opening question, then the body POST / returns, stored in one transaction", async () => {
    startWrites();
    ai.streamNextQuestion.mockImplementation(streams(QUESTION));

    const r = await api.request("POST", "/api/interviews/stream", { body: { company: "Google" } });

    expect(r.status).toBe(200);
    expect(types(r.events!)).toEqual(["question", ...Array(10).fill("delta"), "done"]);
    expect(r.events![0]).toEqual({ type: "question", kind: "question", stage: "behavioral" });
    expect(text(r.events!)).toBe(QUESTION.question);
    const done = r.events!.at(-1)!;
    expect(done.result.session).toMatchObject({ company: "google", currentStage: "behavioral", status: "active" });
    expect(done.result.openingQuestion).toEqual(QUESTION);
    const sqls = db.calls.map((c) => c.sql).filter((s) => !s.includes("token_version") && !s.includes("resumes"));
    expect(sqls[0]).toBe("BEGIN");
    expect(sqls.at(-1)).toBe("COMMIT");
    expect(ai.generateNextQuestion).not.toHaveBeenCalled();
  });

  it("ends with a retryable error event and stores nothing when generation fails", async () => {
    startWrites();
    ai.streamNextQuestion.mockRejectedValue(new AIServiceError(429, "AI service error", { detail: "LLM rate limited" }));

    const r = await api.request("POST", "/api/interviews/stream", { body: { company: "amazon" } });

    expect(r.events!.at(-1)).toEqual({ type: "error", status: 429, error: "LLM rate limited", retryable: true });
    expect(callsMatching(db, "INSERT INTO interview_sessions")).toHaveLength(0);
  });
});

describe("POST /api/interviews/:id/answer/stream", () => {
  const answer = (body: unknown = { answer: "An answer" }) =>
    api.request("POST", `/api/interviews/${SESSION}/answer/stream`, { body });

  it("rejects bad input and unknown or finished sessions as JSON before any stream opens", async () => {
    expect((await answer({ answer: " " })).status).toBe(400);
    expect((await api.request("POST", "/api/interviews/nope/answer/stream", { body: { answer: "a" } })).status).toBe(400);

    sessionLookup(session({ user_id: OTHER_USER_ID }));
    const missing = await answer();
    expect(missing.status).toBe(404);
    expect(missing.events).toBeUndefined();

    resetDb(db);
    sessionLookup(session({ status: "completed" }));
    expect((await answer()).status).toBe(400);
    expect(ai.evaluateAnswer).not.toHaveBeenCalled();
  });

  it("sends the evaluation, then streams the follow-up, then the JSON endpoint's outcome", async () => {
    sessionLookup(session({ stage_turn_count: 0 }));
    db.handlers.push(latestQuestion);
    turnWrites();
    ai.evaluateAnswer.mockResolvedValue(EVAL(true));
    ai.streamFollowup.mockImplementation(streams(FOLLOWUP));

    const r = await answer();

    expect(r.status).toBe(200);
    expect(r.events![0]).toEqual({ type: "evaluation", evaluation: EVAL(true) });
    expect(r.events![1]).toEqual({ type: "question", kind: "followup", stage: "behavioral" });
    expect(text(r.events!)).toBe(FOLLOWUP.question);
    expect(r.events!.at(-1)).toEqual({
      type: "done",
      result: { action: "followup", sessionId: SESSION, stage: "behavioral", evaluation: EVAL(true), nextQuestion: FOLLOWUP },
    });
    expect(callsMatching(db, "SET stage_turn_count = stage_turn_count + 1")).toHaveLength(1);
    expect(ai.generateFollowup).not.toHaveBeenCalled();
  });

  it("streams the next stage's question and records the turn in one transaction", async () => {
    sessionLookup(session({ stage_turn_count: 1 }));
    db.handlers.push(latestQuestion);
    turnWrites();
    ai.evaluateAnswer.mockResolvedValue(EVAL(false));
    ai.streamNextQuestion.mockImplementation(streams(QUESTION));

    const r = await answer();

    expect(r.events![1]).toEqual({ type: "question", kind: "question", stage: "coding" });
    expect(r.events!.at(-1)!.result).toMatchObject({ action: "advance_stage", previousStage: "behavioral", currentStage: "coding" });
    const sqls = db.calls.map((c) => c.sql);
    const inserts = sqls.flatMap((s, i) => (s.includes("INSERT INTO interview_messages") ? [i] : []));
    expect(inserts).toHaveLength(3);
    expect(inserts.every((i) => i > sqls.indexOf("BEGIN") && i < sqls.indexOf("COMMIT"))).toBe(true);
  });

  it("completes the interview with no question events", async () => {
    sessionLookup(session({ current_stage: "core_cs", stage_turn_count: 1 }));
    db.handlers.push(latestQuestion);
    turnWrites();
    ai.evaluateAnswer.mockResolvedValue(EVAL(false));

    const r = await answer();

    expect(types(r.events!)).toEqual(["evaluation", "done"]);
    expect(r.events![1].result).toEqual({ action: "completed", sessionId: SESSION, evaluation: EVAL(false) });
  });

  it("a double submit ends in a non-retryable 409 event and writes nothing", async () => {
    sessionLookup(session({ stage_turn_count: 1 }));
    db.handlers.push(latestQuestion, { match: "INSERT INTO interview_messages", reply: [] });
    db.handlers.push({ match: "UPDATE interview_sessions", reply: [] });
    ai.evaluateAnswer.mockResolvedValue(EVAL(false));
    ai.streamNextQuestion.mockImplementation(streams(QUESTION));

    const r = await answer();

    expect(r.events!.at(-1)).toEqual({
      type: "error",
      status: 409,
      error: "This question was already answered. Refresh to continue.",
      retryable: false,
    });
    expect(callsMatching(db, "INSERT INTO interview_messages")).toHaveLength(0);
    expect(db.calls.map((c) => c.sql)).toContain("ROLLBACK");
  });

  it("a generation failure mid-question ends in an error event and records nothing", async () => {
    sessionLookup(session({ stage_turn_count: 1 }));
    db.handlers.push(latestQuestion);
    turnWrites();
    ai.evaluateAnswer.mockResolvedValue(EVAL(false));
    ai.streamNextQuestion.mockImplementation(async (_p: unknown, options: QuestionStreamOptions) => {
      await options.onDelta("Tell me ");
      throw new AIServiceError(503, "LLM unavailable: boom", { detail: "LLM unavailable: boom" });
    });

    const r = await answer();

    expect(types(r.events!)).toEqual(["evaluation", "question", "delta", "error"]);
    expect(r.events!.at(-1)).toMatchObject({ status: 503, retryable: true });
    expect(writesOf()).toHaveLength(0);
  });
});

// --- real connections --------------------------------------------------------

/** POST over a raw connection; resolves once the response headers arrive. */
function open(path: string, body: unknown) {
  return new Promise<{ req: http.ClientRequest; res: http.IncomingMessage }>((resolve, reject) => {
    const req = http.request(`${api.url}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenFor()}` },
    });
    req.on("response", (res) => resolve({ req, res }));
    req.on("error", reject);
    req.end(JSON.stringify(body));
  });
}

const until = async (cond: () => boolean, ms = 3000) => {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error("timed out waiting");
    await new Promise((r) => setTimeout(r, 10));
  }
};

describe("disconnect and backpressure", () => {
  it("a client leaving mid-question aborts generation and records nothing", async () => {
    sessionLookup(session({ stage_turn_count: 1 }));
    db.handlers.push(latestQuestion);
    turnWrites();
    ai.evaluateAnswer.mockResolvedValue(EVAL(false));
    let upstreamAborted = false;
    ai.streamNextQuestion.mockImplementation(async (_p: unknown, options: QuestionStreamOptions) => {
      await options.onDelta("Tell me ");
      // The model keeps going until the signal says the client is gone.
      await new Promise<void>((resolve) => options.signal.addEventListener("abort", () => resolve()));
      upstreamAborted = true;
      throw options.signal.reason;
    });

    const { req, res } = await open(`/api/interviews/${SESSION}/answer/stream`, { answer: "An answer" });
    expect(res.headers["content-type"]).toMatch(/^text\/event-stream/);
    expect(res.headers["x-accel-buffering"]).toBe("no");
    let received = "";
    res.on("data", (chunk) => {
      received += chunk;
      if (received.includes("event: delta")) req.destroy(); // leave after the first words
    });

    await until(() => upstreamAborted);
    await new Promise((r) => setTimeout(r, 50)); // let the handler finish unwinding
    expect(writesOf()).toHaveLength(0);
    expect(received).not.toContain("event: done");
  });

  it("a client that stops reading stops the stream; it resumes when the client does", async () => {
    startWrites();
    const DELTAS = 400;
    const piece = "x".repeat(32 * 1024) + " ";
    let emitted = 0;
    ai.streamNextQuestion.mockImplementation(async (_p: unknown, options: QuestionStreamOptions) => {
      for (let i = 0; i < DELTAS; i++) {
        await options.onDelta(piece); // resolves only once the socket has taken it
        emitted++;
      }
      return { ...QUESTION, question: piece.repeat(DELTAS) };
    });

    const { res } = await open("/api/interviews/stream", { company: "amazon" });
    res.pause();
    await new Promise((r) => setTimeout(r, 400));
    const whilePaused = emitted;
    // 400 × 32 KB = 12.8 MB if nothing pushed back. Only what the socket buffers fits.
    expect(whilePaused).toBeLessThan(DELTAS / 4);

    let received = "";
    res.setEncoding("utf8");
    res.on("data", (chunk) => (received += chunk));
    res.resume();
    await new Promise((r) => res.on("end", r));
    expect(emitted).toBe(DELTAS);
    const events = parseEventStream(received);
    expect(events.at(-1)!.type).toBe("done");
  });
});

describe("OPENAPI_VALIDATE_RESPONSES on a stream", () => {
  it("checks each streamed event and logs a violation for one the spec doesn't allow", async () => {
    const express = (await import("express")).default;
    const { validateResponses } = await import("../openapi/validate-responses.middleware");
    const { openEventStream } = await import("../routes/sse");
    const app = express();
    app.use("/api", validateResponses());
    app.post("/api/interviews/stream", async (req, res) => {
      const stream = openEventStream(req, res);
      await stream.send({ type: "delta", text: "fine" });
      await stream.send({ type: "delta", text: "" }); // minLength 1
      stream.end();
    });
    const server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const { port } = server.address() as import("node:net").AddressInfo;
      await (await fetch(`http://127.0.0.1:${port}/api/interviews/stream`, { method: "POST" })).text();
      const violations = warn.mock.calls.map((c) => String(c[0])).filter((l) => l.includes("openapi_violation"));
      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain("event 0 /text");
    } finally {
      warn.mockRestore();
      server.close();
    }
  });
});

describe("keepalive", () => {
  it("sends a comment while nothing else is happening, so proxies keep the connection", async () => {
    const express = (await import("express")).default;
    const { openEventStream } = await import("../routes/sse");
    const app = express();
    app.post("/slow", async (req, res) => {
      const stream = openEventStream(req, res, { keepaliveMs: 20 });
      await new Promise((r) => setTimeout(r, 90)); // a slow evaluation
      await stream.send({ type: "delta", text: "done thinking" });
      stream.end();
    });
    const server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    try {
      const { port } = server.address() as import("node:net").AddressInfo;
      const body = await (await fetch(`http://127.0.0.1:${port}/slow`, { method: "POST" })).text();
      expect(body.split(": keepalive\n\n").length - 1).toBeGreaterThanOrEqual(2);
      expect(parseEventStream(body)).toEqual([{ type: "delta", text: "done thinking" }]);
    } finally {
      server.close();
    }
  });
});
