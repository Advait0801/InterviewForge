/**
 * The agentic interviewer (D-067) and per-interview model cost. The agent (ai-service) is
 * mocked; what's under test is the backend's side: which moves it allows, that it enforces
 * them whatever the agent says, how each move is recorded, the cost cap, and that every
 * operation's model spend is charged to its session.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { callsMatching, resetDb, serve, USER_ID, type FakeDb, type TestServer } from "./helpers/harness";

const db = vi.hoisted(() => ({ handlers: [], calls: [] }) as FakeDb);
vi.mock("../db", async () => (await import("./helpers/fake-db")).fakeDbModule(db));

const ai = vi.hoisted(() => ({
  generateNextQuestion: vi.fn(),
  evaluateAnswer: vi.fn(),
  generateFollowup: vi.fn(),
  streamNextQuestion: vi.fn(),
  streamFollowup: vi.fn(),
  agentTurn: vi.fn(),
  checkChallenge: vi.fn(),
}));
vi.mock("../services/ai.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/ai.service")>()),
  ...ai,
}));

import { AIServiceError, type AgentDecision, type StructuredEvaluation, type StructuredQuestion } from "../services/ai.service";
import { recordUsage } from "../services/llm-usage";
import interviewsRouter from "../routes/interviews.routes";

const SESSION = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const QUESTION: StructuredQuestion = {
  question: "Design a URL shortener.",
  reasoningFocus: "design",
  expectedCompetencies: [],
  context: "ctx",
  retrievalHits: 1,
  retrievalConfidence: null,
  liveIngestion: null,
  resumeGrounded: false,
  resumeHits: 0,
  resumeEvidence: [],
};
const EVAL = (score: number, shouldAskFollowup = false): StructuredEvaluation => ({
  score,
  strengths: [],
  weaknesses: [],
  suggestions: [],
  shouldAskFollowup,
  followupFocus: "",
});
const decision = (overrides: Partial<AgentDecision>): AgentDecision => ({
  action: "advance",
  question: "",
  focus: "",
  rationale: "enough signal",
  thought: "",
  fallback: false,
  context: "",
  trace: [{ tool: "decide", action: overrides.action ?? "advance" }],
  steps: 1,
  ...overrides,
});

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION,
    user_id: USER_ID,
    company: "google",
    current_stage: "coding",
    status: "active",
    stage_turn_count: 0,
    resume_grounded: false,
    persona: "neutral",
    mode: "agent",
    llm_calls: 0,
    llm_cost_usd: 0,
    report_json: null,
    created_at: "2026-10-08T00:00:00Z",
    updated_at: "2026-10-08T00:00:00Z",
    ...overrides,
  };
}

/** A session on its turn, the question being answered, and the stage transcript. */
function turn(overrides: Record<string, unknown> = {}) {
  db.handlers.push(
    { match: "FROM interview_sessions WHERE id = $1 AND user_id = $2", reply: [session(overrides)] },
    { match: "metadata_json->>'kind' = 'question'", reply: [{ id: "q1", content: "Two sum?", metadata_json: { context: "ctx" }, created_at: "2026-10-08T00:00:00Z" }] },
    { match: "metadata_json->>'kind' = 'hint'", reply: [] },
    {
      match: "FROM interview_messages WHERE session_id = $1 ORDER BY",
      reply: [
        { id: "m0", session_id: SESSION, role: "assistant", stage: "behavioral", content: "Tell me about...", metadata_json: { kind: "question" }, created_at: "2026-10-08T00:00:00Z" },
        { id: "m1", session_id: SESSION, role: "assistant", stage: "coding", content: "Two sum?", metadata_json: { kind: "question" }, created_at: "2026-10-08T00:00:01Z" },
      ],
    },
    { match: "SET llm_calls", reply: [] },
    { match: "INSERT INTO interview_messages", reply: [] },
    { match: "UPDATE interview_sessions", reply: [{ id: SESSION }] }
  );
}

const answer = (path = "answer") =>
  api.request("POST", `/api/interviews/${SESSION}/${path}`, { body: { answer: "Use a hash map." } });
const inserted = () =>
  callsMatching(db, "INSERT INTO interview_messages").map((c) => ({
    content: c.params[3],
    metadata: JSON.parse(c.params[4] as string),
  }));
const claim = () => callsMatching(db, "UPDATE interview_sessions").find((c) => !c.sql.includes("llm_calls"))!;

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
  delete process.env.INTERVIEW_MODE;
  delete process.env.INTERVIEW_COST_CAP_USD;
});

describe("choosing the mode", () => {
  beforeEach(() => {
    db.handlers.push(
      { match: "FROM resumes", reply: [{ exists: false }] },
      { match: "INSERT INTO interview_sessions", reply: [] },
      { match: "INSERT INTO interview_messages", reply: [] }
    );
    ai.generateNextQuestion.mockResolvedValue(QUESTION);
  });

  it("stores the requested mode", async () => {
    const r = await api.request("POST", "/api/interviews", { body: { company: "google", mode: "agent" } });
    expect(r.body.session.mode).toBe("agent");
    expect(callsMatching(db, "INSERT INTO interview_sessions")[0].params[6]).toBe("agent");
  });

  it("defaults to fixed, or to INTERVIEW_MODE", async () => {
    expect((await api.request("POST", "/api/interviews", { body: { company: "google" } })).body.session.mode).toBe("fixed");
    process.env.INTERVIEW_MODE = "agent";
    expect((await api.request("POST", "/api/interviews", { body: { company: "google" } })).body.session.mode).toBe("agent");
  });

  it.each(["/api/interviews", "/api/interviews/stream"])("%s rejects an unknown mode as a 400", async (path) => {
    const r = await api.request("POST", path, { body: { company: "google", mode: "chaos" } });
    expect(r.status).toBe(400);
    expect(r.body.error).toContain("fixed, agent");
  });
});

describe("agent moves", () => {
  beforeEach(() => ai.evaluateAnswer.mockResolvedValue(EVAL(5)));

  it("fixed mode never consults the agent", async () => {
    turn({ mode: "fixed" });
    ai.generateNextQuestion.mockResolvedValue(QUESTION);
    const r = await answer();
    expect(ai.agentTurn).not.toHaveBeenCalled();
    expect(r.body).not.toHaveProperty("agent");
  });

  it("tells the agent what's allowed mid-stage and shows it this stage only", async () => {
    turn();
    ai.agentTurn.mockResolvedValue(decision({ action: "advance" }));
    ai.generateNextQuestion.mockResolvedValue(QUESTION);

    await answer();

    const sent = ai.agentTurn.mock.calls[0][0];
    expect(sent.allowed_actions).toEqual(["probe", "pivot", "advance"]);
    expect(sent).toMatchObject({ stage: "coding", stage_position: "2 of 4", questions_left: 2, question: "Two sum?" });
    expect(sent.stage_transcript).toEqual([{ role: "assistant", content: "Two sum?" }]);
  });

  it("no second probe in a stage unless the last one raised the score", async () => {
    const stageSoFar = (score: number) => ({
      match: "FROM interview_messages WHERE session_id = $1 ORDER BY",
      reply: [
        { id: "e1", session_id: SESSION, role: "system", stage: "coding", content: "Score", metadata_json: { kind: "evaluation", score }, created_at: "2026-10-08T00:00:02Z" },
      ],
    });
    ai.agentTurn.mockResolvedValue(decision({ action: "advance" }));
    ai.generateNextQuestion.mockResolvedValue(QUESTION);

    db.handlers.push(stageSoFar(5));
    turn({ stage_turn_count: 1 }); // this answer: EVAL(5), no better than the 5 before it
    await answer();
    expect(ai.agentTurn.mock.calls[0][0].allowed_actions).toEqual(["pivot", "advance"]);

    resetDb(db);
    ai.evaluateAnswer.mockResolvedValue(EVAL(7)); // improved: probing helped, so it stays open
    db.handlers.push(stageSoFar(5));
    turn({ stage_turn_count: 1 });
    await answer();
    expect(ai.agentTurn.mock.calls[1][0].allowed_actions).toEqual(["probe", "pivot", "advance"]);
  });

  it("a probe is the stage's next question, recorded as a follow-up with the agent's note", async () => {
    turn();
    ai.agentTurn.mockResolvedValue(decision({ action: "probe", question: "Why O(n)?", focus: "complexity", rationale: "vague" }));

    const r = await answer();

    expect(r.body).toMatchObject({ action: "followup", nextQuestion: { question: "Why O(n)?", focus: "complexity", reason: "vague" } });
    expect(r.body.agent).toEqual({ decided: "probe", rationale: "vague", steps: 1, searches: 0 });
    expect(inserted().at(-1)).toMatchObject({ content: "Why O(n)?", metadata: { kind: "followup", agent: { decided: "probe" } } });
    expect(claim().sql).toContain("stage_turn_count = stage_turn_count + 1");
    expect(ai.generateFollowup).not.toHaveBeenCalled();
  });

  it("a pivot is a new, grounded question in the same stage", async () => {
    turn();
    ai.agentTurn.mockResolvedValue(
      decision({
        action: "pivot",
        question: "Design an LRU cache.",
        focus: "caching",
        context: "LRU evicts the least recently used.",
        trace: [{ tool: "search_context", query: "caching", hits: 3 }, { tool: "decide", action: "pivot" }],
        steps: 2,
      })
    );

    const r = await answer("answer/stream");

    expect(r.events!.map((e) => e.type)).toEqual(["evaluation", "question", "delta", "done"]);
    expect(r.events![1]).toEqual({ type: "question", kind: "question", stage: "coding" });
    expect(r.events![3].result).toMatchObject({ action: "pivot", stage: "coding", agent: { decided: "pivot", searches: 1 } });
    expect(inserted().at(-1)!.metadata).toMatchObject({
      kind: "question",
      stage: "coding",
      reasoningFocus: "caching",
      context: "LRU evicts the least recently used.",
    });
  });

  it("advance asks the next stage's question the usual way", async () => {
    turn();
    ai.agentTurn.mockResolvedValue(decision({ action: "advance" }));
    ai.generateNextQuestion.mockResolvedValue(QUESTION);

    const r = await answer();

    expect(r.body).toMatchObject({ action: "advance_stage", currentStage: "system_design", agent: { decided: "advance" } });
    expect(inserted().at(-1)!.metadata).toMatchObject({ kind: "question", agent: { decided: "advance" } });
  });

  it("on the last stage the agent may finish, and may not advance", async () => {
    turn({ current_stage: "core_cs" });
    ai.agentTurn.mockResolvedValue(decision({ action: "finish" }));

    const r = await answer();

    expect(ai.agentTurn.mock.calls[0][0].allowed_actions).toEqual(["probe", "pivot", "finish"]);
    expect(r.body).toMatchObject({ action: "completed", agent: { decided: "finish" } });
  });

  it("at three questions in a stage the agent isn't asked: the only move is on", async () => {
    turn({ stage_turn_count: 2 });
    ai.generateNextQuestion.mockResolvedValue(QUESTION);

    const r = await answer();

    expect(ai.agentTurn).not.toHaveBeenCalled();
    expect(r.body).toMatchObject({ action: "advance_stage", agent: { decided: "not_consulted", rationale: "only one move is allowed" } });
  });

  it("a move the agent wasn't allowed is not taken; the fixed rule decides", async () => {
    turn();
    ai.evaluateAnswer.mockResolvedValue(EVAL(5, true));
    ai.agentTurn.mockResolvedValue(decision({ action: "finish" }));
    ai.generateFollowup.mockResolvedValue({ question: "Fixed follow-up?", focus: "f", reason: "r" });

    const r = await answer();

    expect(r.body).toMatchObject({ action: "followup", nextQuestion: { question: "Fixed follow-up?" }, agent: { decided: "fallback" } });
  });

  it("an agent the ai-service reports as fallback, or that fails, leaves the turn to the fixed rule", async () => {
    turn();
    ai.agentTurn.mockResolvedValue(decision({ action: "fallback", fallback: true, rationale: "no decision" }));
    ai.generateNextQuestion.mockResolvedValue(QUESTION);
    expect((await answer()).body).toMatchObject({ action: "advance_stage", agent: { decided: "fallback" } });

    resetDb(db);
    turn();
    ai.agentTurn.mockRejectedValue(new AIServiceError(503, "down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const r = await answer();
    warn.mockRestore();
    expect(r.status).toBe(200);
    expect(r.body.agent).toMatchObject({ decided: "fallback", rationale: "the agent call failed" });
  });

  it("past the cost cap the agent is no longer consulted, and the interview carries on", async () => {
    process.env.INTERVIEW_COST_CAP_USD = "0.01";
    turn({ llm_cost_usd: 0.0125 });
    ai.generateNextQuestion.mockResolvedValue(QUESTION);

    const r = await answer();

    expect(ai.agentTurn).not.toHaveBeenCalled();
    expect(r.body.action).toBe("advance_stage");
    expect(r.body.agent.decided).toBe("not_consulted");
    expect(r.body.agent.rationale).toContain("cost cap reached");
  });

  it("spend earlier in the same turn counts toward the cap", async () => {
    process.env.INTERVIEW_COST_CAP_USD = "0.01";
    turn({ llm_cost_usd: 0.008 });
    ai.evaluateAnswer.mockImplementation(async () => {
      recordUsage({ calls: 1, costUsd: 0.003 }); // the evaluation pushes it over
      return EVAL(5);
    });
    ai.generateNextQuestion.mockResolvedValue(QUESTION);

    await answer();

    expect(ai.agentTurn).not.toHaveBeenCalled();
  });
});

describe("cost per interview", () => {
  const charged = () => callsMatching(db, "SET llm_calls").map((c) => c.params);

  it("charges a turn's model calls to its session", async () => {
    turn({ mode: "fixed" });
    ai.evaluateAnswer.mockImplementation(async () => {
      recordUsage({ calls: 1, costUsd: 0.0002 });
      return EVAL(5);
    });
    ai.generateNextQuestion.mockImplementation(async () => {
      recordUsage({ calls: 2, costUsd: 0.0003 });
      return QUESTION;
    });

    await answer();

    expect(charged()).toHaveLength(1);
    expect(charged()[0][0]).toBe(SESSION);
    expect(charged()[0][1]).toBe(3);
    expect(charged()[0][2]).toBeCloseTo(0.0005, 10);
  });

  it("charges a failed turn too: the calls were made", async () => {
    turn({ mode: "fixed" });
    ai.evaluateAnswer.mockImplementation(async () => {
      recordUsage({ calls: 1, costUsd: 0.0002 });
      throw new AIServiceError(503, "down");
    });

    const r = await answer();

    expect(r.status).toBe(503);
    expect(charged()).toEqual([[SESSION, 1, 0.0002]]);
    expect(callsMatching(db, "INSERT INTO interview_messages")).toHaveLength(0);
  });

  it("charges nothing when no model call reported spend", async () => {
    turn({ mode: "fixed" });
    ai.evaluateAnswer.mockResolvedValue(EVAL(5));
    ai.generateNextQuestion.mockResolvedValue(QUESTION);
    expect((await answer()).status).toBe(200);
    expect(charged()).toHaveLength(0);
  });

  it("a failure to record spend never fails the turn", async () => {
    db.handlers.push({ match: "SET llm_calls", reply: () => { throw new Error("db hiccup"); } });
    turn({ mode: "fixed" });
    ai.evaluateAnswer.mockImplementation(async () => {
      recordUsage({ calls: 1, costUsd: 0.0002 });
      return EVAL(5);
    });
    ai.generateNextQuestion.mockResolvedValue(QUESTION);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const r = await answer();

    warn.mockRestore();
    expect(r.status).toBe(200);
  });

  it("charges the opening question to the new session", async () => {
    db.handlers.push(
      { match: "FROM resumes", reply: [{ exists: false }] },
      { match: "INSERT INTO interview_sessions", reply: [] },
      { match: "INSERT INTO interview_messages", reply: [] },
      { match: "SET llm_calls", reply: [] }
    );
    ai.generateNextQuestion.mockImplementation(async () => {
      recordUsage({ calls: 1, costUsd: 0.0001 });
      return QUESTION;
    });

    const r = await api.request("POST", "/api/interviews", { body: { company: "google" } });

    expect(charged()).toEqual([[r.body.session.id, 1, 0.0001]]);
  });
});
