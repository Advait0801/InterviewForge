/**
 * Group D, Phase 13 verification: peer mock interviews, live (D-078).
 *
 *   cd backend && npx ts-node scripts/verify_peer.ts
 *
 * Against the running stack (migration 021 applied). No model calls. Registers four throwaway
 * users: two participants, an outsider, and one whose sessions are revoked mid-way. Uses the
 * real HTTP API and real Socket.IO connections; moves a session's clock in Postgres to test
 * the server-side timer (the sweep runs every PEER_SWEEP_MS, 15 s by default).
 *
 * Checks: invite and join (one seat, same 404 for every bad invite, outsiders see nothing);
 * room auth (no token, a revoked token, an outsider); presence and the clock starting once;
 * signalling relayed to the partner only, as an allowlisted copy; shared code relayed and
 * saved; ending tells both; the timer ends an overdue session and expires an unused invite;
 * feedback once each, the partner's shown only after the end; ICE servers; no
 * openapi_violation in the backend log.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { io, type Socket } from "socket.io-client";

const API = process.env.BACKEND_URL ?? "http://localhost:4000";
const ROOT = `${__dirname}/../..`;
const passes: string[] = [];
const fails: string[] = [];

function check(name: string, ok: unknown, detail?: unknown) {
  (ok ? passes : fails).push(name);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail !== undefined ? ` -- ${JSON.stringify(detail).slice(0, 220)}` : ""}`);
}

async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, any> };
}

async function register(tag: string) {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 10);
  const r = await call("POST", "/auth/register", undefined, { email: `p13${tag}-${suffix}@example.com`, password: "Str0ngPassw0rd!", username: `p13${tag}${suffix}` });
  if (r.status !== 201) throw new Error(`register failed: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.token as string;
}

const psql = (sql: string) =>
  execFileSync("docker", ["compose", "exec", "-T", "postgres", "psql", "-U", "postgres", "-d", "interviewforge", "-At", "-c", sql], { cwd: ROOT }).toString().trim();

function socketFor(token: string | null): Socket {
  return io(`${API}/peer`, { auth: token ? { token } : {}, transports: ["websocket"], forceNew: true, reconnection: false });
}
const wait = <T = any>(s: Socket, event: string, ms = 5000) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`no ${event} within ${ms} ms`)), ms);
    s.once(event, (x: T) => {
      clearTimeout(t);
      resolve(x);
    });
  });
const connected = (s: Socket) => (s.connected ? Promise.resolve() : wait(s, "connect"));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const started = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const [alice, bob, eve] = [await register("a"), await register("b"), await register("e")];
  const problems = (await call("GET", "/problems", alice)).body.problems as Array<{ id: string; slug: string }>;
  const twoSum = problems.find((p) => p.slug === "two-sum")!;

  console.log("1. Invite and join");
  const created = await call("POST", "/peer-sessions", alice, { role: "interviewer", problemId: twoSum.id, durationMinutes: 15 });
  check("alice hosts as interviewer", created.status === 201 && created.body.session.myRole === "interviewer", created.body.session?.status);
  const { inviteToken } = created.body;
  const id = created.body.session.id as string;
  check("only the invite's hash is stored", psql(`SELECT invite_hash <> '${inviteToken}' AND length(invite_hash) = 64 FROM peer_sessions WHERE id = '${id}'`) === "t");
  const joined = await call("POST", "/peer-sessions/join", bob, { token: inviteToken });
  check("bob joins as candidate, alice is his partner", joined.status === 200 && joined.body.session.myRole === "candidate" && joined.body.session.partner?.role === "interviewer", joined.body.session?.partner);
  check("eve can't take the seat", (await call("POST", "/peer-sessions/join", eve, { token: inviteToken })).status === 409);
  const bad = await Promise.all(["nope", "x".repeat(43)].map((token) => call("POST", "/peer-sessions/join", eve, { token })));
  check("every bad invite is the same 404", bad.every((r) => r.status === 404) && bad[0].body.error === bad[1].body.error);
  check("eve can't see the session", (await call("GET", `/peer-sessions/${id}`, eve)).status === 404);

  console.log("2. Room auth");
  const anon = socketFor(null);
  check("no token: refused", ((await wait<any>(anon, "connect_error")).data?.code) === "session_invalid");
  anon.close();
  const eveSocket = socketFor(eve);
  await connected(eveSocket);
  check("an outsider can't enter the room", ((await eveSocket.emitWithAck("join", { sessionId: id })) as any).code === "not_found");

  console.log("3. Presence, the clock, signalling");
  const a = socketFor(alice);
  const b = socketFor(bob);
  await Promise.all([connected(a), connected(b)]);
  const aJoin = (await a.emitWithAck("join", { sessionId: id })) as any;
  check("alice in, waiting for bob", aJoin.ok && aJoin.presence.candidate === false && aJoin.session.status === "waiting");
  const startedEvt = wait(a, "started");
  const bJoin = (await b.emitWithAck("join", { sessionId: id })) as any;
  const clock = await startedEvt;
  check("bob in: the clock starts, ending 15 minutes later", bJoin.session.status === "active" && Date.parse(clock.endsAt) - Date.parse(clock.startedAt) === 15 * 60_000, clock);

  const heardByAlice: unknown[] = [];
  a.on("signal", (x) => heardByAlice.push(x));
  const offer = wait(b, "signal");
  a.emit("signal", { type: "offer", sdp: "v=0\r\no=- 1 2 IN IP4 127.0.0.1", secret: "never relayed" });
  check("bob gets alice's offer, allowlisted", JSON.stringify(await offer) === JSON.stringify({ from: "interviewer", data: { type: "offer", sdp: "v=0\r\no=- 1 2 IN IP4 127.0.0.1" } }));
  await sleep(200);
  check("alice doesn't hear her own offer", heardByAlice.length === 0);
  const err = wait(b, "peer_error");
  b.emit("signal", { type: "exec", cmd: "whoami" });
  check("a non-signalling message is refused", (await err).code === "invalid");

  console.log("4. Shared code");
  const codeEvt = wait(a, "code");
  b.emit("code", { code: "def two_sum(nums, target):\n    pass\n", language: "python3" });
  check("alice sees bob's code", (await codeEvt).from === "candidate");
  await sleep(2_500);
  check("the latest code is saved", psql(`SELECT code FROM peer_sessions WHERE id = '${id}'`).includes("def two_sum"));

  console.log("5. Revocation reaches the room");
  const mallory = await register("m");
  const m = socketFor(mallory);
  await connected(m);
  const dropped = wait<string>(m, "disconnect");
  await call("POST", "/auth/logout-all", mallory);
  check("signing out everywhere drops an open connection", (await dropped) === "io server disconnect");
  const revoked = socketFor(mallory);
  check("a revoked token can't open a new connection", ((await wait<any>(revoked, "connect_error")).data?.code) === "session_invalid");
  m.close();
  revoked.close();

  console.log("6. Ending and feedback");
  check("feedback is closed while live", (await call("POST", `/peer-sessions/${id}/feedback`, alice, { ratings: { problemSolving: 4, communication: 4, codeQuality: 4 } })).status === 400);
  const endedA = wait(a, "ended");
  const endedB = wait(b, "ended");
  const endReply = (await b.emitWithAck("end")) as any;
  check("bob ends it; both are told", endReply.ok && (await endedA).reason === "ended_by_participant" && (await endedB).reason === "ended_by_participant");
  const fa = await call("POST", `/peer-sessions/${id}/feedback`, alice, { ratings: { problemSolving: 4, communication: 5, codeQuality: 3 }, notes: "Good structure." });
  check("alice rates bob", fa.status === 200 && fa.body.session.feedback.received === null);
  check("not twice", (await call("POST", `/peer-sessions/${id}/feedback`, alice, { ratings: { problemSolving: 1, communication: 1, codeQuality: 1 } })).status === 409);
  const fb = await call("POST", `/peer-sessions/${id}/feedback`, bob, { ratings: { clarity: 5, helpfulness: 4 } });
  check("bob rates alice and sees her feedback", fb.status === 200 && fb.body.session.feedback.received?.notes === "Good structure.");
  const rejoin = (await a.emitWithAck("join", { sessionId: id })) as any;
  check("the room can't be entered after the end", rejoin.ok === false && rejoin.code === "ended", rejoin);

  console.log("7. The server's clock");
  const second = await call("POST", "/peer-sessions", bob, { role: "candidate", durationMinutes: 15 });
  const id2 = second.body.session.id as string;
  await call("POST", "/peer-sessions/join", alice, { token: second.body.inviteToken });
  const a2 = socketFor(alice);
  const b2 = socketFor(bob);
  await Promise.all([connected(a2), connected(b2)]);
  await a2.emitWithAck("join", { sessionId: id2 });
  await b2.emitWithAck("join", { sessionId: id2 });
  psql(`UPDATE peer_sessions SET ends_at = NOW() - INTERVAL '1 second' WHERE id = '${id2}'`);
  const [t1, t2] = await Promise.all([wait(a2, "ended", 20_000), wait(b2, "ended", 20_000)]);
  check("an overdue session is ended by the server, for both", t1.reason === "time_up" && t2.reason === "time_up");
  check("and recorded as completed at its end time", psql(`SELECT status || '/' || ended_reason || '/' || (ended_at = ends_at) FROM peer_sessions WHERE id = '${id2}'`) === "completed/time_up/true");
  const stale = await call("POST", "/peer-sessions", eve, { role: "interviewer" });
  psql(`UPDATE peer_sessions SET created_at = NOW() - INTERVAL '25 hours' WHERE id = '${stale.body.session.id}'`);
  await sleep(16_000);
  check("an invite unused for a day expires", (await call("GET", `/peer-sessions/${stale.body.session.id}`, eve)).body.session.endedReason === "expired");
  check("and can't be joined", (await call("POST", "/peer-sessions/join", alice, { token: stale.body.inviteToken })).status === 404);

  console.log("8. ICE servers and contract");
  const ice = await call("GET", "/peer-sessions/ice-servers", alice);
  check("STUN is offered", ice.status === 200 && ice.body.iceServers[0]?.urls?.length > 0, ice.body);
  const logs = execFileSync("docker", ["compose", "logs", "--since", started, "backend"], { cwd: ROOT }).toString();
  check("no openapi_violation in the backend log", !logs.includes("openapi_violation"));

  for (const s of [a, b, a2, b2, eveSocket]) s.close();
}

main()
  .catch((err) => {
    fails.push(`crashed: ${(err as Error).message}`);
    console.error(err);
  })
  .finally(() => {
    console.log(`\n${passes.length} passed, ${fails.length} failed`);
    if (fails.length) console.log(`FAILED: ${fails.join("; ")}`);
    process.exit(fails.length ? 1 : 0);
  });
