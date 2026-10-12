import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { callsMatching, resetDb, serve, USER_ID, type FakeDb, type TestServer } from "./helpers/harness";

const db = vi.hoisted(() => ({ handlers: [], calls: [] }) as FakeDb);
vi.mock("../db", async () => (await import("./helpers/fake-db")).fakeDbModule(db));

const ai = vi.hoisted(() => ({ reviewCode: vi.fn() }));
vi.mock("../services/ai.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/ai.service")>()),
  ...ai,
}));

import { resetComplexityProblemsCache } from "../services/code-runner.client";

const SUBMISSION = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const sizes = [256, 512, 1024, 2048, 4096, 8192];
const QUADRATIC = sizes.map((n) => ({ n, ns: [n * n * 2, n * n * 2.1, n * n * 2.2] }));

// A stand-in code-runner on a real socket, so the service's own fetch is exercised.
const runner = {
  mode: "ok" as "ok" | "drop" | "error",
  supported: ["two-sum"],
  measured: 0,
  lastBody: null as null | { language: string; code: string; slug: string },
  measurement: { points: QUADRATIC, stopped: "time_limit", elapsedMs: 20000 } as Record<string, unknown>,
};
const source = { id: SUBMISSION, language: "python3", code: "class Solution: ...", status: "passed", slug: "two-sum" };
const stored = { claim: null as string | null, analysis: null as null | Record<string, unknown> };

let runnerServer: Server;
let api: TestServer;

beforeAll(async () => {
  runnerServer = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      if (runner.mode === "drop") return req.socket.destroy();
      if (runner.mode === "error") return void res.writeHead(500).end("sandbox exploded");
      if (req.url === "/complexity/problems") {
        return void res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ slugs: runner.supported }));
      }
      runner.measured++;
      runner.lastBody = JSON.parse(raw);
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(runner.measurement));
    });
  });
  runnerServer.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => runnerServer.once("listening", resolve));
  process.env.CODE_RUNNER_URL = `http://127.0.0.1:${(runnerServer.address() as AddressInfo).port}`;
  const { default: router } = await import("../routes/submission.routes");
  api = await serve("/api/submissions", router);
});

afterAll(async () => {
  await api.close();
  await new Promise<void>((resolve) => runnerServer.close(() => resolve()));
});

beforeEach(() => {
  resetDb(db);
  resetComplexityProblemsCache();
  ai.reviewCode.mockReset();
  Object.assign(runner, { mode: "ok", supported: ["two-sum"], measured: 0, lastBody: null });
  runner.measurement = { points: QUADRATIC, stopped: "time_limit", elapsedMs: 20000 };
  stored.claim = null;
  stored.analysis = null;
  db.handlers.push(
    { match: "s.status, p.slug", reply: () => [source] },
    {
      match: "INSERT INTO complexity_analyses",
      reply: (params: unknown[]) => {
        stored.analysis = {
          fit: JSON.parse(params[1] as string),
          stopped: params[2],
          error: params[3],
          error_at_n: params[4],
          created_at: "2026-10-12T00:00:00.000Z",
        };
        return [stored.analysis];
      },
    },
    { match: "FROM complexity_analyses WHERE submission_id", reply: () => (stored.analysis ? [stored.analysis] : []) },
    { match: "FROM submission_reviews WHERE submission_id", reply: () => (stored.claim === null ? [] : [{ claimed: stored.claim }]) },
    { match: "INSERT INTO submission_reviews", reply: [] }
  );
});

const measure = () => api.request("POST", `/api/submissions/${SUBMISSION}/complexity`);
const read = () => api.request("GET", `/api/submissions/${SUBMISSION}/complexity`);

describe("POST /api/submissions/:id/complexity", () => {
  it("400s on a malformed id", async () => {
    expect((await api.request("POST", "/api/submissions/xyz/complexity")).status).toBe(400);
  });

  it("404s on a submission that isn't the caller's, before any sandbox runs", async () => {
    db.handlers.unshift({ match: "s.status, p.slug", reply: [] });
    expect((await measure()).status).toBe(404);
    expect(runner.measured).toBe(0);
    expect(callsMatching(db, "s.status, p.slug")[0].params).toEqual([SUBMISSION, USER_ID]);
  });

  it("measures only an accepted submission", async () => {
    db.handlers.unshift({ match: "s.status, p.slug", reply: [{ ...source, status: "failed" }] });
    const r = await measure();
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/accepted/);
    expect(runner.measured).toBe(0);
  });

  it("400s for a problem without curated inputs, without a sandbox run", async () => {
    runner.supported = ["binary-search"];
    const r = await measure();
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/isn't available/);
    expect(runner.measured).toBe(0);
  });

  it("runs the submission's own code, fits, stores and returns the analysis", async () => {
    const r = await measure();
    expect(r.status).toBe(200);
    expect(runner.lastBody).toEqual({ language: "python3", code: source.code, slug: "two-sum" });
    expect(r.body.analysis).toMatchObject({
      fit: { status: "measured", bestFit: "O(n²)", candidates: ["O(n²)"], confidence: "high" },
      stopped: "time_limit",
      error: null,
      claim: { text: null, class: null, verdict: "not_comparable" },
    });
    expect(callsMatching(db, "INSERT INTO complexity_analyses")[0].params[0]).toBe(SUBMISSION);
  });

  it("compares with the stored AI review's claim", async () => {
    stored.claim = "O(n) using a hash map";
    expect((await measure()).body.analysis.claim).toEqual({ text: "O(n) using a hash map", class: "O(n)", verdict: "disagrees" });
    stored.claim = "O(N^2)";
    expect((await read()).body.analysis.claim).toMatchObject({ class: "O(n²)", verdict: "agrees" });
  });

  it("stores a failed run's error and the size it failed at", async () => {
    runner.measurement = { points: QUADRATIC.slice(0, 2), stopped: "error", error: "index out of range", errorAtN: 1024, elapsedMs: 300 };
    const r = await measure();
    expect(r.status).toBe(200);
    expect(r.body.analysis).toMatchObject({
      fit: { status: "inconclusive", reason: "too_few_sizes" },
      stopped: "error",
      error: "index out of range",
      errorAtN: 1024,
    });
  });

  it("a runner that can't be reached is a retryable 503; one that fails is a 502", async () => {
    runner.mode = "drop";
    const down = await measure();
    expect(down.status).toBe(503);
    expect(down.body.retryable).toBe(true);
    resetComplexityProblemsCache();
    runner.mode = "error";
    expect((await measure()).status).toBe(502);
    expect(callsMatching(db, "INSERT INTO complexity_analyses")).toHaveLength(0);
  });
});

describe("GET /api/submissions/:id/complexity", () => {
  it("nothing measured yet: available, no analysis", async () => {
    expect((await read()).body).toEqual({ available: true, analysis: null });
  });

  it("not available for a failed submission or an uncurated problem", async () => {
    db.handlers.unshift({ match: "s.status, p.slug", reply: [{ ...source, status: "failed" }] });
    expect((await read()).body.available).toBe(false);
    resetDb(db);
    db.handlers.push(
      { match: "s.status, p.slug", reply: [source] },
      { match: "FROM complexity_analyses WHERE submission_id", reply: [] }
    );
    runner.supported = [];
    resetComplexityProblemsCache();
    expect((await read()).body.available).toBe(false);
  });

  it("with the runner down, still returns the stored analysis, just not available", async () => {
    await measure();
    runner.mode = "drop";
    resetComplexityProblemsCache();
    const r = await read();
    expect(r.status).toBe(200);
    expect(r.body.available).toBe(false);
    expect(r.body.analysis.fit.bestFit).toBe("O(n²)");
  });

  it("404s on someone else's submission", async () => {
    db.handlers.unshift({ match: "s.status, p.slug", reply: [] });
    expect((await read()).status).toBe(404);
  });
});

describe("the AI review is kept for the comparison", () => {
  it("POST /:id/review stores the review it returns", async () => {
    db.handlers.unshift({
      match: "WHERE s.id = $1 AND s.user_id = $2",
      reply: [{ code: "x", language: "python3", title: "t", description: "d", difficulty: "easy" }],
    });
    const review = {
      timeComplexity: "O(n)",
      spaceComplexity: "O(n)",
      qualityScore: 8,
      strengths: [],
      issues: [],
      optimizations: [],
      summary: "fine",
    };
    ai.reviewCode.mockResolvedValue(review);
    const r = await api.request("POST", `/api/submissions/${SUBMISSION}/review`);
    expect(r.status).toBe(200);
    const insert = callsMatching(db, "INSERT INTO submission_reviews")[0];
    expect(insert.params[0]).toBe(SUBMISSION);
    expect(JSON.parse(insert.params[1] as string)).toEqual(review);
  });
});
