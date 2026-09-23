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
const runner = {
  mode: "pass" as "pass" | "fail" | "error" | "drop",
  lastBody: null as null | { testCases: unknown[]; language: string; slug: string },
};
let runnerServer: Server;
let api: TestServer;

beforeAll(async () => {
  runnerServer = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
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
        return { passed: ok, actualOutput: ok ? `${i}` : "wrong" };
      });
      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({ passed: results.every((r) => r.passed), results, runtimeMs: 12, memoryKb: 900 })
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

  it("a passing hidden case doesn't leak its output, which equals the expected answer", async () => {
    const r = await submit(valid);
    expect(r.body.results[5]).toEqual({ passed: true, hidden: true });
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
