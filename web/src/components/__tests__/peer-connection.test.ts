import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { io } from "socket.io-client";
import { PeerRoomConnection } from "@/lib/peer-room";
import { peerSession } from "@/test/group-d-fixtures";
import {
  installPeerMocks,
  MockPeer,
  MockSocket,
  MockStream,
  MockTrack,
} from "@/test/peer-mocks";
vi.mock("socket.io-client", () => ({ io: vi.fn() }));
let socket: MockSocket;
let engine: PeerRoomConnection;
let getUserMedia: ReturnType<typeof installPeerMocks>;
let requests: Request[];
const observer = {
  session: vi.fn(),
  presence: vi.fn(),
  status: vi.fn(),
  notice: vi.fn(),
  error: vi.fn(),
  ended: vi.fn(),
  code: vi.fn(),
  streams: vi.fn(),
  login: vi.fn(),
};
async function settle() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}
function start(role: "interviewer" | "candidate" = "interviewer") {
  const session = { ...peerSession, myRole: role };
  socket.joinAck = {
    ok: true,
    session,
    presence: {
      interviewer: role === "interviewer",
      candidate: role === "candidate",
    },
  };
  engine = new PeerRoomConnection(session, observer);
  engine.start();
}
beforeEach(() => {
  vi.clearAllMocks();
  requests = [];
  socket = new MockSocket();
  vi.mocked(io).mockReturnValue(socket as unknown as ReturnType<typeof io>);
  localStorage.setItem("if-token", "test-token");
  getUserMedia = installPeerMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      requests.push(request);
      return new Response(
        JSON.stringify({
          iceServers: [{ urls: ["stun:example.org"] }],
          expiresAt: null,
        }),
      );
    }),
  );
});
afterEach(() => {
  engine?.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("peer transport and perfect negotiation", () => {
  it("joins the documented namespace with current auth and never asks for media", () => {
    start();
    expect(io).toHaveBeenCalledWith("http://localhost:4000/peer", {
      auth: { token: "test-token" },
      autoConnect: false,
    });
    expect(socket.emit).toHaveBeenCalledWith(
      "join",
      { sessionId: "peer-id" },
      expect.any(Function),
    );
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(observer.code).toHaveBeenCalledWith("# Shared code", "python3");
    expect(observer.status).toHaveBeenLastCalledWith(
      "waiting for your partner",
    );
  });
  it.each(["invalid", "not_found", "ended", "unavailable"])(
    "reports %s join failures",
    (code) => {
      socket.joinAck = { ok: false, code, error: "Join rejected" };
      engine = new PeerRoomConnection(peerSession, observer);
      engine.start();
      expect(observer.error).toHaveBeenCalledWith(
        expect.stringContaining("Join rejected"),
      );
      expect(observer.status).toHaveBeenLastCalledWith("couldn't connect");
      expect(MockPeer.instances).toHaveLength(0);
    },
  );
  it("times out a join with a recovery message", () => {
    socket.ackError = new Error("timeout");
    start();
    expect(observer.error).toHaveBeenCalledWith(
      expect.stringContaining("timed out"),
    );
  });
  it("handles presence before a guest interviewer's join acknowledgement", async () => {
    const original = socket.timeout;
    socket.timeout = vi.fn(() => ({
      emit: (event: string, ...args: unknown[]) => {
        if (event === "join")
          socket.fire("presence", { interviewer: true, candidate: true });
        original().emit(event, ...args);
      },
    }));
    socket.joinAck = {
      ok: true,
      session: peerSession,
      presence: { interviewer: true, candidate: true },
    };
    engine = new PeerRoomConnection(peerSession, observer);
    engine.start();
    await settle();
    expect(MockPeer.instances[0].createDataChannel).toHaveBeenCalledOnce();
    expect(socket.emit).toHaveBeenCalledWith("signal", {
      type: "offer",
      sdp: "offer-sdp",
    });
  });
  it("creates an offer with no media, accepts an answer and relays serialized ICE", async () => {
    start();
    socket.fire("presence", { interviewer: true, candidate: true });
    await settle();
    const pc = MockPeer.instances[0];
    expect(pc.config.iceServers).toEqual([{ urls: ["stun:example.org"] }]);
    expect(socket.emit).toHaveBeenCalledWith("signal", {
      type: "offer",
      sdp: "offer-sdp",
    });
    socket.fire("signal", {
      from: "partner",
      data: { type: "answer", sdp: "remote-answer" },
    });
    await settle();
    expect(pc.setRemoteDescription).toHaveBeenCalledWith({
      type: "answer",
      sdp: "remote-answer",
    });
    const candidate = { candidate: "local-ice", sdpMid: "0" };
    pc.onicecandidate?.({ candidate: { toJSON: () => candidate } });
    expect(socket.emit).toHaveBeenCalledWith("signal", {
      type: "candidate",
      candidate,
    });
  });
  it("queues candidates until an offer arrives, then answers and flushes them", async () => {
    start("candidate");
    const candidate = { candidate: "early-ice", sdpMid: "0" };
    socket.fire("signal", {
      from: "partner",
      data: { type: "candidate", candidate },
    });
    await settle();
    const pc = MockPeer.instances[0];
    expect(pc.addIceCandidate).not.toHaveBeenCalled();
    socket.fire("signal", {
      from: "partner",
      data: { type: "offer", sdp: "remote-offer" },
    });
    await settle();
    expect(pc.setRemoteDescription).toHaveBeenCalledWith({
      type: "offer",
      sdp: "remote-offer",
    });
    expect(pc.addIceCandidate).toHaveBeenCalledWith(candidate);
    expect(socket.emit).toHaveBeenCalledWith("signal", {
      type: "answer",
      sdp: "answer-sdp",
    });
    socket.fire("signal", {
      from: "partner",
      data: { type: "candidate", candidate: { candidate: "late-ice" } },
    });
    await settle();
    expect(pc.addIceCandidate).toHaveBeenCalledTimes(2);
  });
  it.each(["candidate", "interviewer"] as const)(
    "handles offer collisions as %s",
    async (role) => {
      start(role);
      socket.fire("signal", {
        from: "partner",
        data: { type: "candidate", candidate: { candidate: "queued" } },
      });
      await settle();
      const pc = MockPeer.instances[0];
      pc.signalingState = "have-local-offer";
      socket.fire("signal", {
        from: "partner",
        data: { type: "offer", sdp: "colliding" },
      });
      await settle();
      if (role === "candidate") {
        expect(pc.setRemoteDescription).toHaveBeenCalledWith({
          type: "offer",
          sdp: "colliding",
        });
        expect(socket.emit).toHaveBeenCalledWith("signal", {
          type: "answer",
          sdp: "answer-sdp",
        });
      } else {
        expect(pc.setRemoteDescription).not.toHaveBeenCalled();
        socket.fire("signal", {
          from: "partner",
          data: { type: "candidate", candidate: { candidate: "ignored" } },
        });
        await settle();
        expect(pc.addIceCandidate).not.toHaveBeenCalled();
      }
    },
  );
  it("renegotiates when media is added later", async () => {
    start();
    socket.fire("presence", { interviewer: true, candidate: true });
    await settle();
    socket.fire("signal", {
      from: "partner",
      data: { type: "answer", sdp: "remote-answer" },
    });
    await settle();
    socket.emit.mockClear();
    await engine.enableMedia("audio");
    await settle();
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
    expect(MockPeer.instances[0].addTrack).toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith("signal", {
      type: "offer",
      sdp: "offer-sdp",
    });
  });
  it("rejoins on reconnect and swaps a changed token after a server disconnect", () => {
    start();
    socket.fire("disconnect", "transport close");
    socket.fire("connect");
    expect(
      socket.emit.mock.calls.filter(([event]) => event === "join"),
    ).toHaveLength(2);
    localStorage.setItem("if-token", "new-token");
    socket.fire("disconnect", "io server disconnect");
    expect(socket.auth).toEqual({ token: "new-token" });
    expect(socket.connect).toHaveBeenCalledTimes(2);
  });
  it("reconnects with a new token after session_invalid; a rejected current token goes to login", () => {
    start();
    localStorage.setItem("if-token", "new-token");
    socket.fire("connect_error", { data: { code: "session_invalid" } });
    expect(socket.auth).toEqual({ token: "new-token" });
    socket.fire("connect_error", { data: { code: "session_invalid" } });
    expect(observer.login).toHaveBeenCalledOnce();
  });
  it("goes to login when a server disconnect has no current token", () => {
    start();
    localStorage.clear();
    socket.fire("disconnect", "io server disconnect");
    expect(observer.login).toHaveBeenCalledOnce();
  });
  it("retains shared code when ICE fetching fails", async () => {
    start();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response('{"error":"ICE unavailable"}', { status: 503 }),
      ),
    );
    socket.fire("presence", { interviewer: true, candidate: true });
    await settle();
    expect(observer.error).toHaveBeenCalledWith("ICE unavailable");
    socket.fire("code", {
      from: "partner",
      code: "print(1)",
      language: "python3",
    });
    expect(observer.code).toHaveBeenLastCalledWith("print(1)", "python3");
  });
  it("refreshes expiring ICE credentials and updates the connection configuration", async () => {
    vi.useFakeTimers();
    const now = Date.now();
    let count = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: Request) => {
        requests.push(request);
        count++;
        return new Response(
          JSON.stringify({
            iceServers: [
              { urls: [`turn:relay-${count}`], username: "u", credential: "p" },
            ],
            expiresAt: count === 1 ? new Date(now + 2000).toISOString() : null,
          }),
        );
      }),
    );
    start();
    socket.fire("presence", { interviewer: true, candidate: true });
    await settle();
    await vi.advanceTimersByTimeAsync(2001);
    await settle();
    expect(count).toBe(2);
    expect(MockPeer.instances[0].setConfiguration).toHaveBeenCalledWith({
      iceServers: [{ urls: ["turn:relay-2"], username: "u", credential: "p" }],
    });
    engine.dispose();
    await vi.advanceTimersByTimeAsync(60000);
    expect(count).toBe(2);
  });
  it("debounces local code, accepts remote writes and discards pending older edits", async () => {
    vi.useFakeTimers();
    start();
    engine.sendCode("old", "python3");
    engine.sendCode("latest", "rust");
    await vi.advanceTimersByTimeAsync(299);
    expect(socket.emit.mock.calls.filter(([e]) => e === "code")).toHaveLength(
      0,
    );
    await vi.advanceTimersByTimeAsync(1);
    expect(socket.emit).toHaveBeenCalledWith("code", {
      code: "latest",
      language: "rust",
    });
    engine.sendCode("pending", "rust");
    socket.fire("code", { from: "partner", code: "remote", language: "go" });
    await vi.advanceTimersByTimeAsync(300);
    expect(socket.emit.mock.calls.filter(([e]) => e === "code")).toHaveLength(
      1,
    );
    expect(observer.code).toHaveBeenLastCalledWith("remote", "go");
  });
  it("rejects oversized code and only reports repeated rate limiting once", () => {
    start();
    engine.sendCode("x".repeat(50001), "python3");
    expect(observer.notice).toHaveBeenCalledWith(
      expect.stringContaining("50,000"),
    );
    observer.notice.mockClear();
    socket.fire("peer_error", { code: "rate_limited", error: "Slow down" });
    socket.fire("peer_error", { code: "rate_limited", error: "Slow down" });
    expect(observer.notice).toHaveBeenCalledOnce();
    socket.fire("peer_error", { code: "invalid", error: "Invalid code" });
    socket.fire("peer_error", { code: "not_joined", error: "Join first" });
    expect(observer.notice.mock.calls.map(([notice]) => notice)).toEqual([
      "Slow down",
      "Invalid code",
      "Join first",
    ]);
  });
  it("reports connected, reconnecting, failed and absent status in words", async () => {
    start();
    socket.fire("presence", { interviewer: true, candidate: true });
    await settle();
    const pc = MockPeer.instances[0];
    for (const [connectionState, expected] of [
      ["connected", "connected"],
      ["disconnected", "reconnecting"],
      ["failed", "couldn't connect"],
    ]) {
      pc.connectionState = connectionState;
      pc.onconnectionstatechange?.();
      expect(observer.status).toHaveBeenLastCalledWith(expected);
    }
    socket.fire("presence", { interviewer: true, candidate: false });
    expect(observer.status).toHaveBeenLastCalledWith(
      "waiting for your partner",
    );
  });
  it("assembles remote tracks and mutes local tracks without another permission request", async () => {
    start();
    await engine.enableMedia("audio");
    const stream = observer.streams.mock.calls.at(-1)![0] as MockStream;
    engine.toggleMedia("audio");
    expect(stream.getAudioTracks()[0].enabled).toBe(false);
    await engine.enableMedia("audio");
    expect(stream.getAudioTracks()[0].enabled).toBe(true);
    expect(getUserMedia).toHaveBeenCalledOnce();
    const remote = new MockTrack("video");
    MockPeer.instances[0].ontrack?.({ track: remote, streams: [] });
    expect(observer.streams.mock.calls.at(-1)![1].getVideoTracks()).toEqual([
      remote,
    ]);
  });
  it("stops a permission request that finishes after leaving", async () => {
    start();
    let resolve!: (stream: MockStream) => void;
    getUserMedia.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const pending = engine.enableMedia("audio");
    engine.dispose();
    const track = new MockTrack("audio");
    resolve(new MockStream([track]));
    await pending;
    expect(track.stop).toHaveBeenCalledOnce();
    expect(MockPeer.instances).toHaveLength(0);
  });
  it.each(["ended_by_participant", "time_up", "cancelled", "expired"] as const)(
    "cleans up on %s without ending from its own clock",
    async (reason) => {
      start();
      await engine.enableMedia("audio");
      const pc = MockPeer.instances[0];
      const stream = observer.streams.mock.calls.at(-1)![0] as MockStream;
      socket.fire("ended", { reason });
      expect(observer.ended).toHaveBeenCalledWith(reason);
      expect(pc.close).toHaveBeenCalledOnce();
      expect(stream.getTracks()[0].stop).toHaveBeenCalledOnce();
      expect(socket.disconnect).toHaveBeenCalled();
    },
  );
  it("flushes code and ends through an ack; leave only emits leave", async () => {
    start();
    engine.sendCode("final", "go");
    await engine.end();
    expect(socket.emit).toHaveBeenCalledWith("code", {
      code: "final",
      language: "go",
    });
    expect(socket.emit).toHaveBeenCalledWith("end", expect.any(Function));
    expect(observer.ended).toHaveBeenCalledWith("ended_by_participant");
    socket = new MockSocket();
    vi.mocked(io).mockReturnValue(socket as unknown as ReturnType<typeof io>);
    start();
    engine.dispose();
    expect(socket.emit).toHaveBeenCalledWith("leave");
    expect(socket.emit.mock.calls.some(([e]) => e === "end")).toBe(false);
  });
  it("reports failed end acknowledgements", async () => {
    start();
    socket.endAck = { ok: false, error: "End unavailable" };
    await expect(engine.end()).rejects.toThrow("End unavailable");
    expect(observer.ended).not.toHaveBeenCalled();
  });
});

it("keeps local edits made during a socket outage and sends them after rejoining", () => {
  start();
  socket.fire("disconnect", "transport close");
  engine.sendCode("offline edit", "go");
  observer.code.mockClear();
  socket.fire("connect");
  expect(socket.emit).toHaveBeenCalledWith("code", {
    code: "offline edit",
    language: "go",
  });
  expect(observer.code).not.toHaveBeenCalled();
});
it("recovers an ended join acknowledgement into completed feedback data", async () => {
  socket.joinAck = { ok: false, code: "ended", error: "Session finished" };
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            session: {
              ...peerSession,
              status: "completed",
              endedReason: "time_up",
            },
          }),
        ),
    ),
  );
  engine = new PeerRoomConnection(peerSession, observer);
  engine.start();
  await settle();
  expect(observer.session).toHaveBeenCalledWith(
    expect.objectContaining({ status: "completed" }),
  );
  expect(observer.ended).toHaveBeenCalledWith("time_up");
});

it("retains a debounced edit when the socket drops before its send", async () => {
  vi.useFakeTimers();
  start();
  engine.sendCode("unsent edit", "rust");
  socket.fire("disconnect", "transport close");
  await vi.advanceTimersByTimeAsync(1000);
  socket.fire("connect");
  expect(socket.emit).toHaveBeenCalledWith("code", {
    code: "unsent edit",
    language: "rust",
  });
});

it("ignores late auth and code events after leaving", () => {
  start();
  engine.dispose();
  observer.code.mockClear();
  socket.fire("code", { from: "partner", code: "late", language: "go" });
  socket.fire("connect_error", { data: { code: "session_invalid" } });
  expect(observer.code).not.toHaveBeenCalled();
  expect(observer.login).not.toHaveBeenCalled();
  expect(localStorage.getItem("if-token")).toBe("test-token");
});

it("refreshes a host's partner details when someone first enters the room", async () => {
  const waiting = { ...peerSession, partner: null };
  socket.joinAck = {
    ok: true,
    session: waiting,
    presence: { interviewer: true, candidate: false },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (request: Request) =>
        new Response(
          JSON.stringify(
            request.url.endsWith("/ice-servers")
              ? { iceServers: [], expiresAt: null }
              : { session: peerSession },
          ),
        ),
    ),
  );
  engine = new PeerRoomConnection(waiting, observer);
  engine.start();
  socket.fire("presence", { interviewer: true, candidate: true });
  await settle();
  expect(observer.session).toHaveBeenLastCalledWith(
    expect.objectContaining({
      partner: { username: "Grace", role: "candidate" },
    }),
  );
});
