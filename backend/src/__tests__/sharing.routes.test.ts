/**
 * Replay and public share links (Group C, Phase 9, D-071).
 *
 * The privacy test is a canary test: every private field of a seeded session -- résumé
 * evidence, retrieved context, live-fetch URLs, agent rationale, challenge evidence, model
 * output's unknown keys, a message kind the replay doesn't know -- carries the string CANARY,
 * and no response may contain it, nor any id. Adding a private field later without touching the
 * allowlist keeps it out; this test is what notices if someone widens the allowlist carelessly.
 */
import { createHash } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { OTHER_USER_ID, USER_ID, callsMatching, resetDb, serve, tokenFor, type FakeDb, type TestServer } from "./helpers/harness";

const db = vi.hoisted(() => ({ handlers: [], calls: [] }) as FakeDb);
vi.mock("../db", async () => (await import("./helpers/fake-db")).fakeDbModule(db));

// Opening a link must never generate anything: every ai-service call fails the test.
const ai = vi.hoisted(() => ({ calls: 0 }));
vi.mock("../services/ai.service", async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>();
  return Object.fromEntries(
    Object.entries(real).map(([k, v]) => [k, typeof v === "function" && /^[a-z]/.test(k) ? (() => { ai.calls++; throw new Error(`model call ${k}`); }) : v])
  );
});

const SESSION = "5e550000-0000-4000-8000-000000000001";
const LINK = "11110000-0000-4000-8000-000000000001";
const START = "2026-10-05T09:00:00.000Z";
const at = (seconds: number) => new Date(Date.parse(START) + seconds * 1000).toISOString();
const CANARY = "CANARY";

const session = (overrides: Record<string, unknown> = {}) => ({
  id: SESSION,
  user_id: USER_ID,
  company: "google",
  current_stage: "core_cs",
  status: "completed",
  stage_turn_count: 2,
  resume_grounded: true,
  persona: "friendly",
  mode: "agent",
  llm_calls: 23,
  llm_cost_usd: 0.0041,
  report_json: {
    overallScore: 7,
    stageScores: {
      behavioral: { score: 8, feedback: "Clear STAR structure.", internal: `${CANARY}-stage-extra` },
      [`${CANARY}-stage`]: { score: 1, feedback: `${CANARY}-not-a-stage` },
    },
    strengths: ["Communicates well"],
    weaknesses: ["Rushed the design"],
    recommendations: ["Practise capacity estimates"],
    graderNotes: `${CANARY}-report-extra`,
  },
  created_at: START,
  updated_at: at(900),
  ...overrides,
});

const messages = [
  {
    id: "m1", session_id: SESSION, role: "assistant", stage: "behavioral", created_at: at(0),
    content: "Tell me about a project you led.",
    metadata_json: {
      kind: "question", company: "google", stage: "behavioral", reasoningFocus: `${CANARY}-focus`,
      expectedCompetencies: [`${CANARY}-competency`], context: `${CANARY}-retrieved-context`,
      resumeGrounded: true, groundedIn: `${CANARY}-grounded-in`,
      resumeEvidence: [{ section: "experience", excerpt: `${CANARY}-resume-excerpt`, distance: 0.2 }],
      retrievalConfidence: { confident: true, reason: `${CANARY}-confidence`, top_distance: 0.1, good_hits: 3, company_matched: true },
      liveIngestion: { triggered: true, reason: "thin", urls_considered: [`https://${CANARY}.example.com`] },
      agent: { decided: "advance", rationale: `${CANARY}-agent-rationale`, steps: 2, searches: 1 },
    },
  },
  { id: "m2", session_id: SESSION, role: "candidate", stage: "behavioral", created_at: at(95), content: "I led the payments migration.", metadata_json: { kind: "answer" } },
  {
    id: "m3", session_id: SESSION, role: "system", stage: "behavioral", created_at: at(100),
    content: `${CANARY}-evaluation-content`,
    metadata_json: {
      kind: "evaluation", score: 6, rawScore: 7, hintsUsed: 1, hintPenalty: 1,
      strengths: ["Concrete"], weaknesses: ["No metrics"], suggestions: ["Quantify impact"],
      shouldAskFollowup: true, followupFocus: `${CANARY}-followup-focus`, modelReasoning: `${CANARY}-eval-extra`,
    },
  },
  {
    id: "m4", session_id: SESSION, role: "assistant", stage: "behavioral", created_at: at(110),
    content: "You said it took a week; the design doc says a quarter. Which was it?",
    metadata_json: { kind: "followup", focus: `${CANARY}-fu-focus`, reason: `${CANARY}-fu-reason`, challenge: { claim: `${CANARY}-claim`, evidence: `${CANARY}-evidence` } },
  },
  { id: "m5", session_id: SESSION, role: "assistant", stage: "behavioral", created_at: at(130), content: "Think about the rollout plan.", metadata_json: { kind: "hint", level: 1, penalty: 1 } },
  { id: "m6", session_id: SESSION, role: "system", stage: "behavioral", created_at: at(140), content: `${CANARY}-unknown-kind`, metadata_json: { kind: "audit", note: `${CANARY}-audit` } },
];

let links: Map<string, { revoked: boolean }>;
let interviewsApi: TestServer;
let publicApi: TestServer;

beforeAll(async () => {
  interviewsApi = await serve("/api/interviews", (await import("../routes/interviews.routes")).default);
  publicApi = await serve("/api/public", (await import("../routes/public.routes")).default);
});
afterAll(async () => {
  await Promise.all([interviewsApi.close(), publicApi.close()]);
});

beforeEach(() => {
  resetDb(db);
  ai.calls = 0;
  links = new Map();
  const row = session();
  db.handlers.push(
    { match: "FROM interview_sessions WHERE id = $1 AND user_id = $2", reply: (p) => (p[0] === SESSION && p[1] === USER_ID ? [row] : []) },
    { match: "FROM interview_messages WHERE session_id = $1", reply: (p) => (p[0] === SESSION ? messages : []) },
    {
      match: "UPDATE interview_share_links l SET view_count",
      reply: (p) => {
        const link = links.get(p[0] as string);
        return link && !link.revoked ? [{ link_id: LINK, display_name: "Ada L.", session_id: SESSION, ...row }] : [];
      },
    },
    { match: "FROM interview_share_links WHERE session_id = $1 AND user_id = $2", reply: () => [...links.values()].filter((l) => !l.revoked).map(() => linkRow()) },
    {
      match: "INSERT INTO interview_share_links",
      reply: (p) => {
        links.set(p[2] as string, { revoked: false });
        return [linkRow()];
      },
    },
    {
      match: "UPDATE interview_share_links SET revoked_at",
      reply: (p) => {
        if (p[0] !== LINK || p[2] !== USER_ID) return { rows: [], rowCount: 0 };
        for (const l of links.values()) l.revoked = true;
        return { rows: [], rowCount: 1 };
      },
    }
  );
});

const linkRow = () => ({
  id: LINK, token_hint: "abcd", display_name: "Ada L.", expires_at: null, view_count: 0, last_viewed_at: null, created_at: at(1000),
});

function expectNothingPrivate(body: unknown) {
  const text = JSON.stringify(body);
  expect(text).not.toContain(CANARY);
  for (const id of [SESSION, USER_ID, LINK, "m1", "m3"]) expect(text).not.toContain(`"${id}"`);
  expect(text).not.toContain("0.0041"); // cost
  expect(text).not.toContain("T09:"); // absolute times; only the date and offsets
}

async function share(body: Record<string, unknown> = {}) {
  const r = await interviewsApi.request("POST", `/api/interviews/${SESSION}/share`, { body });
  return r;
}

describe("GET /api/interviews/:id/replay", () => {
  it("a timeline with offsets, through the allowlist: nothing private", async () => {
    const r = await interviewsApi.request("GET", `/api/interviews/${SESSION}/replay`);
    expect(r.status).toBe(200);
    expectNothingPrivate(r.body);
    expect(r.body).toMatchObject({ company: "google", persona: "friendly", mode: "agent", status: "completed", date: "2026-10-05", durationSeconds: 130, stages: ["behavioral"] });
    expect(r.body.events.map((e: { type: string; offsetSeconds: number }) => [e.type, e.offsetSeconds])).toEqual([
      ["question", 0], ["answer", 95], ["evaluation", 100], ["followup", 110], ["hint", 130],
    ]);
    expect(r.body.events[2].evaluation).toEqual({ score: 6, rawScore: 7, hintsUsed: 1, hintPenalty: 1, strengths: ["Concrete"], weaknesses: ["No metrics"], suggestions: ["Quantify impact"] });
    expect(r.body.events[3]).toMatchObject({ type: "followup", pushback: true });
    expect(r.body.report).toEqual({
      overallScore: 7,
      stageScores: { behavioral: { score: 8, feedback: "Clear STAR structure." } },
      strengths: ["Communicates well"], weaknesses: ["Rushed the design"], recommendations: ["Practise capacity estimates"],
    });
  });

  it("404 for someone else's session", async () => {
    expect((await interviewsApi.request("GET", `/api/interviews/${SESSION}/replay`, { token: tokenFor(OTHER_USER_ID) })).status).toBe(404);
  });
});

describe("share links", () => {
  it("201: a 256-bit token, shown once; only its SHA-256 reaches the database", async () => {
    const r = await share({ displayName: "Ada L.", expiresInDays: 30 });
    expect(r.status).toBe(201);
    expect(r.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(r.body.resumeGrounded).toBe(true);
    const insert = callsMatching(db, "INSERT INTO interview_share_links")[0];
    expect(insert.params[2]).toBe(createHash("sha256").update(r.body.token).digest("hex"));
    expect(insert.params[3]).toBe(r.body.token.slice(-4));
    for (const c of db.calls) expect(JSON.stringify(c.params)).not.toContain(r.body.token);
  });

  it("two links never share a token", async () => {
    const a = await share();
    const b = await share();
    expect(a.body.token).not.toBe(b.body.token);
  });

  it.each([
    ["an unfinished interview", { status: "active" }],
    ["one without a stored report", { report_json: null }],
  ])("409 report_not_ready for %s -- sharing never generates the report", async (_label, overrides) => {
    db.handlers.unshift({ match: "FROM interview_sessions WHERE id = $1 AND user_id = $2", reply: [session(overrides)] });
    const r = await share();
    expect(r).toMatchObject({ status: 409, body: { code: "report_not_ready" } });
    expect(ai.calls).toBe(0);
  });

  it("409 too_many_links past 5 active links", async () => {
    for (let i = 0; i < 5; i++) links.set(`h${i}`, { revoked: false });
    expect(await share()).toMatchObject({ status: 409, body: { code: "too_many_links" } });
  });

  it.each([
    ["an empty name", { displayName: "  " }],
    ["a long name", { displayName: "x".repeat(61) }],
    ["a zero expiry", { expiresInDays: 0 }],
    ["a fractional expiry", { expiresInDays: 1.5 }],
  ])("400 for %s", async (_label, body) => {
    expect((await share(body)).status).toBe(400);
  });

  it("someone else's session: 404, nothing created", async () => {
    const r = await interviewsApi.request("POST", `/api/interviews/${SESSION}/share`, { body: {}, token: tokenFor(OTHER_USER_ID) });
    expect(r.status).toBe(404);
    expect(callsMatching(db, "INSERT INTO interview_share_links")).toHaveLength(0);
  });

  it("listing shows link metadata, never a token or hash", async () => {
    await share();
    const r = await interviewsApi.request("GET", `/api/interviews/${SESSION}/share`);
    expect(r.body.links).toEqual([linkRow()].map((l) => ({
      id: l.id, tokenHint: "abcd", displayName: "Ada L.", expiresAt: null, viewCount: 0, lastViewedAt: null, createdAt: l.created_at,
    })));
  });
});

describe("GET /api/public/interviews/:token", () => {
  it("anyone with the link sees the replay, exactly the owner's preview, with no-store/noindex headers", async () => {
    const { body: created } = await share();
    const res = await fetch(`${publicApi.url}/api/public/interviews/${created.token}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    const body = await res.json();
    expectNothingPrivate(body);
    const preview = await interviewsApi.request("GET", `/api/interviews/${SESSION}/replay`);
    expect(body).toEqual({ candidate: "Ada L.", ...preview.body });
    expect(ai.calls).toBe(0);
  });

  it("is the same for a signed-in viewer: the token alone decides", async () => {
    const { body: created } = await share();
    const anon = await publicApi.request("GET", `/api/public/interviews/${created.token}`, { token: null });
    const other = await publicApi.request("GET", `/api/public/interviews/${created.token}`, { token: tokenFor(OTHER_USER_ID) });
    expect(other.body).toEqual(anon.body);
  });

  it("unknown, malformed and revoked tokens get the same 404", async () => {
    const { body: created } = await share();
    const unknown = await publicApi.request("GET", `/api/public/interviews/${"A".repeat(43)}`, { token: null });
    const malformed = await publicApi.request("GET", "/api/public/interviews/short", { token: null });
    expect((await interviewsApi.request("DELETE", `/api/interviews/${SESSION}/share/${LINK}`)).status).toBe(200);
    const revoked = await publicApi.request("GET", `/api/public/interviews/${created.token}`, { token: null });
    for (const r of [unknown, malformed, revoked]) {
      expect(r.status).toBe(404);
      expect(r.body).toEqual(unknown.body);
    }
    // A malformed token is rejected before the database is asked.
    expect(callsMatching(db, "UPDATE interview_share_links l SET view_count").filter((c) => (c.params[0] as string).length !== 64)).toHaveLength(0);
  });

  it("revoking someone else's link is a 404 and revokes nothing", async () => {
    await share();
    const r = await interviewsApi.request("DELETE", `/api/interviews/${SESSION}/share/${LINK}`, { token: tokenFor(OTHER_USER_ID) });
    expect(r.status).toBe(404);
    expect([...links.values()].every((l) => !l.revoked)).toBe(true);
  });
});
