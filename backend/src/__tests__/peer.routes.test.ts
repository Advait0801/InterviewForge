import { createHash, createHmac } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { callsMatching, resetDb, serve, tokenFor, USER_ID, type FakeDb, type TestServer } from "./helpers/harness";
import { OTHER_USER_ID } from "./helpers/fake-db";

const db = vi.hoisted(() => ({ handlers: [], calls: [] }) as FakeDb);
vi.mock("../db", async () => (await import("./helpers/fake-db")).fakeDbModule(db));

const THIRD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PROBLEM = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const USERNAMES: Record<string, string> = { [USER_ID]: "alice", [OTHER_USER_ID]: "bob", [THIRD]: "carol" };
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

type Row = Record<string, unknown> & { id: string; host_id: string; guest_id: string | null; status: string; invite_hash: string };
const store = { sessions: new Map<string, Row>(), feedback: [] as Array<Record<string, unknown>>, problemExists: true, seq: 0 };

function viewRow(s: Row) {
  return {
    ...s,
    host_username: USERNAMES[s.host_id],
    guest_username: s.guest_id ? USERNAMES[s.guest_id] : null,
    problem_slug: s.problem_id ? "two-sum" : null,
    problem_title: s.problem_id ? "Two Sum" : null,
    problem_difficulty: s.problem_id ? "easy" : null,
  };
}

function seed(over: Partial<Row> = {}): Row {
  const id = `00000000-0000-4000-8000-${String(++store.seq).padStart(12, "0")}`;
  const row: Row = {
    id,
    host_id: USER_ID,
    guest_id: null,
    host_role: "interviewer",
    problem_id: null,
    duration_minutes: 45,
    status: "waiting",
    created_at: "2026-10-11T10:00:00.000Z",
    started_at: null,
    ends_at: null,
    ended_at: null,
    ended_reason: null,
    code: "",
    language: "python3",
    invite_hash: sha(`token-${id}`),
    ...over,
  };
  store.sessions.set(id, row);
  return row;
}

let api: TestServer;
beforeAll(async () => {
  api = await serve("/api/peer-sessions", (await import("../routes/peer.routes")).default);
});
afterAll(() => api.close());

beforeEach(() => {
  resetDb(db);
  store.sessions.clear();
  store.feedback = [];
  store.problemExists = true;
  db.handlers.push(
    { match: "SELECT 1 FROM problems WHERE id = $1", reply: () => (store.problemExists ? [{ "?column?": 1 }] : []) },
    {
      match: "FROM peer_sessions WHERE host_id = $1 AND status = 'waiting'",
      reply: (p) => [{ n: [...store.sessions.values()].filter((s) => s.host_id === p[0] && s.status === "waiting").length }],
    },
    {
      match: "INSERT INTO peer_sessions",
      reply: (p) => {
        const row = seed({ host_id: p[0] as string, host_role: p[1] as string, problem_id: p[2] as string | null, duration_minutes: p[3] as number, invite_hash: p[4] as string });
        return [{ id: row.id }];
      },
    },
    {
      match: "WHERE ps.invite_hash = $1 FOR UPDATE",
      reply: (p) => [...store.sessions.values()].filter((s) => s.invite_hash === p[0]),
    },
    {
      match: "UPDATE peer_sessions SET guest_id = $2 WHERE id = $1 AND guest_id IS NULL",
      reply: (p) => {
        const s = store.sessions.get(p[0] as string)!;
        if (!s.guest_id) s.guest_id = p[1] as string;
        return [];
      },
    },
    {
      match: "AND (ps.host_id = $2 OR ps.guest_id = $2)",
      reply: (p) => {
        const s = store.sessions.get(p[0] as string);
        return s && (s.host_id === p[1] || s.guest_id === p[1]) ? [viewRow(s)] : [];
      },
    },
    {
      match: "WHERE ps.host_id = $1 OR ps.guest_id = $1",
      reply: (p) => [...store.sessions.values()].filter((s) => s.host_id === p[0] || s.guest_id === p[0]).map(viewRow),
    },
    {
      match: "SET status = $3, ended_at = NOW(), ended_reason = $4",
      reply: (p) => {
        const s = store.sessions.get(p[0] as string);
        if (!s || s.status !== p[1]) return [];
        Object.assign(s, { status: p[2], ended_reason: p[3], ended_at: "2026-10-11T11:00:00.000Z" });
        return [{ id: s.id }];
      },
    },
    { match: "FROM peer_feedback WHERE session_id = $1", reply: (p) => store.feedback.filter((f) => f.session_id === p[0]) },
    {
      match: "INSERT INTO peer_feedback",
      reply: (p) => {
        if (store.feedback.some((f) => f.session_id === p[0] && f.author_id === p[1])) return [];
        store.feedback.push({ session_id: p[0], author_id: p[1], ratings: JSON.parse(p[2] as string), notes: p[3], created_at: "2026-10-11T12:00:00.000Z" });
        return [{ author_id: p[1] }];
      },
    }
  );
});

const as = (userId: string) => ({ token: tokenFor(userId) });
const post = (path: string, body?: unknown, userId = USER_ID) => api.request("POST", `/api/peer-sessions${path}`, { body, ...as(userId) });
const get = (path: string, userId = USER_ID) => api.request("GET", `/api/peer-sessions${path}`, as(userId));

describe("creating a session", () => {
  it("validates role, problemId and duration", async () => {
    expect((await post("", { role: "boss" })).status).toBe(400);
    expect((await post("", { role: "interviewer", problemId: "nope" })).status).toBe(400);
    expect((await post("", { role: "interviewer", durationMinutes: 10 })).status).toBe(400);
    expect((await post("", { role: "interviewer", durationMinutes: 91 })).status).toBe(400);
    expect(callsMatching(db, "INSERT INTO peer_sessions")).toHaveLength(0);
  });

  it("404s on a problem that doesn't exist", async () => {
    store.problemExists = false;
    expect((await post("", { role: "candidate", problemId: PROBLEM })).status).toBe(404);
  });

  it("returns the invite token once and stores only its hash", async () => {
    const r = await post("", { role: "interviewer", problemId: PROBLEM, durationMinutes: 30 });
    expect(r.status).toBe(201);
    expect(r.body.inviteToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const insert = callsMatching(db, "INSERT INTO peer_sessions")[0].params;
    expect(insert).toEqual([USER_ID, "interviewer", PROBLEM, 30, sha(r.body.inviteToken)]);
    expect(JSON.stringify(insert)).not.toContain(r.body.inviteToken);
    expect(r.body.session).toMatchObject({
      status: "waiting",
      myRole: "interviewer",
      isHost: true,
      partner: null,
      problem: { id: PROBLEM, slug: "two-sum", title: "Two Sum", difficulty: "easy" },
      durationMinutes: 30,
      feedback: { given: null, received: null },
    });
  });

  it("caps open invites at 5", async () => {
    for (let i = 0; i < 5; i++) seed();
    const r = await post("", { role: "candidate" });
    expect(r.status).toBe(409);
  });
});

describe("joining", () => {
  async function invite(role = "candidate") {
    return (await post("", { role })).body as { session: { id: string }; inviteToken: string };
  }

  it("the guest takes the other role and sees the host as partner", async () => {
    const { session, inviteToken } = await invite("candidate");
    const r = await post("/join", { token: inviteToken }, OTHER_USER_ID);
    expect(r.status).toBe(200);
    expect(r.body.session).toMatchObject({ id: session.id, myRole: "interviewer", isHost: false, partner: { username: "alice", role: "candidate" } });
    expect(store.sessions.get(session.id)!.guest_id).toBe(OTHER_USER_ID);
  });

  it("is idempotent for the guest and harmless for the host", async () => {
    const { inviteToken } = await invite();
    await post("/join", { token: inviteToken }, OTHER_USER_ID);
    expect((await post("/join", { token: inviteToken }, OTHER_USER_ID)).status).toBe(200);
    expect((await post("/join", { token: inviteToken }, USER_ID)).body.session.isHost).toBe(true);
    expect(callsMatching(db, "SET guest_id")).toHaveLength(1);
  });

  it("a third person can't take a full session", async () => {
    const token = "F".repeat(43);
    seed({ guest_id: THIRD, invite_hash: sha(token) });
    const r = await post("/join", { token }, OTHER_USER_ID);
    expect(r.status).toBe(409);
    expect(callsMatching(db, "SET guest_id")).toHaveLength(0);
  });

  it("an unknown, malformed or closed invite is the same 404", async () => {
    const closedToken = "E".repeat(43);
    seed({ status: "completed", invite_hash: sha(closedToken) });
    const malformed = await post("/join", { token: "short" }, OTHER_USER_ID);
    expect(malformed.status).toBe(404);
    const unknown = await post("/join", { token: "x".repeat(43) }, OTHER_USER_ID);
    const ended = await post("/join", { token: closedToken }, OTHER_USER_ID);
    expect([unknown.status, ended.status]).toEqual([404, 404]);
    expect(new Set([malformed.body.error, unknown.body.error, ended.body.error]).size).toBe(1);
    expect((await post("/join", {}, OTHER_USER_ID)).status).toBe(400);
  });

  it("a closed session's real token is refused too", async () => {
    const token = "C".repeat(43);
    seed({ status: "cancelled", invite_hash: sha(token) });
    expect((await post("/join", { token }, OTHER_USER_ID)).status).toBe(404);
  });
});

describe("reading", () => {
  it("only the two participants see a session; anyone else gets 404", async () => {
    const s = seed({ guest_id: THIRD });
    expect((await get(`/${s.id}`)).status).toBe(200);
    const r = await get(`/${s.id}`, OTHER_USER_ID);
    expect(r.status).toBe(404);
    expect(callsMatching(db, "AND (ps.host_id = $2 OR ps.guest_id = $2)").at(-1)!.params).toEqual([s.id, OTHER_USER_ID]);
    expect((await get("/not-a-uuid")).status).toBe(400);
  });

  it("lists the caller's sessions, as host or guest", async () => {
    seed();
    seed({ host_id: OTHER_USER_ID, guest_id: USER_ID, host_role: "candidate" });
    seed({ host_id: THIRD });
    const r = await get("");
    expect(r.body.sessions.map((s: { isHost: boolean; myRole: string }) => [s.isHost, s.myRole])).toEqual([
      [true, "interviewer"],
      [false, "interviewer"],
    ]);
  });
});

describe("ending", () => {
  it("cancels a waiting session and completes an active one; ending again changes nothing", async () => {
    const waiting = seed();
    expect((await post(`/${waiting.id}/end`)).body.session).toMatchObject({ status: "cancelled", endedReason: "cancelled" });
    const active = seed({ guest_id: OTHER_USER_ID, status: "active", started_at: "2026-10-11T10:00:00.000Z", ends_at: "2026-10-11T10:45:00.000Z" });
    expect((await post(`/${active.id}/end`, undefined, OTHER_USER_ID)).body.session).toMatchObject({ status: "completed", endedReason: "ended_by_participant" });
    const before = callsMatching(db, "SET status = $3").length;
    expect((await post(`/${active.id}/end`)).status).toBe(200);
    expect(callsMatching(db, "SET status = $3")).toHaveLength(before);
  });

  it("404s for a non-participant", async () => {
    const s = seed({ guest_id: THIRD, status: "active" });
    expect((await post(`/${s.id}/end`, undefined, OTHER_USER_ID)).status).toBe(404);
    expect(store.sessions.get(s.id)!.status).toBe("active");
  });
});

describe("feedback", () => {
  const completed = () => seed({ guest_id: OTHER_USER_ID, status: "completed", ended_reason: "time_up" });

  it("opens only once the session has completed", async () => {
    const s = seed({ guest_id: OTHER_USER_ID, status: "active" });
    const r = await post(`/${s.id}/feedback`, { ratings: { problemSolving: 4, communication: 4, codeQuality: 4 } });
    expect(r.status).toBe(400);
  });

  it("each role rates exactly its own keys, 1-5", async () => {
    const s = completed();
    const wrongKeys = await post(`/${s.id}/feedback`, { ratings: { clarity: 4, helpfulness: 4 } }); // the interviewer
    expect(wrongKeys.status).toBe(400);
    const outOfRange = await post(`/${s.id}/feedback`, { ratings: { problemSolving: 6, communication: 4, codeQuality: 4 } });
    expect(outOfRange.status).toBe(400);
    const notInt = await post(`/${s.id}/feedback`, { ratings: { problemSolving: 3.5, communication: 4, codeQuality: 4 } });
    expect(notInt.status).toBe(400);
    expect((await post(`/${s.id}/feedback`, { ratings: [] })).status).toBe(400);
    expect((await post(`/${s.id}/feedback`, { ratings: {}, notes: "x".repeat(2001) })).status).toBe(400);
  });

  it("is given once, and each side then sees the other's", async () => {
    const s = completed();
    const mine = await post(`/${s.id}/feedback`, { ratings: { problemSolving: 4, communication: 5, codeQuality: 3 }, notes: "  Clear thinking.  " });
    expect(mine.status).toBe(200);
    expect(mine.body.session.feedback).toEqual({
      given: { ratings: { problemSolving: 4, communication: 5, codeQuality: 3 }, notes: "Clear thinking.", createdAt: "2026-10-11T12:00:00.000Z" },
      received: null,
    });
    expect((await post(`/${s.id}/feedback`, { ratings: { problemSolving: 1, communication: 1, codeQuality: 1 } })).status).toBe(409);
    const theirs = await post(`/${s.id}/feedback`, { ratings: { clarity: 5, helpfulness: 4 } }, OTHER_USER_ID);
    expect(theirs.body.session.feedback.received.ratings).toEqual({ problemSolving: 4, communication: 5, codeQuality: 3 });
    expect((await get(`/${s.id}`)).body.session.feedback.received.ratings).toEqual({ clarity: 5, helpfulness: 4 });
  });
});

describe("ICE servers", () => {
  const saved = { ...process.env };
  afterEach(() => {
    for (const k of ["STUN_URLS", "TURN_URLS", "TURN_SECRET", "TURN_TTL_SECONDS"]) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("STUN only by default", async () => {
    delete process.env.STUN_URLS;
    delete process.env.TURN_URLS;
    const r = await get("/ice-servers");
    expect(r.body).toEqual({ iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }], expiresAt: null });
  });

  it("TURN credentials that expire, in coturn's shared-secret scheme", async () => {
    process.env.TURN_URLS = "turn:turn.example.com:3478,turns:turn.example.com:5349";
    process.env.TURN_SECRET = "s3cret";
    process.env.TURN_TTL_SECONDS = "600";
    const r = await get("/ice-servers");
    const turn = r.body.iceServers[1];
    const [expiry, user] = turn.username.split(":");
    expect(user).toBe(USER_ID);
    expect(Number(expiry) * 1000 - Date.now()).toBeGreaterThan(590_000);
    expect(turn.credential).toBe(createHmac("sha1", "s3cret").update(turn.username).digest("base64"));
    expect(new Date(r.body.expiresAt).getTime()).toBe(Number(expiry) * 1000);
  });

  it("needs a signed-in user", async () => {
    expect((await api.request("GET", "/api/peer-sessions/ice-servers", { token: null })).status).toBe(401);
  });
});
