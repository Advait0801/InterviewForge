import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { callsMatching, resetDb, serve, USER_ID, type FakeDb, type TestServer } from "./helpers/harness";

const db = vi.hoisted(() => ({ handlers: [], calls: [] }) as FakeDb);
vi.mock("../db", async () => (await import("./helpers/fake-db")).fakeDbModule(db));

const PROBLEM = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const SUBMISSION = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const CASES = [{ input: "0", expectedOutput: "0" }];

const runner = { passed: true };
const state = {
  attempts: 1,
  hinted: false,
  claimed: true,
  userRatings: [] as Array<{ topic: string; rating: number; games: number }>,
  problemRating: null as null | { rating: number; games: number },
};

let runnerServer: Server;
let submissions: TestServer;
let ratings: TestServer;

beforeAll(async () => {
  runnerServer = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      const results = CASES.map(() => ({ passed: runner.passed, actualOutput: runner.passed ? "0" : "1" }));
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ passed: runner.passed, results, runtimeMs: 5 }));
    });
  });
  runnerServer.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => runnerServer.once("listening", resolve));
  process.env.CODE_RUNNER_URL = `http://127.0.0.1:${(runnerServer.address() as AddressInfo).port}`;
  submissions = await serve("/api/submissions", (await import("../routes/submission.routes")).default);
  ratings = await serve("/api/ratings", (await import("../routes/ratings.routes")).default);
});

afterAll(async () => {
  await submissions.close();
  await ratings.close();
  await new Promise<void>((resolve) => runnerServer.close(() => resolve()));
});

beforeEach(() => {
  resetDb(db);
  runner.passed = true;
  Object.assign(state, { attempts: 1, hinted: false, claimed: true, userRatings: [], problemRating: null });
  db.handlers.push(
    { match: "SELECT id, slug, test_cases FROM problems WHERE id = $1", reply: [{ id: PROBLEM, slug: "two-sum", test_cases: CASES }] },
    { match: "INSERT INTO submissions", reply: [{ id: SUBMISSION }] },
    { match: "INSERT INTO user_path_progress", reply: [] },
    // The review queue (D-070): a clean first pass enrols nothing.
    { match: "FROM review_items WHERE user_id = $1 AND problem_id = $2 FOR UPDATE", reply: [] },
    { match: "AS n FROM submissions", reply: [{ n: 0 }] },
    { match: "INSERT INTO review_items", reply: [] },
    { match: "FROM problem_hint_views", reply: () => (state.hinted ? [{ "?column?": 1 }] : []) },
    // Elo (D-076).
    { match: "AS attempts FROM submissions", reply: () => [{ attempts: state.attempts }] },
    {
      match: "SELECT id, slug, title, difficulty, topics FROM problems WHERE id = $1",
      reply: [{ id: PROBLEM, slug: "two-sum", title: "Two Sum", difficulty: "easy", topics: ["array", "hash-table"] }],
    },
    { match: "SELECT id FROM users WHERE id = $1 FOR NO KEY UPDATE", reply: [{ id: USER_ID }] },
    { match: "FROM user_topic_ratings WHERE user_id = $1", reply: () => state.userRatings },
    { match: "INSERT INTO problem_ratings", reply: [] },
    { match: "FROM problem_ratings WHERE problem_id = $1 FOR UPDATE", reply: () => [state.problemRating ?? { rating: 1200, games: 0 }] },
    { match: "INSERT INTO rated_games", reply: () => (state.claimed ? [{ user_id: USER_ID }] : []) },
    { match: "INSERT INTO user_topic_ratings", reply: [] },
    { match: "UPDATE problem_ratings", reply: [] }
  );
});

const submit = () => submissions.request("POST", "/api/submissions", { body: { problemId: PROBLEM, language: "python3", code: "x" } });

describe("a first Submit is a rated game", () => {
  it("a new user passing an easy problem first time: predicted 0.849, gains 40 x 0.151", async () => {
    const r = await submit();
    expect(r.status).toBe(201);
    expect(r.body.rating).toEqual({ score: 1, expected: 0.849, before: 1500, after: 1506, delta: 6 });
    const game = callsMatching(db, "INSERT INTO rated_games")[0].params;
    expect(game.slice(0, 4)).toEqual([USER_ID, PROBLEM, SUBMISSION, 1]);
    // Both topics and the overall rating are written; the problem loses what the user gained (by its own K).
    const writes = callsMatching(db, "INSERT INTO user_topic_ratings").map((c) => c.params[1]);
    expect(writes.sort()).toEqual(["__overall__", "array", "hash-table"]);
    const [problemId, rating, games] = callsMatching(db, "UPDATE problem_ratings")[0].params as [string, number, number];
    expect(problemId).toBe(PROBLEM);
    expect(rating).toBeCloseTo(1200 - 24 * (1 - 0.849), 1);
    expect(games).toBe(1);
  });

  it("a fail scores 0", async () => {
    runner.passed = false;
    expect((await submit()).body.rating).toMatchObject({ score: 0, delta: -34 });
  });

  it("a pass after viewing hints scores 0.5", async () => {
    state.hinted = true;
    expect((await submit()).body.rating).toMatchObject({ score: 0.5 });
  });

  it("only the first Submit counts: a later one writes no rating at all", async () => {
    state.attempts = 2;
    const r = await submit();
    expect(r.body.rating).toBeNull();
    for (const sql of ["INSERT INTO rated_games", "INSERT INTO user_topic_ratings", "UPDATE problem_ratings", "FOR UPDATE"]) {
      expect(callsMatching(db, sql).filter((c) => !c.sql.includes("review_items")), sql).toHaveLength(0);
    }
  });

  it("a racing first Submit that loses the claim writes nothing", async () => {
    state.claimed = false;
    const r = await submit();
    expect(r.body.rating).toBeNull();
    expect(callsMatching(db, "INSERT INTO user_topic_ratings")).toHaveLength(0);
    expect(callsMatching(db, "UPDATE problem_ratings")).toHaveLength(0);
  });

  it("locks the user before reading ratings, and the problem row before reading it", async () => {
    await submit();
    const order = db.calls.map((c) => c.sql);
    const at = (s: string) => order.findIndex((q) => q.includes(s));
    expect(at("SELECT id FROM users WHERE id = $1 FOR NO KEY UPDATE")).toBeLessThan(at("FROM user_topic_ratings WHERE user_id = $1"));
    expect(at("INSERT INTO problem_ratings")).toBeLessThan(at("FROM problem_ratings WHERE problem_id = $1 FOR UPDATE"));
    expect(at("INSERT INTO rated_games")).toBeLessThan(at("INSERT INTO user_topic_ratings"));
  });
});

describe("GET /api/ratings/me", () => {
  it("a user who has never submitted is at the start rating", async () => {
    const r = await ratings.request("GET", "/api/ratings/me");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ overall: { rating: 1500, games: 0 }, topics: [] });
  });

  it("separates the overall rating from topics, and blends a sparse topic toward it", async () => {
    state.userRatings = [
      { topic: "__overall__", rating: 1700, games: 20 },
      { topic: "array", rating: 1500, games: 4 },
      { topic: "graph", rating: 1800, games: 12 },
    ];
    const r = await ratings.request("GET", "/api/ratings/me");
    expect(r.body).toEqual({
      overall: { rating: 1700, games: 20 },
      topics: [
        { topic: "graph", rating: 1775, games: 12 },
        { topic: "array", rating: 1600, games: 4 },
      ],
    });
  });

  it("needs a signed-in user", async () => {
    expect((await ratings.request("GET", "/api/ratings/me", { token: null })).status).toBe(401);
  });
});

describe("GET /api/ratings/next", () => {
  const problems = [
    { id: "11111111-1111-4111-8111-111111111111", slug: "easy-one", title: "E", difficulty: "easy", topics: ["array"], rating: null, games: null },
    { id: "22222222-2222-4222-8222-222222222222", slug: "medium-one", title: "M", difficulty: "medium", topics: ["array"], rating: null, games: null },
    { id: "33333333-3333-4333-8333-333333333333", slug: "played", title: "P", difficulty: "hard", topics: ["graph"], rating: 1392, games: 30 },
  ];
  beforeEach(() => {
    db.handlers.unshift({ match: "FROM problems p", reply: problems });
  });

  it("offers the problem closest to 65% first, using a played problem's learned rating", async () => {
    const r = await ratings.request("GET", "/api/ratings/next");
    expect(r.status).toBe(200);
    expect(r.body.target).toBe(0.65);
    expect(r.body.picks.map((p: { problem: { slug: string } }) => p.problem.slug)).toEqual(["played", "medium-one", "easy-one"]);
    expect(r.body.picks[0]).toMatchObject({ problemRating: 1392, userRating: 1500 });
    expect(r.body.picks[0].predictedSuccess).toBeCloseTo(0.65, 2);
  });

  it("only offers problems the caller has never submitted", async () => {
    await ratings.request("GET", "/api/ratings/next");
    const q = callsMatching(db, "FROM problems p")[0];
    expect(q.sql).toContain("NOT EXISTS (SELECT 1 FROM submissions s WHERE s.problem_id = p.id AND s.user_id = $1)");
    expect(q.params).toEqual([USER_ID]);
  });

  it("filters by topic, and validates it", async () => {
    const r = await ratings.request("GET", "/api/ratings/next?topic=array");
    expect(r.body.picks.map((p: { problem: { slug: string } }) => p.problem.slug)).toEqual(["medium-one", "easy-one"]);
    expect((await ratings.request("GET", `/api/ratings/next?topic=${"x".repeat(65)}`)).status).toBe(400);
  });
});
