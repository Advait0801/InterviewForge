import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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

const ai = vi.hoisted(() => ({ reviewCode: vi.fn() }));
vi.mock("../services/ai.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/ai.service")>()),
  ...ai,
}));

import { AIServiceError } from "../services/ai.service";

const PROBLEM = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const SUBMISSION = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const CASES = Array.from({ length: 6 }, (_, i) => ({ input: `${i}`, expectedOutput: `${i}` }));

// A stand-in code-runner on a real socket, so the route's own fetch is exercised.
type RunnerBody = {
  testCases: Array<{ input: string; expectedOutput: string }>;
  language: string;
  slug: string;
  customCases?: { inputs: string[]; reference: { language: string; code: string } };
};
const runner = {
  mode: "pass" as "pass" | "fail" | "error" | "drop",
  lastBody: null as null | RunnerBody,
  /** /validate: inputs containing "bad" are reported unusable. */
  validated: null as null | { slug: string; inputs: string[] },
  validateMode: "ok" as "ok" | "drop",
};
const DIFF = { kind: "value", path: [], expected: 4, actual: "wrong" };
let runnerServer: Server;
let api: TestServer;

beforeAll(async () => {
  runnerServer = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      if (req.url === "/validate") {
        runner.validated = JSON.parse(raw);
        if (runner.validateMode === "drop") return req.socket.destroy();
        const errors = runner.validated!.inputs.map((i) => (i.includes("bad") ? "target should be an integer." : null));
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ errors }));
        return;
      }
      runner.lastBody = JSON.parse(raw);
      if (runner.mode === "drop") return req.socket.destroy();
      if (runner.mode === "error") {
        res.writeHead(500).end("sandbox exploded");
        return;
      }
      // One result per case sent; in "fail" mode the last two cases fail.
      const cases = runner.lastBody!.testCases;
      const results = cases.map((_, i) => {
        const ok = runner.mode === "pass" || i < cases.length - 2;
        return ok ? { passed: true, actualOutput: `${i}` } : { passed: false, actualOutput: "wrong", diff: DIFF };
      });
      const customResults = runner.lastBody!.customCases?.inputs.map((input) => ({
        input,
        judged: true,
        expectedOutput: "[0,1]",
        passed: false,
        actualOutput: "[1,0,2]",
        diff: { kind: "items", missing: [], unexpected: [2], expectedLength: 2, actualLength: 3 },
      }));
      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({ passed: results.every((r) => r.passed), results, customResults, runtimeMs: 12, memoryKb: 900 })
      );
    });
  });
  runnerServer.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => runnerServer.once("listening", resolve));
  process.env.CODE_RUNNER_URL = `http://127.0.0.1:${(runnerServer.address() as AddressInfo).port}`;

  // Imported after CODE_RUNNER_URL is set: the route reads it at load time.
  const { default: router } = await import("../routes/submission.routes");
  api = await serve("/api/submissions", router);
});

afterAll(async () => {
  await api.close();
  await new Promise<void>((resolve) => runnerServer.close(() => resolve()));
});

beforeEach(() => {
  resetDb(db);
  ai.reviewCode.mockReset();
  runner.mode = "pass";
  runner.lastBody = null;
  runner.validated = null;
  runner.validateMode = "ok";
  db.handlers.push(
    {
      match: "SELECT id, slug, test_cases FROM problems WHERE id = $1",
      reply: (params) => (params[0] === PROBLEM ? [{ id: PROBLEM, slug: "two-sum", test_cases: CASES }] : []),
    },
    { match: "INSERT INTO submissions", reply: [{ id: SUBMISSION }] },
    { match: "INSERT INTO user_path_progress", reply: [] }
  );
});

const submit = (body: Record<string, unknown>) => api.request("POST", "/api/submissions", { body });
const valid = { problemId: PROBLEM, language: "python3", code: "print(1)" };

describe("POST /api/submissions validation", () => {
  it("requires a session", async () => {
    const r = await api.request("POST", "/api/submissions", { body: valid, token: null });
    expect(r.status).toBe(401);
  });

  it.each([
    ["missing fields", { problemId: PROBLEM }],
    ["a malformed problemId", { ...valid, problemId: "42" }],
    ["an unsupported language", { ...valid, language: "cobol" }],
    ["an unknown mode", { ...valid, mode: "debug" }],
  ])("400s on %s, before the database or the runner is touched", async (_label, body) => {
    const r = await submit(body);
    expect(r.status).toBe(400);
    expect(callsMatching(db, "FROM problems")).toHaveLength(0);
    expect(runner.lastBody).toBeNull();
  });

  it("404s on a problem that doesn't exist", async () => {
    const r = await submit({ ...valid, problemId: "ffffffff-ffff-4fff-8fff-ffffffffffff" });
    expect(r.status).toBe(404);
  });
});

describe("POST /api/submissions execution", () => {
  it("run mode sends only the example cases and stores nothing", async () => {
    const r = await submit({ ...valid, mode: "run" });
    expect(r.status).toBe(200);
    expect(r.body.mode).toBe("run");
    expect(runner.lastBody!.testCases).toHaveLength(4);
    expect(callsMatching(db, "INSERT INTO submissions")).toHaveLength(0);
  });

  it("submit runs the full suite, stores the result and credits learning paths", async () => {
    const r = await submit(valid);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ mode: "submit", status: "passed", submissionId: SUBMISSION });
    expect(runner.lastBody!.testCases).toHaveLength(CASES.length);
    const insert = callsMatching(db, "INSERT INTO submissions")[0];
    expect(insert.params.slice(0, 5)).toEqual([USER_ID, PROBLEM, "python3", "print(1)", "passed"]);
    expect(callsMatching(db, "INSERT INTO user_path_progress")).toHaveLength(1);
  });

  it("a failed submission is stored but credits no learning path", async () => {
    runner.mode = "fail";
    const r = await submit(valid);
    expect(r.body.status).toBe("failed");
    expect(callsMatching(db, "INSERT INTO user_path_progress")).toHaveLength(0);
  });

  it("an unreachable runner is a retryable 503 and stores nothing", async () => {
    runner.mode = "drop";
    const r = await submit(valid);
    expect(r.status).toBe(503);
    expect(r.body.retryable).toBe(true);
    expect(callsMatching(db, "INSERT INTO submissions")).toHaveLength(0);
  });

  it("a runner error is a 502", async () => {
    runner.mode = "error";
    const r = await submit(valid);
    expect(r.status).toBe(502);
  });
});

describe("hidden test cases (D-057)", () => {
  it("submit reveals examples and only the first failing hidden case", async () => {
    runner.mode = "fail"; // cases 4 and 5 (both hidden) fail
    const r = await submit(valid);
    const results = r.body.results as Array<Record<string, unknown>>;
    expect(results).toHaveLength(6);
    // Examples: full detail.
    expect(results[0]).toMatchObject({ passed: true, hidden: false, input: "0", expectedOutput: "0" });
    // First failing hidden case: revealed so it can be debugged.
    expect(results[4]).toMatchObject({ passed: false, hidden: false, input: "4", expectedOutput: "4", actualOutput: "wrong" });
    // Any other hidden case: pass/fail only.
    expect(results[5]).toEqual({ passed: false, hidden: true });
  });

  it("a diff goes with its case: shown for the first failing hidden case, never for the others", async () => {
    runner.mode = "fail";
    const r = await submit(valid);
    expect(r.body.results[4].diff).toEqual(DIFF);
    // The runner sent a diff for case 5 too; it must not survive the redaction.
    expect(r.body.results[5]).toEqual({ passed: false, hidden: true });
    expect(JSON.stringify(r.body.results.slice(5))).not.toContain("diff");
  });

  it("a passing hidden case doesn't leak its output, which equals the expected answer", async () => {
    const r = await submit(valid);
    expect(r.body.results[5]).toEqual({ passed: true, hidden: true });
  });
});

describe("languages", () => {
  it.each(["python3", "c", "cpp", "java", "javascript", "go", "rust"])("accepts %s and passes it to the runner", async (language) => {
    const r = await submit({ ...valid, language, mode: "run" });
    expect(r.status).toBe(200);
    expect(runner.lastBody!.language).toBe(language);
  });
});

describe("custom test cases", () => {
  const run = (customInputs: unknown) => submit({ ...valid, mode: "run", customInputs });

  it("runs them with the examples, against the reference solution, and returns them separately", async () => {
    const inputs = ["nums = [3, 3], target = 6", "nums = [1, 5, 9], target = 14"];
    const r = await run(inputs);
    expect(r.status).toBe(200);
    expect(runner.validated).toEqual({ slug: "two-sum", inputs });
    const sent = runner.lastBody!;
    expect(sent.testCases).toHaveLength(4);
    expect(sent.customCases!.inputs).toEqual(inputs);
    expect(sent.customCases!.reference.language).toBe("python3");
    expect(sent.customCases!.reference.code).toContain("def twoSum");
    expect(r.body.customResults).toHaveLength(2);
    expect(r.body.customResults[0]).toMatchObject({ input: inputs[0], judged: true, expectedOutput: "[0,1]" });
    expect(r.body.customResults[0].diff.kind).toBe("items");
  });

  it("never touch the hidden suite", async () => {
    await run(["nums = [3, 3], target = 6"]);
    const body = JSON.stringify(runner.lastBody);
    for (const hidden of CASES.slice(4)) expect(body).not.toContain(`"input":"${hidden.input}"`);
    expect(runner.lastBody!.testCases).toEqual(CASES.slice(0, 4));
  });

  it("a run without them reports an empty list", async () => {
    const r = await submit({ ...valid, mode: "run" });
    expect(r.body.customResults).toEqual([]);
    expect(runner.lastBody!.customCases).toBeUndefined();
    expect(runner.validated).toBeNull();
  });

  it("are refused on submit, which is judged on the problem's own suite", async () => {
    const r = await submit({ ...valid, customInputs: ["nums = [1, 2], target = 3"] });
    expect(r.status).toBe(400);
    expect(runner.lastBody).toBeNull();
    expect(callsMatching(db, "INSERT INTO submissions")).toHaveLength(0);
  });

  it.each([
    ["not an array", "nums = [1]"],
    ["more than 10", Array.from({ length: 11 }, () => "nums = [1], target = 1")],
    ["an empty input", ["  "]],
    ["a non-string", [42]],
    ["an input over 10,000 characters", ["x".repeat(10_001)]],
  ])("400 on %s, before anything runs", async (_label, customInputs) => {
    const r = await run(customInputs);
    expect(r.status).toBe(400);
    expect(runner.validated).toBeNull();
    expect(runner.lastBody).toBeNull();
  });

  it("a malformed input is a 400 naming it, and no sandbox runs", async () => {
    const r = await run(["nums = [1, 2], target = 3", "nums = [1], target = bad"]);
    expect(r.status).toBe(400);
    expect(r.body).toEqual({
      error: "Invalid custom test case",
      customInputErrors: [{ index: 1, error: "target should be an integer." }],
    });
    expect(runner.lastBody).toBeNull();
  });

  it("an unreachable runner during validation is a retryable 503", async () => {
    runner.validateMode = "drop";
    const r = await run(["nums = [1, 2], target = 3"]);
    expect(r.status).toBe(503);
    expect(r.body.retryable).toBe(true);
  });

  it("400 for a problem without a reference solution", async () => {
    db.handlers.unshift({
      match: "SELECT id, slug, test_cases FROM problems WHERE id = $1",
      reply: [{ id: PROBLEM, slug: "not-a-real-problem", test_cases: CASES }],
    });
    const r = await run(["x = 1"]);
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/aren't available/);
    expect(runner.validated).toBeNull();
  });

  it("failing examples in a run carry their diff", async () => {
    runner.mode = "fail";
    const r = await submit({ ...valid, mode: "run" });
    expect(r.body.results[3]).toEqual({ passed: false, actualOutput: "wrong", diff: DIFF });
  });
});

describe("GET /api/submissions", () => {
  it.each([
    ["a malformed problemId", "?problemId=nope"],
    ["an unknown status", "?status=pending"],
  ])("400s on %s", async (_label, qs) => {
    const r = await api.request("GET", `/api/submissions${qs}`);
    expect(r.status).toBe(400);
  });

  it("scopes to the caller and clamps paging", async () => {
    db.handlers.push(
      { match: "SELECT COUNT(*) AS count FROM submissions s", reply: [{ count: "3" }] },
      { match: "JOIN problems p ON p.id = s.problem_id", reply: [] }
    );
    const r = await api.request("GET", "/api/submissions?limit=9999&offset=-5");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ total: 3, limit: 200, offset: 0 });
    const list = callsMatching(db, "JOIN problems p ON p.id = s.problem_id")[0];
    expect(list.params[0]).toBe(USER_ID);
  });
});

describe("GET /api/submissions/:id and review", () => {
  it("400s on a malformed id", async () => {
    expect((await api.request("GET", "/api/submissions/xyz")).status).toBe(400);
  });

  it("404s on a submission the caller doesn't own", async () => {
    db.handlers.push({ match: "FROM submissions WHERE id = $1 AND user_id = $2", reply: [] });
    expect((await api.request("GET", `/api/submissions/${SUBMISSION}`)).status).toBe(404);
  });

  it("review 404s without calling the model when the submission isn't the caller's", async () => {
    db.handlers.push({ match: "WHERE s.id = $1 AND s.user_id = $2", reply: [] });
    const r = await api.request("POST", `/api/submissions/${SUBMISSION}/review`);
    expect(r.status).toBe(404);
    expect(ai.reviewCode).not.toHaveBeenCalled();
  });

  it("review maps an AI outage to 503", async () => {
    db.handlers.push({
      match: "WHERE s.id = $1 AND s.user_id = $2",
      reply: [{ code: "x", language: "python3", title: "t", description: "d", difficulty: "easy" }],
    });
    ai.reviewCode.mockRejectedValue(new AIServiceError(502, "down"));
    const r = await api.request("POST", `/api/submissions/${SUBMISSION}/review`);
    expect(r.status).toBe(503);
  });
});
