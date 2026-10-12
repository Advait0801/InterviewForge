import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { io as connect, type Socket as ClientSocket } from "socket.io-client";
import { USER_ID, OTHER_USER_ID, type FakeDb } from "./helpers/fake-db";
import { tokenFor } from "./helpers/harness";

/**
 * Two backend instances, one participant on each, through a real Redis (D-078). Set
 * REDIS_TEST_URL to run, e.g. REDIS_TEST_URL=redis://localhost:6380 npx vitest run peer.socket.redis
 * The adapter uses its own channel key, so a live dev backend on the same Redis hears nothing.
 */
const url = process.env.REDIS_TEST_URL;
const db = vi.hoisted(() => ({ handlers: [], calls: [] }) as FakeDb);
vi.mock("../db", async () => (await import("./helpers/fake-db")).fakeDbModule(db));

const SESSION = "11111111-1111-4111-8111-111111111111";
const svc = vi.hoisted(() => ({
  enterRoom: vi.fn(async (_id: string, userId: string) => ({ id: "11111111-1111-4111-8111-111111111111", status: "waiting", myRole: userId === "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" ? "interviewer" : "candidate" })),
  startIfReady: vi.fn(async () => false),
  saveSharedCode: vi.fn(async () => true),
  endSession: vi.fn(async () => ({ session: { status: "completed", endedReason: "ended_by_participant" }, changed: true })),
  sweepExpired: vi.fn(async () => []),
}));
vi.mock("../services/peer.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/peer.service")>()),
  ...svc,
}));

describe.skipIf(!url)("peer rooms across two instances (Redis adapter)", () => {
  const servers: Array<{ server: http.Server; close: () => Promise<void>; url: string }> = [];
  const clients: ClientSocket[] = [];

  beforeAll(async () => {
    const { attachRealtime } = await import("../realtime");
    const key = `peer-test-${process.pid}-${Date.now()}`;
    for (let i = 0; i < 2; i++) {
      const server = http.createServer();
      const { close } = attachRealtime(server, { frontendUrl: "http://localhost:3002", url, adapterKey: key });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      servers.push({ server, close, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/peer` });
    }
  });

  afterAll(async () => {
    clients.forEach((c) => c.disconnect());
    for (const s of servers) {
      await s.close();
      await new Promise<void>((resolve) => s.server.close(() => resolve()));
    }
  });

  const client = (instance: number, userId: string) => {
    const c = connect(servers[instance].url, { auth: { token: tokenFor(userId) }, transports: ["websocket"], forceNew: true, reconnection: false });
    clients.push(c);
    return new Promise<ClientSocket>((resolve) => c.once("connect", () => resolve(c)));
  };
  const once = <T>(c: ClientSocket, event: string) =>
    new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`no ${event}`)), 3000);
      c.once(event, (x: T) => (clearTimeout(t), resolve(x)));
    });

  it("presence, signalling and the end reach a participant on the other instance", async () => {
    const a = await client(0, USER_ID);
    const b = await client(1, OTHER_USER_ID);
    await a.emitWithAck("join", { sessionId: SESSION });
    const seen = (await b.emitWithAck("join", { sessionId: SESSION })) as { presence: unknown };
    // fetchSockets asked both instances: B's instance knows A is there.
    expect(seen.presence).toEqual({ interviewer: true, candidate: true });

    const offer = once(b, "signal");
    a.emit("signal", { type: "offer", sdp: "v=0 across instances" });
    expect(await offer).toEqual({ from: "interviewer", data: { type: "offer", sdp: "v=0 across instances" } });

    const answer = once(a, "signal");
    b.emit("signal", { type: "answer", sdp: "v=0 back" });
    expect(await answer).toMatchObject({ from: "candidate" });

    const ended = once(a, "ended");
    await b.emitWithAck("end");
    expect(await ended).toEqual({ reason: "ended_by_participant" });
  });
});
