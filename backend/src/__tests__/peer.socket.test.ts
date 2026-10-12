import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { io as connect, type Socket as ClientSocket } from "socket.io-client";
import { signAccessToken } from "../auth";
import { USER_ID, OTHER_USER_ID, type FakeDb } from "./helpers/fake-db";
import { tokenFor } from "./helpers/harness";

/**
 * The /peer namespace over real sockets (D-078): a real Socket.IO server and real clients;
 * the service layer is stubbed so each behaviour can be pinned. Auth runs through the real
 * token check against the fake database (USER_ID and OTHER_USER_ID, token version 0).
 */
const db = vi.hoisted(() => ({ handlers: [], calls: [] }) as FakeDb);
vi.mock("../db", async () => (await import("./helpers/fake-db")).fakeDbModule(db));

const SESSION = "11111111-1111-4111-8111-111111111111";
const OTHER_SESSION = "22222222-2222-4222-8222-222222222222";

const svc = vi.hoisted(() => ({
  enterRoom: vi.fn(),
  startIfReady: vi.fn(),
  saveSharedCode: vi.fn(),
  endSession: vi.fn(),
  sweepExpired: vi.fn(),
}));
vi.mock("../services/peer.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/peer.service")>()),
  ...svc,
}));

process.env.PEER_SWEEP_MS = "100";

const roleFor = (userId: string) => (userId === USER_ID ? "interviewer" : "candidate");
const view = (userId: string, status = "waiting") => ({
  id: SESSION,
  status,
  myRole: roleFor(userId),
  startedAt: status === "active" ? "2026-10-11T10:00:00.000Z" : null,
  endsAt: status === "active" ? "2026-10-11T10:45:00.000Z" : null,
  endedReason: status === "completed" ? "ended_by_participant" : null,
});

let server: http.Server;
let url: string;
let close: () => Promise<void>;
const clients: ClientSocket[] = [];

beforeAll(async () => {
  const { attachRealtime } = await import("../realtime");
  server = http.createServer();
  ({ close } = attachRealtime(server, { frontendUrl: "http://localhost:3002", url: null }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/peer`;
});

afterAll(async () => {
  clients.forEach((c) => c.disconnect());
  await close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  clients.splice(0).forEach((c) => c.disconnect());
  db.handlers.length = 0;
  db.calls.length = 0;
  let started = false;
  svc.enterRoom.mockReset().mockImplementation(async (id: string, userId: string) => {
    if (id !== SESSION && id !== OTHER_SESSION) throw new (await import("../services/errors")).DomainError(404, "Peer session not found");
    return { ...view(userId, started ? "active" : "waiting"), id };
  });
  svc.startIfReady.mockReset().mockImplementation(async () => {
    if (started) return false;
    started = true;
    return true;
  });
  svc.saveSharedCode.mockReset().mockResolvedValue(true);
  svc.endSession.mockReset().mockImplementation(async (_id: string, userId: string) => ({ session: view(userId, "completed"), changed: true }));
  svc.sweepExpired.mockReset().mockResolvedValue([]);
});

function client(token: string | null = tokenFor()): ClientSocket {
  const c = connect(url, { auth: token ? { token } : {}, transports: ["websocket"], forceNew: true, reconnection: false });
  clients.push(c);
  return c;
}

const once = <T = unknown>(c: ClientSocket, event: string, ms = 2000) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`no ${event} within ${ms}ms`)), ms);
    c.once(event, (x: T) => {
      clearTimeout(t);
      resolve(x);
    });
  });
const join = (c: ClientSocket, sessionId = SESSION) => c.emitWithAck("join", { sessionId }) as Promise<Record<string, unknown>>;
const connected = (c: ClientSocket) => (c.connected ? Promise.resolve() : once(c, "connect"));
const settle = (ms = 80) => new Promise((r) => setTimeout(r, ms));

/** Collect every `event` a client receives from now on. */
function collect(c: ClientSocket, event: string): unknown[] {
  const got: unknown[] = [];
  c.on(event, (x: unknown) => got.push(x));
  return got;
}

async function pair() {
  const a = client(tokenFor(USER_ID));
  const b = client(tokenFor(OTHER_USER_ID));
  await Promise.all([connected(a), connected(b)]);
  await join(a);
  await join(b);
  await settle();
  return { a, b };
}

describe("connecting", () => {
  it("refuses a connection without a token, or with a revoked one", async () => {
    const none = client(null);
    expect(((await once<Error & { data?: { code: string } }>(none, "connect_error")).data)?.code).toBe("session_invalid");
    const revoked = client(signAccessToken({ userId: USER_ID, tokenVersion: 7 }));
    expect((await once<Error>(revoked, "connect_error")).message).toBe("session_invalid");
  });
});

describe("joining a room", () => {
  it("refuses a malformed id and a session the user isn't in", async () => {
    const a = client();
    await connected(a);
    expect(await join(a, "nope")).toMatchObject({ ok: false, code: "invalid" });
    expect(await join(a, "33333333-3333-4333-8333-333333333333")).toMatchObject({ ok: false, code: "not_found" });
  });

  it("an ended session can't be entered", async () => {
    svc.enterRoom.mockRejectedValueOnce(new (await import("../services/errors")).DomainError(409, "This session has ended"));
    const a = client();
    await connected(a);
    expect(await join(a)).toMatchObject({ ok: false, code: "ended" });
  });

  it("presence as each arrives; the clock starts once, when both are in", async () => {
    const a = client(tokenFor(USER_ID));
    await connected(a);
    const first = await join(a);
    expect(first).toMatchObject({ ok: true, presence: { interviewer: true, candidate: false } });
    const started = once<{ startedAt: string; endsAt: string }>(a, "started");
    const presence = once(a, "presence");
    const b = client(tokenFor(OTHER_USER_ID));
    await connected(b);
    const second = await join(b);
    expect(second).toMatchObject({ ok: true, presence: { interviewer: true, candidate: true }, session: { status: "active" } });
    expect(await presence).toEqual({ interviewer: true, candidate: true });
    expect(await started).toEqual({ startedAt: "2026-10-11T10:00:00.000Z", endsAt: "2026-10-11T10:45:00.000Z" });
    // Rejoining doesn't start it again.
    const again = client(tokenFor(OTHER_USER_ID));
    await connected(again);
    await join(again);
    expect(svc.startIfReady.mock.results.filter((r) => r.type === "return")).toHaveLength(1);
  });

  it("one socket, one session", async () => {
    const { a } = await pair();
    expect(await join(a, OTHER_SESSION)).toMatchObject({ ok: false, code: "invalid" });
  });
});

describe("relaying", () => {
  it("signalling goes to the other participant only, as an allowlisted copy", async () => {
    const { a, b } = await pair();
    const aSecondTab = client(tokenFor(USER_ID));
    await connected(aSecondTab);
    await join(aSecondTab);
    const toA = collect(a, "signal");
    const toTab = collect(aSecondTab, "signal");
    const toB = once(b, "signal");
    a.emit("signal", { type: "offer", sdp: "v=0 offer", extra: "dropped" });
    expect(await toB).toEqual({ from: "interviewer", data: { type: "offer", sdp: "v=0 offer" } });
    await settle();
    expect(toA).toEqual([]);
    expect(toTab).toEqual([]);
    const toA2 = once(a, "signal");
    b.emit("signal", { type: "candidate", candidate: { candidate: "candidate:1 1 udp 2122260223 10.0.0.2 51234 typ host", sdpMid: "0", sdpMLineIndex: 0 } });
    expect(await toA2).toMatchObject({ from: "candidate", data: { type: "candidate", candidate: { sdpMid: "0", sdpMLineIndex: 0, usernameFragment: null } } });
  });

  it("drops what isn't signalling, and says so to the sender only", async () => {
    const { a, b } = await pair();
    const toB = collect(b, "signal");
    for (const bad of [{ type: "offer" }, { type: "shell", cmd: "rm -rf" }, { type: "answer", sdp: "x".repeat(20_001) }, "nope"]) {
      const err = once<{ code: string }>(a, "peer_error");
      a.emit("signal", bad);
      expect((await err).code).toBe("invalid");
    }
    await settle();
    expect(toB).toEqual([]);
  });

  it("nothing is relayed before joining", async () => {
    const lone = client();
    await connected(lone);
    const err = once<{ code: string }>(lone, "peer_error");
    lone.emit("signal", { type: "offer", sdp: "x" });
    expect((await err).code).toBe("not_joined");
  });

  it("rooms are separate: another session hears nothing", async () => {
    const { a } = await pair();
    const elsewhere = client(tokenFor(OTHER_USER_ID));
    await connected(elsewhere);
    await join(elsewhere, OTHER_SESSION);
    const heard = collect(elsewhere, "signal");
    a.emit("signal", { type: "offer", sdp: "v=0" });
    await settle(150);
    expect(heard).toEqual([]);
  });

  it("rate limits a flood, keeps the partner's share bounded, and tells the sender", async () => {
    const { a, b } = await pair();
    const toB = collect(b, "signal");
    const errors = collect(a, "peer_error");
    for (let i = 0; i < 200; i++) a.emit("signal", { type: "offer", sdp: `v=${i}` });
    await settle(300);
    expect(toB.length).toBeGreaterThanOrEqual(60);
    expect(toB.length).toBeLessThan(80);
    expect(errors).toContainEqual({ code: "rate_limited", error: "Too many signal messages; some were dropped" });
  });

  it("shared code reaches the partner and the latest version is saved", async () => {
    const { a, b } = await pair();
    const received = collect(b, "code");
    for (const n of [1, 2, 3]) a.emit("code", { code: `print(${n})`, language: "python3" });
    await settle(150);
    expect(received.at(-1)).toEqual({ from: "interviewer", code: "print(3)", language: "python3" });
    const err = once<{ code: string }>(a, "peer_error");
    a.emit("code", { code: "x", language: "cobol" });
    expect((await err).code).toBe("invalid");
    a.emit("leave");
    await settle(150);
    expect(svc.saveSharedCode).toHaveBeenLastCalledWith(SESSION, "print(3)", "python3");
  });
});

describe("leaving and ending", () => {
  it("the one who stays sees presence change", async () => {
    const { a, b } = await pair();
    const presence = once(a, "presence");
    b.disconnect();
    expect(await presence).toEqual({ interviewer: true, candidate: false });
  });

  it("ending tells both, and saves pending code first", async () => {
    const { a, b } = await pair();
    a.emit("code", { code: "final", language: "go" });
    await settle(30);
    const endedA = once(a, "ended");
    const endedB = once(b, "ended");
    const reply = (await b.emitWithAck("end")) as Record<string, unknown>;
    expect(reply).toMatchObject({ ok: true, session: { status: "completed" } });
    expect(await endedA).toEqual({ reason: "ended_by_participant" });
    expect(await endedB).toEqual({ reason: "ended_by_participant" });
    expect(svc.saveSharedCode).toHaveBeenCalledWith(SESSION, "final", "go");
    expect(svc.endSession).toHaveBeenCalledWith(SESSION, OTHER_USER_ID);
  });

  it("revoking a user's tokens drops their open sockets, and the partner sees them go", async () => {
    const { a, b } = await pair();
    const { disconnectUser } = await import("../realtime/peer.events");
    const gone = once<string>(b, "disconnect");
    const presence = once(a, "presence");
    disconnectUser(OTHER_USER_ID);
    expect(await gone).toBe("io server disconnect");
    expect(await presence).toEqual({ interviewer: true, candidate: false });
    expect(a.connected).toBe(true);
  });

  it("the server's clock ends a session whose time is up, for both", async () => {
    const { a, b } = await pair();
    svc.sweepExpired.mockResolvedValueOnce([{ id: SESSION, ended_reason: "time_up" }]);
    const [ea, eb] = await Promise.all([once(a, "ended", 1000), once(b, "ended", 1000)]);
    expect(ea).toEqual({ reason: "time_up" });
    expect(eb).toEqual({ reason: "time_up" });
  });
});
