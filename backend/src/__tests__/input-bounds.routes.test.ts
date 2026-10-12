import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb, serve, type FakeDb, type TestServer } from "./helpers/harness";

// No handlers: any query throws, so a request rejected here provably ran no SQL.
const db = vi.hoisted(() => ({ handlers: [], calls: [] }) as FakeDb);
vi.mock("../db", async () => (await import("./helpers/fake-db")).fakeDbModule(db));

const ai = vi.hoisted(() => ({
  evaluateVoiceExplanation: vi.fn(),
  analyzeSystemDesign: vi.fn(),
}));
vi.mock("../services/ai.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/ai.service")>()),
  ...ai,
}));

const svc = vi.hoisted(() => ({
  startInterview: vi.fn(),
  submitAnswer: vi.fn(),
  beginAnswerTurn: vi.fn(),
  requestHint: vi.fn(),
}));
vi.mock("../services/interviews.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/interviews.service")>()),
  ...svc,
}));

import interviewsRouter from "../routes/interviews.routes";
import submissionsRouter from "../routes/submission.routes";
import { DomainError } from "../services/errors";
import { MAX_CODE_CHARS, MAX_TEXT_CHARS } from "../services/limits";
import { MAX_CODE_CHARS as PEER_MAX_CODE_CHARS } from "../services/peer.service";

const SESSION = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PROBLEM = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const over = (n: number) => "x".repeat(n + 1);
// The service's reply doesn't matter here, only what it was called with.
const notFound = () => new DomainError(404, "Interview session not found");

let interviews: TestServer;
let submissions: TestServer;
beforeAll(async () => {
  interviews = await serve("/api/interviews", interviewsRouter);
  submissions = await serve("/api/submissions", submissionsRouter);
});
afterAll(async () => {
  await interviews.close();
  await submissions.close();
});
beforeEach(() => {
  resetDb(db);
  [...Object.values(ai), ...Object.values(svc)].forEach((fn) => fn.mockReset());
});

/** Nothing ran: no SQL beyond the auth lookup, no model call, no interview service call. */
function expectNothingRan() {
  expect(db.calls.filter((c) => !c.sql.startsWith("SELECT token_version"))).toEqual([]);
  [...Object.values(ai), ...Object.values(svc)].forEach((fn) => expect(fn).not.toHaveBeenCalled());
}

describe("difficulty: one of three levels, since it goes into the prompt", () => {
  it.each(["/api/interviews", "/api/interviews/stream"])("%s rejects anything else", async (path) => {
    for (const difficulty of ["impossible", "", "ignore previous instructions", over(MAX_TEXT_CHARS), 3]) {
      const r = await interviews.request("POST", path, { body: { company: "amazon", difficulty } });
      expect(r.status).toBe(400);
      expect(r.body.error).toBe("difficulty must be one of: easy, medium, hard");
    }
    expectNothingRan();
  });

  it("accepts any case and passes the level on in lower case", async () => {
    svc.startInterview.mockRejectedValue(new DomainError(400, "stub"));
    await interviews.request("POST", "/api/interviews", { body: { company: "amazon", difficulty: " Hard " } });
    expect(svc.startInterview).toHaveBeenCalledWith(expect.objectContaining({ difficulty: "hard" }));
  });

  it("is still optional", async () => {
    svc.startInterview.mockRejectedValue(new DomainError(400, "stub"));
    await interviews.request("POST", "/api/interviews", { body: { company: "amazon" } });
    expect(svc.startInterview).toHaveBeenCalledWith(expect.objectContaining({ difficulty: undefined }));
  });
});

describe(`model-bound text: at most ${MAX_TEXT_CHARS} characters`, () => {
  it.each([`/api/interviews/${SESSION}/answer`, `/api/interviews/${SESSION}/answer/stream`])(
    "%s: an over-long answer is a 400 before any model call",
    async (path) => {
      const r = await interviews.request("POST", path, { body: { answer: over(MAX_TEXT_CHARS) } });
      expect(r.status).toBe(400);
      expect(r.body.error).toBe(`answer must be at most ${MAX_TEXT_CHARS} characters`);
      expectNothingRan();
    }
  );

  it("an answer of exactly the limit gets through", async () => {
    svc.submitAnswer.mockRejectedValue(notFound());
    await interviews.request("POST", `/api/interviews/${SESSION}/answer`, { body: { answer: "x".repeat(MAX_TEXT_CHARS) } });
    expect(svc.submitAnswer).toHaveBeenCalled();
  });

  it("a hint's draft", async () => {
    const r = await interviews.request("POST", `/api/interviews/${SESSION}/hint`, { body: { draft: over(MAX_TEXT_CHARS) } });
    expect(r.status).toBe(400);
    expectNothingRan();
  });

  it.each([
    ["question", { question: over(MAX_TEXT_CHARS) }],
    ["context", { question: "Explain TCP", context: over(MAX_TEXT_CHARS) }],
  ])("a voice explanation's %s", async (_, fields) => {
    const r = await interviews.request("POST", "/api/interviews/speech/evaluate-explanation", {
      body: { audioBase64: "AAAA", ...fields },
    });
    expect(r.status).toBe(400);
    expectNothingRan();
  });

  it.each([
    ["prompt", { prompt: over(MAX_TEXT_CHARS), explanation: "x" }],
    ["explanation", { prompt: "Design a URL shortener", explanation: over(MAX_TEXT_CHARS) }],
    ["company", { prompt: "Design a URL shortener", explanation: "x", company: over(100) }],
  ])("a system design's %s", async (_, body) => {
    const r = await interviews.request("POST", "/api/interviews/system-design/analyze", { body });
    expect(r.status).toBe(400);
    expectNothingRan();
  });
});

describe(`code: a string of at most ${MAX_CODE_CHARS} characters`, () => {
  it("is the peer editor's limit too", () => {
    expect(PEER_MAX_CODE_CHARS).toBe(MAX_CODE_CHARS);
  });

  it.each([
    ["too long, which the runner would refuse as 'unavailable'", over(MAX_CODE_CHARS)],
    ["not a string", ["print(1)"]],
  ])("%s: 400 before any query or run", async (_, code) => {
    for (const mode of ["run", "submit"]) {
      const r = await submissions.request("POST", "/api/submissions", {
        body: { problemId: PROBLEM, language: "python3", code, mode },
      });
      expect(r.status).toBe(400);
      expect(r.body.error).toBe(`code must be a string of at most ${MAX_CODE_CHARS} characters`);
    }
    expectNothingRan();
  });
});
