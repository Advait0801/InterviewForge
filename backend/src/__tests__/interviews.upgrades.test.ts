/**
 * Interviewer upgrades (D-066): personas, the hint ladder with its score penalty, and the
 * grounded challenge. Same harness as the other interview route tests: a strict fake
 * Postgres, the ai-service mocked, every response checked against the spec.
 */
import { afterEach, afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  callsMatching,
  resetDb,
  serve,
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
  generateHint: vi.fn(),
  checkChallenge: vi.fn(),
}));
vi.mock("../services/ai.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/ai.service")>()),
  ...ai,
}));

import { AIServiceError, type StructuredEvaluation, type StructuredQuestion } from "../services/ai.service";
import interviewsRouter from "../routes/interviews.routes";

const SESSION = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const QUESTION: StructuredQuestion = {
  question: "How would you design a rate limiter?",
  reasoningFocus: "design",
  expectedCompetencies: ["trade-offs"],
  context: "Token buckets refill at a fixed rate.",
  retrievalHits: 3,
  retrievalConfidence: null,
  liveIngestion: { triggered: false, reason: "not attempted" },
  resumeGrounded: false,
  resumeHits: 0,
  resumeEvidence: [],
};
const EVAL = (score: number, shouldAskFollowup = false): StructuredEvaluation => ({
  score,
  strengths: ["clear"],
  weaknesses: [],
  suggestions: [],
  shouldAskFollowup,
  followupFocus: "",
});
const CHALLENGE = {
  challenged: true,
  claim: "token buckets never refill",
  evidence: "Token buckets refill at a fixed rate.",
  question: "The reference says token buckets refill at a fixed rate. How does that square with your answer?",
  reason: "direct contradiction",
};

const ago = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString();

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION,
    user_id: USER_ID,
    company: "amazon",
    current_stage: "system_design",
    status: "active",
    stage_turn_count: 0,
    resume_grounded: false,
    persona: "adversarial",
    mode: "fixed",
    llm_calls: 0,
    llm_cost_usd: 0,
    report_json: null,
    created_at: ago(600),
    updated_at: ago(600),
    ...overrides,
  };
}

/** The session lookup, and the question being answered, asked `askedAgo` seconds ago. */
function turnAt(askedAgo: number, overrides: Record<string, unknown> = {}) {
  db.handlers.push(
    { match: "FROM interview_sessions WHERE id = $1 AND user_id = $2", reply: [session(overrides)] },
    {
      match: "metadata_json->>'kind' = 'question'",
      reply: [{ id: "q1", content: QUESTION.question, metadata_json: { context: QUESTION.context }, created_at: ago(askedAgo) }],
    }
  );
}

/** `n` hints already given on this question, the latest `lastAgo` seconds ago. */
const hintRow = (level: number, secondsAgo: number) => ({
  id: `h${level}`,
  session_id: SESSION,
  role: "assistant",
  stage: "system_design",
  content: `hint ${level}`,
  metadata_json: { kind: "hint", level, penalty: 1 },
  created_at: ago(secondsAgo),
});

const writes = () =>
  db.handlers.push(
    { match: "INSERT INTO interview_messages", reply: [] },
    { match: "UPDATE interview_sessions", reply: [{ id: SESSION }] }
  );
const inserted = (kind: string) =>
  callsMatching(db, "INSERT INTO interview_messages")
    .map((c) => ({ content: c.params[3], metadata: JSON.parse(c.params[4] as string) }))
    .filter((m) => m.metadata.kind === kind);

let api: TestServer;
beforeAll(async () => {
  api = await serve("/api/interviews", interviewsRouter);
});
afterAll(() => api.close());
beforeEach(() => {
  resetDb(db);
  Object.values(ai).forEach((fn) => fn.mockReset());
});
afterEach(() => {
  delete process.env.INTERVIEW_CHALLENGE_ENABLED;
});

describe("personas", () => {
  beforeEach(() => {
    db.handlers.push(
      { match: "FROM resumes", reply: [{ exists: false }] },
      { match: "INSERT INTO interview_sessions", reply: [] },
      { match: "INSERT INTO interview_messages", reply: [] }
    );
    ai.generateNextQuestion.mockResolvedValue(QUESTION);
  });

  it("stores the chosen persona and asks the opening question in it", async () => {
    const r = await api.request("POST", "/api/interviews", { body: { company: "amazon", persona: "terse" } });
    expect(r.status).toBe(201);
    expect(r.body.session.persona).toBe("terse");
    expect(callsMatching(db, "INSERT INTO interview_sessions")[0].params[5]).toBe("terse");
    expect(ai.generateNextQuestion.mock.calls[0][0].persona).toBe("terse");
  });

  it("defaults to neutral, the interviewer as it was before personas", async () => {
    const r = await api.request("POST", "/api/interviews", { body: { company: "amazon" } });
    expect(r.body.session.persona).toBe("neutral");
    expect(ai.generateNextQuestion.mock.calls[0][0].persona).toBe("neutral");
  });

  it.each(["/api/interviews", "/api/interviews/stream"])("%s rejects an unknown persona as a 400", async (path) => {
    const r = await api.request("POST", path, { body: { company: "amazon", persona: "rude" } });
    expect(r.status).toBe(400);
    expect(r.body.error).toContain("adversarial");
    expect(ai.generateNextQuestion).not.toHaveBeenCalled();
  });

  it("uses the session's persona for the next question and follow-up, never for grading", async () => {
    resetDb(db);
    turnAt(120, { stage_turn_count: 0 });
    db.handlers.push({ match: "metadata_json->>'kind' = 'hint'", reply: [] });
    writes();
    ai.evaluateAnswer.mockResolvedValue(EVAL(6, true));
    ai.generateFollowup.mockResolvedValue({ question: "Why?", focus: "f", reason: "r" });

    await api.request("POST", `/api/interviews/${SESSION}/answer`, { body: { answer: "A token bucket." } });

    expect(ai.generateFollowup.mock.calls[0][0].persona).toBe("adversarial");
    expect(ai.evaluateAnswer.mock.calls[0][0]).not.toHaveProperty("persona");
  });
});

describe("POST /api/interviews/:id/hint", () => {
  const hint = (body: unknown = {}) => api.request("POST", `/api/interviews/${SESSION}/hint`, { body });

  it("is locked until the candidate has been stuck long enough, and says when it opens", async () => {
    turnAt(5);
    db.handlers.push({ match: "metadata_json->>'kind' = 'hint'", reply: [] });

    const r = await hint();

    expect(r.status).toBe(409);
    expect(r.body.code).toBe("hint_locked");
    const opensIn = (Date.parse(r.body.availableAt) - Date.now()) / 1000;
    expect(opensIn).toBeGreaterThan(20);
    expect(opensIn).toBeLessThanOrEqual(25);
    expect(ai.generateHint).not.toHaveBeenCalled();
  });

  it("gives the first rung once unlocked, grounded in the question's context, and records it", async () => {
    turnAt(45);
    db.handlers.push(
      { match: "metadata_json->>'kind' = 'hint'", reply: [] },
      { match: "FOR UPDATE", reply: [{ status: "active", current_stage: "system_design", stage_turn_count: 0 }] },
      { match: "INSERT INTO interview_messages", reply: [] }
    );
    ai.generateHint.mockResolvedValue({ hint: "Think about bursts.", level: 1 });

    const r = await hint({ draft: "I'd use a counter" });

    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ level: 1, hint: "Think about bursts.", hintsUsed: 1, hintsRemaining: 2, penalty: 1 });
    expect(ai.generateHint.mock.calls[0][0]).toMatchObject({
      level: 1,
      context: QUESTION.context,
      previous_hints: [],
      draft: "I'd use a counter",
      persona: "adversarial",
    });
    expect(inserted("hint")).toEqual([{ content: "Think about bursts.", metadata: { kind: "hint", level: 1, penalty: 1 } }]);
    const sqls = db.calls.map((c) => c.sql);
    expect(sqls.indexOf("BEGIN")).toBeLessThan(sqls.findIndex((s) => s.includes("FOR UPDATE")));
    expect(sqls).toContain("COMMIT");
  });

  it("climbs the ladder: the third rung sees the earlier hints, in order", async () => {
    turnAt(300);
    db.handlers.push(
      { match: "metadata_json->>'kind' = 'hint'", reply: [hintRow(1, 120), hintRow(2, 40)] },
      { match: "FOR UPDATE", reply: [{ status: "active", current_stage: "system_design", stage_turn_count: 0 }] },
      { match: "INSERT INTO interview_messages", reply: [] }
    );
    ai.generateHint.mockResolvedValue({ hint: "Refill tokens at rate r; reject when empty.", level: 3 });

    const r = await hint();

    expect(r.body).toMatchObject({ level: 3, hintsRemaining: 0, penalty: 3, nextAvailableAt: null });
    expect(ai.generateHint.mock.calls[0][0].previous_hints).toEqual(["hint 1", "hint 2"]);
  });

  it("the next rung unlocks from the previous hint, not from the question", async () => {
    turnAt(300);
    db.handlers.push({ match: "metadata_json->>'kind' = 'hint'", reply: [hintRow(1, 10)] });
    const r = await hint();
    expect(r.status).toBe(409);
    expect(r.body.code).toBe("hint_locked");
  });

  it("refuses a fourth hint", async () => {
    turnAt(300);
    db.handlers.push({ match: "metadata_json->>'kind' = 'hint'", reply: [hintRow(1, 200), hintRow(2, 150), hintRow(3, 100)] });
    const r = await hint();
    expect(r.status).toBe(409);
    expect(r.body.code).toBe("hints_exhausted");
    expect(ai.generateHint).not.toHaveBeenCalled();
  });

  it("records nothing if the question was answered while the hint was being written", async () => {
    turnAt(60);
    db.handlers.push(
      { match: "metadata_json->>'kind' = 'hint'", reply: [] },
      { match: "FOR UPDATE", reply: [{ status: "active", current_stage: "core_cs", stage_turn_count: 0 }] }
    );
    ai.generateHint.mockResolvedValue({ hint: "h", level: 1 });

    const r = await hint();

    expect(r.status).toBe(409);
    expect(callsMatching(db, "INSERT INTO interview_messages")).toHaveLength(0);
    expect(db.calls.map((c) => c.sql)).toContain("ROLLBACK");
  });

  it("records nothing if another hint landed first (two clicks)", async () => {
    turnAt(60);
    db.handlers.push(
      { match: "metadata_json->>'kind' = 'hint'", reply: [], once: true },
      { match: "FOR UPDATE", reply: [{ status: "active", current_stage: "system_design", stage_turn_count: 0 }] },
      { match: "metadata_json->>'kind' = 'hint'", reply: [hintRow(1, 1)] }
    );
    ai.generateHint.mockResolvedValue({ hint: "h", level: 1 });

    const r = await hint();

    expect(r.status).toBe(409);
    expect(callsMatching(db, "INSERT INTO interview_messages")).toHaveLength(0);
  });

  it("400s on a non-string draft and maps an AI outage to a retryable 503", async () => {
    expect((await hint({ draft: 42 })).status).toBe(400);

    turnAt(60);
    db.handlers.push({ match: "metadata_json->>'kind' = 'hint'", reply: [] });
    ai.generateHint.mockRejectedValue(new AIServiceError(500, "boom"));
    const r = await hint();
    expect(r.status).toBe(503);
    expect(r.body.retryable).toBe(true);
  });
});

describe("hint penalty", () => {
  const answer = () => api.request("POST", `/api/interviews/${SESSION}/answer`, { body: { answer: "Use a token bucket." } });

  it("takes a point per hint off the answer's score and keeps the raw score", async () => {
    turnAt(300, { stage_turn_count: 1 });
    db.handlers.push({ match: "metadata_json->>'kind' = 'hint'", reply: [hintRow(1, 200), hintRow(2, 100)] });
    writes();
    ai.evaluateAnswer.mockResolvedValue(EVAL(7));
    ai.generateNextQuestion.mockResolvedValue(QUESTION);

    const r = await answer();

    expect(r.body.evaluation).toMatchObject({ score: 5, rawScore: 7, hintsUsed: 2, hintPenalty: 2 });
    const [stored] = inserted("evaluation");
    expect(stored.metadata).toMatchObject({ score: 5, rawScore: 7, hintsUsed: 2, hintPenalty: 2 });
    expect(stored.content).toContain("Score: 5/10");
    expect(stored.content).toContain("Hints used: 2 (score 7 before a 2-point penalty)");
  });

  it("never takes the score below 1", async () => {
    turnAt(600, { stage_turn_count: 1 });
    db.handlers.push({ match: "metadata_json->>'kind' = 'hint'", reply: [hintRow(1, 500), hintRow(2, 400), hintRow(3, 300)] });
    writes();
    ai.evaluateAnswer.mockResolvedValue(EVAL(2));
    ai.generateNextQuestion.mockResolvedValue(QUESTION);

    const r = await answer();

    expect(r.body.evaluation).toMatchObject({ score: 1, rawScore: 2, hintsUsed: 3, hintPenalty: 1 });
  });

  it("leaves an unhinted answer's evaluation exactly as graded", async () => {
    turnAt(300, { stage_turn_count: 1 });
    db.handlers.push({ match: "metadata_json->>'kind' = 'hint'", reply: [] });
    writes();
    ai.evaluateAnswer.mockResolvedValue(EVAL(7));
    ai.generateNextQuestion.mockResolvedValue(QUESTION);

    expect((await answer()).body.evaluation).toEqual(EVAL(7));
  });

  it("an answer graded while a hint landed is refused, not recorded without the penalty", async () => {
    turnAt(300, { stage_turn_count: 1 });
    db.handlers.push(
      { match: "metadata_json->>'kind' = 'hint'", reply: [], once: true }, // before grading
      { match: "metadata_json->>'kind' = 'hint'", reply: [hintRow(1, 1)] } // inside the commit
    );
    writes();
    ai.evaluateAnswer.mockResolvedValue(EVAL(7));
    ai.generateNextQuestion.mockResolvedValue(QUESTION);

    const r = await answer();

    expect(r.status).toBe(409);
    expect(inserted("answer")).toHaveLength(0);
    expect(db.calls.map((c) => c.sql)).toContain("ROLLBACK");
  });
});

describe("grounded challenge", () => {
  const answer = (path = "answer") =>
    api.request("POST", `/api/interviews/${SESSION}/${path}`, { body: { answer: "Token buckets never refill, so..." } });
  const firstTurn = () => {
    turnAt(120, { stage_turn_count: 0 });
    db.handlers.push({ match: "metadata_json->>'kind' = 'hint'", reply: [] });
    writes();
  };

  it("is off unless INTERVIEW_CHALLENGE_ENABLED is set", async () => {
    firstTurn();
    ai.evaluateAnswer.mockResolvedValue(EVAL(5, false));
    ai.generateNextQuestion.mockResolvedValue(QUESTION);

    const r = await answer();

    expect(ai.checkChallenge).not.toHaveBeenCalled();
    expect(r.body.action).toBe("advance_stage");
  });

  it("a verified contradiction becomes the stage's follow-up, quoting both sides", async () => {
    process.env.INTERVIEW_CHALLENGE_ENABLED = "true";
    firstTurn();
    ai.evaluateAnswer.mockResolvedValue(EVAL(5, false)); // the evaluator wouldn't have followed up
    ai.checkChallenge.mockResolvedValue(CHALLENGE);

    const r = await answer();

    expect(r.body.action).toBe("followup");
    expect(r.body.nextQuestion).toMatchObject({
      question: CHALLENGE.question,
      challenge: { claim: CHALLENGE.claim, evidence: CHALLENGE.evidence },
    });
    expect(ai.generateFollowup).not.toHaveBeenCalled();
    expect(ai.checkChallenge.mock.calls[0][0]).toMatchObject({ context: QUESTION.context, persona: "adversarial" });
    expect(inserted("followup")[0].metadata.challenge).toEqual({ claim: CHALLENGE.claim, evidence: CHALLENGE.evidence });
  });

  it("isn't run once the stage's follow-up is used", async () => {
    process.env.INTERVIEW_CHALLENGE_ENABLED = "true";
    turnAt(120, { stage_turn_count: 1 });
    db.handlers.push({ match: "metadata_json->>'kind' = 'hint'", reply: [] });
    writes();
    ai.evaluateAnswer.mockResolvedValue(EVAL(5));
    ai.generateNextQuestion.mockResolvedValue(QUESTION);

    await answer();

    expect(ai.checkChallenge).not.toHaveBeenCalled();
  });

  it("no contradiction, or a failed check, leaves the normal flow untouched", async () => {
    process.env.INTERVIEW_CHALLENGE_ENABLED = "true";
    firstTurn();
    ai.evaluateAnswer.mockResolvedValue(EVAL(5, false));
    ai.generateNextQuestion.mockResolvedValue(QUESTION);
    ai.checkChallenge.mockRejectedValue(new AIServiceError(503, "down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const r = await answer();

    warn.mockRestore();
    expect(r.status).toBe(200);
    expect(r.body.action).toBe("advance_stage");
  });

  it("streams the pushback as a follow-up question", async () => {
    process.env.INTERVIEW_CHALLENGE_ENABLED = "true";
    firstTurn();
    ai.evaluateAnswer.mockResolvedValue(EVAL(5, false));
    ai.checkChallenge.mockResolvedValue(CHALLENGE);

    const r = await answer("answer/stream");

    expect(r.events!.map((e) => e.type)).toEqual(["evaluation", "question", "delta", "done"]);
    expect(r.events![1]).toEqual({ type: "question", kind: "followup", stage: "system_design" });
    expect(r.events![2].text).toBe(CHALLENGE.question);
    expect(r.events![3].result.nextQuestion.challenge.claim).toBe(CHALLENGE.claim);
  });
});
