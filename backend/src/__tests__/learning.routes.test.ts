/**
 * Route tests for the learning features (Group C, Phase 8, D-070): problem of the day,
 * hint views, the review queue and personal learning paths. The scheduling and selection
 * logic has its own unit tests (daily, sm2, weakness); these check the HTTP behaviour, the
 * SQL each route is allowed to run, and that a personal path stays private.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OTHER_USER_ID,
  USER_ID,
  callsMatching,
  resetDb,
  serve,
  tokenFor,
  type FakeDb,
  type TestServer,
} from "./helpers/harness";

const db = vi.hoisted(() => ({ handlers: [], calls: [] }) as FakeDb);
vi.mock("../db", async () => (await import("./helpers/fake-db")).fakeDbModule(db));

const NOW = Date.parse("2026-10-10T12:00:00Z"); // a Saturday: hard
const PROBLEM = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CATALOGUE = [
  { id: "11111111-1111-4111-8111-111111111111", slug: "easy-one", difficulty: "easy" },
  { id: "22222222-2222-4222-8222-222222222222", slug: "medium-one", difficulty: "medium" },
  { id: "33333333-3333-4333-8333-333333333333", slug: "hard-one", difficulty: "hard" },
  { id: "44444444-4444-4444-8444-444444444444", slug: "hard-two", difficulty: "hard" },
];
const brief = (id: string) => {
  const p = CATALOGUE.find((c) => c.id === id)!;
  return { id: p.id, slug: p.slug, title: p.slug, difficulty: p.difficulty, topics: ["Graphs"] };
};

/** daily_problems, in memory. */
let recorded: Map<string, string>;
/** Days the user solved that day's problem on the day. */
let solvedOnDays: string[];

let problems: TestServer;
let review: TestServer;
let paths: TestServer;

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  problems = await serve("/api/problems", (await import("../routes/problems.routes")).default);
  review = await serve("/api/review", (await import("../routes/review.routes")).default);
  paths = await serve("/api/learning-paths", (await import("../routes/learningPaths.routes")).default);
});

afterAll(async () => {
  vi.useRealTimers();
  await Promise.all([problems.close(), review.close(), paths.close()]);
});

beforeEach(() => {
  resetDb(db);
  recorded = new Map();
  solvedOnDays = [];
  db.handlers.push(
    {
      match: "FROM daily_problems d JOIN problems p",
      reply: (params) =>
        [...recorded.entries()]
          .filter(([day]) => day >= (params[0] as string) && day <= (params[1] as string))
          .sort(([a], [b]) => (a < b ? 1 : -1))
          .map(([day, id]) => ({ day, ...brief(id) })),
    },
    {
      match: "INSERT INTO daily_problems",
      reply: (params) => {
        const [days, ids] = params as [string[], string[]];
        days.forEach((d, i) => recorded.has(d) || recorded.set(d, ids[i]));
        return [];
      },
    },
    { match: "SELECT id, slug, difficulty FROM problems", reply: () => CATALOGUE },
    {
      match: "FROM daily_problems d JOIN submissions s",
      reply: (params) =>
        solvedOnDays
          .filter((d) => (!params[1] || d >= (params[1] as string)) && (!params[2] || d <= (params[2] as string)))
          .map((day) => ({ day })),
    },
    { match: "SELECT DISTINCT problem_id FROM submissions", reply: [] }
  );
});

describe("GET /api/problems/daily", () => {
  it("anonymous: today's problem (UTC), of the weekday's difficulty, recorded once", async () => {
    const r = await problems.request("GET", "/api/problems/daily", { token: null });
    expect(r.status).toBe(200);
    expect(r.body.date).toBe("2026-10-10");
    expect(r.body.problem.difficulty).toBe("hard");
    expect(r.body).not.toHaveProperty("streak");
    expect(callsMatching(db, "INSERT INTO daily_problems")).toHaveLength(1);

    const again = await problems.request("GET", "/api/problems/daily", { token: null });
    expect(again.body.problem.id).toBe(r.body.problem.id);
    expect(callsMatching(db, "INSERT INTO daily_problems")).toHaveLength(1); // already recorded
  });

  it("a recorded day keeps its problem, whatever the computation would pick now", async () => {
    recorded.set("2026-10-10", CATALOGUE[0].id); // an easy problem, on a hard day
    const r = await problems.request("GET", "/api/problems/daily");
    expect(r.body.problem.slug).toBe("easy-one");
    expect(callsMatching(db, "SELECT id, slug, difficulty FROM problems")).toHaveLength(0);
  });

  it("signed in: solved today, solved ever, and the daily streak", async () => {
    solvedOnDays = ["2026-10-08", "2026-10-09", "2026-10-10"];
    const r = await problems.request("GET", "/api/problems/daily");
    expect(r.body).toMatchObject({ solvedOnDay: true, solved: false, streak: { current: 3, best: 3 } });
  });

  it("a past date in range is served; it's recorded on first ask", async () => {
    const r = await problems.request("GET", "/api/problems/daily?date=2026-10-05");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ date: "2026-10-05", problem: { difficulty: "easy" } });
  });

  it.each([
    ["a future date", "2026-10-11"],
    ["a date that doesn't exist", "2026-02-30"],
    ["a malformed date", "10/10/2026"],
    ["a date more than a year back", "2025-10-09"],
  ])("400 for %s", async (_label, date) => {
    const r = await problems.request("GET", `/api/problems/daily?date=${encodeURIComponent(date)}`);
    expect(r.status).toBe(400);
    expect(callsMatching(db, "daily_problems")).toHaveLength(0);
  });
});

describe("GET /api/problems/daily/history", () => {
  it("the last N days newest first, filling unrecorded days in one insert", async () => {
    recorded.set("2026-10-09", CATALOGUE[1].id);
    solvedOnDays = ["2026-10-09"];
    const r = await problems.request("GET", "/api/problems/daily/history?days=7");
    expect(r.status).toBe(200);
    expect(r.body.days.map((d: { date: string }) => d.date)).toEqual([
      "2026-10-10", "2026-10-09", "2026-10-08", "2026-10-07", "2026-10-06", "2026-10-05", "2026-10-04",
    ]);
    expect(r.body.days[1]).toMatchObject({ problem: { slug: "medium-one" }, solvedOnDay: true });
    expect(r.body.days[0].solvedOnDay).toBe(false);
    expect(r.body.streak).toEqual({ current: 1, best: 1 });
    const inserts = callsMatching(db, "INSERT INTO daily_problems");
    expect(inserts).toHaveLength(1);
    expect((inserts[0].params[0] as string[]).length).toBe(6);
  });

  it.each(["0", "61", "abc", "2.5"])("400 for days=%s", async (days) => {
    expect((await problems.request("GET", `/api/problems/daily/history?days=${days}`)).status).toBe(400);
  });
});

describe("POST /api/problems/:id/hints/viewed", () => {
  beforeEach(() => {
    db.handlers.unshift(
      { match: "SELECT hints FROM problems WHERE id = $1", reply: (p) => (p[0] === PROBLEM ? [{ hints: '["a","b","c"]' }] : []) },
      { match: "INSERT INTO problem_hint_views", reply: (p) => [{ hints_viewed: p[2] }] }
    );
  });

  it("records the count", async () => {
    const r = await problems.request("POST", `/api/problems/${PROBLEM}/hints/viewed`, { body: { count: 2 } });
    expect(r).toMatchObject({ status: 200, body: { hintsViewed: 2 } });
    expect(callsMatching(db, "INSERT INTO problem_hint_views")[0].params).toEqual([USER_ID, PROBLEM, 2]);
  });

  it.each([
    ["more hints than the problem has", { count: 4 }, 400],
    ["zero", { count: 0 }, 400],
    ["a non-integer", { count: 1.5 }, 400],
    ["no count", {}, 400],
  ])("%s -> %i", async (_label, body, status) => {
    expect((await problems.request("POST", `/api/problems/${PROBLEM}/hints/viewed`, { body })).status).toBe(status);
    expect(callsMatching(db, "INSERT INTO problem_hint_views")).toHaveLength(0);
  });

  it("404 for an unknown problem, 401 anonymous", async () => {
    const other = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    expect((await problems.request("POST", `/api/problems/${other}/hints/viewed`, { body: { count: 1 } })).status).toBe(404);
    expect((await problems.request("POST", `/api/problems/${PROBLEM}/hints/viewed`, { body: { count: 1 }, token: null })).status).toBe(401);
  });
});

describe("/api/review", () => {
  const row = (slug: string, due: string, ease: number) => ({
    problem_id: CATALOGUE[0].id,
    slug,
    title: slug,
    difficulty: "easy",
    topics: [],
    ease_factor: ease,
    interval_days: 1,
    repetitions: 0,
    lapses: 1,
    due_on: due,
    last_quality: 1,
    last_reviewed_at: null,
    source: "failed",
  });

  it("splits due (today or earlier) from upcoming, keeping the database's order", async () => {
    db.handlers.unshift({
      match: "FROM review_items r JOIN problems p",
      reply: [row("overdue", "2026-10-01", 1.3), row("today", "2026-10-10", 2.5), row("tomorrow", "2026-10-11", 2.5)],
    });
    const r = await review.request("GET", "/api/review");
    expect(r.status).toBe(200);
    expect(r.body.today).toBe("2026-10-10");
    expect(r.body.due.map((i: { slug: string }) => i.slug)).toEqual(["overdue", "today"]);
    expect(r.body.upcoming.map((i: { slug: string }) => i.slug)).toEqual(["tomorrow"]);
    expect(r.body.counts).toEqual({ due: 2, total: 3 });
    expect(callsMatching(db, "FROM review_items r")[0].params).toEqual([USER_ID]);
  });

  it("add: 201 when new, 200 when already queued, 404 for an unknown problem", async () => {
    let queued = false;
    db.handlers.unshift(
      { match: "SELECT hints FROM problems WHERE id = $1", reply: (p) => (p[0] === PROBLEM ? [{ hints: null }] : []) },
      { match: "INSERT INTO review_items", reply: () => ({ rows: [], rowCount: queued ? 0 : ((queued = true), 1) }) }
    );
    expect(await review.request("POST", `/api/review/${PROBLEM}`)).toMatchObject({ status: 201, body: { added: true } });
    expect(await review.request("POST", `/api/review/${PROBLEM}`)).toMatchObject({ status: 200, body: { added: false } });
    expect(callsMatching(db, "INSERT INTO review_items")[0].params).toEqual([USER_ID, PROBLEM, "2026-10-10"]);
    expect((await review.request("POST", "/api/review/ffffffff-ffff-4fff-8fff-ffffffffffff")).status).toBe(404);
  });

  it("remove: 200, then 404 once it's gone", async () => {
    let present = true;
    db.handlers.unshift({ match: "DELETE FROM review_items", reply: () => ({ rows: [], rowCount: present ? ((present = false), 1) : 0 }) });
    expect((await review.request("DELETE", `/api/review/${PROBLEM}`)).status).toBe(200);
    expect((await review.request("DELETE", `/api/review/${PROBLEM}`)).status).toBe(404);
  });

  it("400 on a malformed id; 401 anonymous", async () => {
    expect((await review.request("POST", "/api/review/nope")).status).toBe(400);
    expect((await review.request("GET", "/api/review", { token: null })).status).toBe(401);
  });
});

describe("personal learning paths", () => {
  const PATH_ID = "99999999-9999-4999-8999-999999999999";
  const mine = {
    id: PATH_ID,
    slug: "focus-abc",
    title: "Your focus: Graphs",
    description: "d",
    topic: "Graphs",
    difficulty_level: "beginner",
    owner_user_id: USER_ID,
    focus_json: {
      topics: [{ topic: "Graphs", submissions: 4, failed: 3, lapses: 0, hintedProblems: 0, problemsSolved: 1, score: 0.667 }],
      reasons: { [CATALOGUE[0].id]: "Graphs" },
    },
  };

  beforeEach(() => {
    db.handlers.unshift(
      {
        match: "FROM learning_paths WHERE slug = $1",
        reply: (p) => (String(p[0]).startsWith("focus-") ? [{ ...mine, slug: p[0] }] : []),
      },
      {
        match: "FROM learning_path_problems lpp JOIN problems p",
        reply: [{ problem_id: CATALOGUE[0].id, position: 1, title: "easy-one", slug: "easy-one", difficulty: "easy" }],
      },
      { match: "SELECT problem_id FROM user_path_progress", reply: [] }
    );
  });

  it("the owner sees it, with the topics it was built from and each problem's reason", async () => {
    const r = await paths.request("GET", "/api/learning-paths/focus-abc");
    expect(r.status).toBe(200);
    expect(r.body.path).toMatchObject({ isPersonal: true, focusTopics: [{ topic: "Graphs", score: 0.667 }] });
    expect(r.body.problems[0].focusTopic).toBe("Graphs");
  });

  it("anyone else gets a 404, as if it didn't exist -- reading it or completing a problem in it", async () => {
    const other = tokenFor(OTHER_USER_ID);
    expect((await paths.request("GET", "/api/learning-paths/focus-abc", { token: other })).status).toBe(404);
    expect((await paths.request("GET", "/api/learning-paths/focus-abc", { token: null })).status).toBe(404);
    const complete = await paths.request("POST", `/api/learning-paths/focus-abc/complete/${CATALOGUE[0].id}`, { token: other });
    expect(complete.status).toBe(404);
    expect(callsMatching(db, "INSERT INTO user_path_progress")).toHaveLength(0);
  });

  it("the list asks only for curated paths and the caller's own", async () => {
    db.handlers.unshift(
      { match: "FROM learning_paths lp", reply: [] },
      { match: "FROM user_path_progress upp", reply: [] }
    );
    await paths.request("GET", "/api/learning-paths", { token: tokenFor(OTHER_USER_ID) });
    const list = callsMatching(db, "FROM learning_paths lp")[0];
    expect(list.sql).toContain("WHERE lp.owner_user_id IS NULL OR lp.owner_user_id = $1");
    expect(list.params).toEqual([OTHER_USER_ID]);
  });

  describe("POST /api/learning-paths/generate", () => {
    const stats = (rows: Record<string, unknown>[], total: number, unsolved: Record<string, unknown>[]) => {
      db.handlers.unshift(
        { match: "WITH subs AS", reply: rows },
        { match: "COUNT(*)::int AS n FROM submissions WHERE user_id = $1", reply: [{ n: total }] },
        { match: "FROM problems p WHERE NOT EXISTS", reply: unsolved },
        { match: "DELETE FROM learning_paths WHERE owner_user_id = $1", reply: [] },
        { match: "INSERT INTO learning_paths", reply: [{ id: PATH_ID }] },
        { match: "INSERT INTO learning_path_problems", reply: [] }
      );
    };

    it("replaces the caller's path in one transaction and returns it", async () => {
      stats(
        [{ topic: "Graphs", submissions: 4, failed: 3, problems_solved: 1, lapses: 0, hinted_problems: 0 }],
        4,
        [{ ...brief(CATALOGUE[0].id), difficulty: "easy" }]
      );
      const r = await paths.request("POST", "/api/learning-paths/generate");
      expect(r.status).toBe(201);
      expect(r.body.path.isPersonal).toBe(true);
      const sqls = db.calls.map((c) => c.sql);
      const begin = sqls.indexOf("BEGIN");
      const del = sqls.findIndex((s) => s.startsWith("DELETE FROM learning_paths"));
      const ins = sqls.findIndex((s) => s.startsWith("INSERT INTO learning_path_problems"));
      const commit = sqls.indexOf("COMMIT");
      expect(begin).toBeGreaterThanOrEqual(0);
      expect(begin < del && del < ins && ins < commit).toBe(true);
      const inserted = callsMatching(db, "INSERT INTO learning_paths")[0].params;
      expect(inserted[5]).toBe(USER_ID); // owner
      expect(inserted[0]).toMatch(/^focus-[0-9a-f]{12}$/);
      expect(inserted[0]).not.toContain(USER_ID.slice(0, 8));
      expect(callsMatching(db, "INSERT INTO learning_path_problems")[0].params[1]).toEqual([CATALOGUE[0].id]);
    });

    it.each([
      ["not_enough_history", [], 1, []],
      ["no_weak_topics", [{ topic: "Graphs", submissions: 9, failed: 0, problems_solved: 9, lapses: 0, hinted_problems: 0 }], 9, []],
      ["nothing_left_to_practise", [{ topic: "Graphs", submissions: 4, failed: 3, problems_solved: 1, lapses: 0, hinted_problems: 0 }], 4, []],
    ])("409 %s, writing nothing", async (code, rows, total, unsolved) => {
      stats(rows, total, unsolved);
      const r = await paths.request("POST", "/api/learning-paths/generate");
      expect(r.status).toBe(409);
      expect(r.body.code).toBe(code);
      expect(callsMatching(db, "learning_paths WHERE owner_user_id")).toHaveLength(0);
    });

    it("401 anonymous", async () => {
      expect((await paths.request("POST", "/api/learning-paths/generate", { token: null })).status).toBe(401);
    });
  });
});
