import type { Namespace, Server, Socket } from "socket.io";
import { authenticateToken } from "../middleware/auth.middleware";
import { DomainError } from "../services/errors";
import {
  endSession,
  enterRoom,
  saveSharedCode,
  startIfReady,
  sweepExpired,
  type PeerSessionView,
} from "../services/peer.service";
import { UUID_REGEX } from "../routes/http";
import { LIMITS, TokenBucket, validateCode, validateSignal, type SignalData } from "./peer.protocol";
import { notifySessionEnded, sessionRoom, setPeerNamespace, userRoom } from "./peer.events";

/**
 * The live half of a peer interview (D-078), on the /peer namespace. The server is a relay:
 * it decides who may be in a room and passes signalling and code between the two
 * participants, but never interprets SDP and never sees the media, which goes peer to peer.
 *
 * Every connection is authenticated like an HTTP request (JWT plus token_version), every
 * message is checked (peer.protocol.ts) and rate limited per socket, and a message goes to
 * the *other* participant only: the session's room except the sender's own user room, so a
 * second tab of the same user never receives its own offer.
 *
 * With the Redis adapter (realtime/index.ts) rooms span backend instances, and so do the
 * presence lookups (fetchSockets) and the sweep's notifications.
 */

type Role = "interviewer" | "candidate";
type Presence = { interviewer: boolean; candidate: boolean };
type Reply = (response: unknown) => void;

export interface PeerClientEvents {
  join: (payload: unknown, reply?: Reply) => void;
  signal: (payload: unknown) => void;
  code: (payload: unknown) => void;
  end: (reply?: Reply) => void;
  leave: () => void;
}

export interface PeerServerEvents {
  presence: (p: Presence) => void;
  started: (p: { startedAt: string | null; endsAt: string | null }) => void;
  signal: (p: { from: Role; data: SignalData }) => void;
  code: (p: { from: Role; code: string; language: string }) => void;
  ended: (p: { reason: string }) => void;
  peer_error: (p: { code: string; error: string }) => void;
}

type PeerSocketData = { userId: string; sessionId?: string; role?: Role };
type PeerNamespace = Namespace<PeerClientEvents, PeerServerEvents, Record<string, never>, PeerSocketData>;
type PeerSocket = Socket<PeerClientEvents, PeerServerEvents, Record<string, never>, PeerSocketData>;

export const SWEEP_MS = Number(process.env.PEER_SWEEP_MS ?? 15_000);
/** Code is saved at most this often per session per instance; the latest version always lands. */
export const CODE_SAVE_MS = 2_000;

const replyFn = (cb: unknown): Reply => (typeof cb === "function" ? (cb as Reply) : () => undefined);

async function presence(nsp: PeerNamespace, sessionId: string): Promise<Presence> {
  const sockets = await nsp.in(sessionRoom(sessionId)).fetchSockets();
  const roles = new Set(sockets.map((s) => s.data.role));
  return { interviewer: roles.has("interviewer"), candidate: roles.has("candidate") };
}

/** Trailing-edge throttle per session: the last code sent is the one saved. */
class CodeSaver {
  private pending = new Map<string, { code: string; language: string; timer: NodeJS.Timeout }>();
  private lastSave = new Map<string, number>();

  push(sessionId: string, code: string, language: string): void {
    const existing = this.pending.get(sessionId);
    if (existing) {
      existing.code = code;
      existing.language = language;
      return;
    }
    const wait = Math.max(0, (this.lastSave.get(sessionId) ?? 0) + CODE_SAVE_MS - Date.now());
    const timer = setTimeout(() => void this.flush(sessionId), wait);
    timer.unref?.();
    this.pending.set(sessionId, { code, language, timer });
  }

  async flush(sessionId: string): Promise<void> {
    const entry = this.pending.get(sessionId);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(sessionId);
    this.lastSave.set(sessionId, Date.now());
    try {
      await saveSharedCode(sessionId, entry.code, entry.language);
    } catch (err) {
      console.error("Peer code save failed", err);
    }
  }

  async flushAll(): Promise<void> {
    await Promise.all([...this.pending.keys()].map((id) => this.flush(id)));
  }
}

function onConnection(nsp: PeerNamespace, socket: PeerSocket, saver: CodeSaver): void {
  const data = socket.data;
  void socket.join(userRoom(data.userId));
  const buckets = {
    signal: new TokenBucket(LIMITS.signal.capacity, LIMITS.signal.perSecond),
    code: new TokenBucket(LIMITS.code.capacity, LIMITS.code.perSecond),
  };
  let lastLimitNotice = 0;
  const reject = (code: string, error: string) => socket.emit("peer_error", { code, error });
  const limited = (kind: keyof typeof buckets) => {
    if (buckets[kind].take()) return false;
    if (Date.now() - lastLimitNotice > 2_000) {
      lastLimitNotice = Date.now();
      reject("rate_limited", `Too many ${kind} messages; some were dropped`);
    }
    return true;
  };
  const room = () => nsp.to(sessionRoom(data.sessionId!));
  const partner = () => nsp.to(sessionRoom(data.sessionId!)).except(userRoom(data.userId));

  socket.on("join", async (payload, cb) => {
    const reply = replyFn(cb);
    const sessionId = (payload as { sessionId?: unknown } | null)?.sessionId;
    if (typeof sessionId !== "string" || !UUID_REGEX.test(sessionId)) {
      return reply({ ok: false, code: "invalid", error: "Invalid session id" });
    }
    if (data.sessionId && data.sessionId !== sessionId) {
      return reply({ ok: false, code: "invalid", error: "Already in another session; leave it first" });
    }
    let session: PeerSessionView;
    try {
      session = await enterRoom(sessionId, data.userId);
    } catch (err) {
      if (err instanceof DomainError) {
        return reply({ ok: false, code: err.status === 404 ? "not_found" : "ended", error: err.message });
      }
      console.error("Peer join failed", err);
      return reply({ ok: false, code: "unavailable", error: "Couldn't join the session. Try again." });
    }
    data.sessionId = sessionId;
    data.role = session.myRole;
    await socket.join(sessionRoom(sessionId));
    const present = await presence(nsp, sessionId);
    room().emit("presence", present);
    if (present.interviewer && present.candidate && session.status === "waiting" && (await startIfReady(sessionId))) {
      session = await enterRoom(sessionId, data.userId);
      room().emit("started", { startedAt: session.startedAt, endsAt: session.endsAt });
    }
    return reply({ ok: true, session, presence: present });
  });

  socket.on("signal", (payload) => {
    if (!data.sessionId) return reject("not_joined", "Join a session first");
    if (limited("signal")) return;
    const signal = validateSignal(payload);
    if (!signal) return reject("invalid", "Unrecognised signalling message");
    partner().emit("signal", { from: data.role!, data: signal });
  });

  socket.on("code", (payload) => {
    if (!data.sessionId) return reject("not_joined", "Join a session first");
    if (limited("code")) return;
    const update = validateCode(payload);
    if (!update) return reject("invalid", "code must be a string within the limit, with a known language");
    partner().emit("code", { from: data.role!, ...update });
    saver.push(data.sessionId, update.code, update.language);
  });

  socket.on("end", async (cb) => {
    const reply = replyFn(cb);
    const sessionId = data.sessionId;
    if (!sessionId) return reply({ ok: false, code: "not_joined", error: "Join a session first" });
    try {
      await saver.flush(sessionId);
      const { session, changed } = await endSession(sessionId, data.userId);
      if (changed) notifySessionEnded(sessionId, session.endedReason ?? "ended_by_participant");
      return reply({ ok: true, session });
    } catch (err) {
      console.error("Peer end failed", err);
      return reply({ ok: false, code: "unavailable", error: "Couldn't end the session. Try again." });
    }
  });

  socket.on("leave", async () => {
    const sessionId = data.sessionId;
    if (!sessionId) return;
    data.sessionId = undefined;
    data.role = undefined;
    await socket.leave(sessionRoom(sessionId));
    await saver.flush(sessionId);
    nsp.to(sessionRoom(sessionId)).emit("presence", await presence(nsp, sessionId));
  });

  socket.on("disconnect", () => {
    // The socket has already left its rooms; tell whoever remains.
    const sessionId = data.sessionId;
    if (!sessionId) return;
    void saver.flush(sessionId);
    void presence(nsp, sessionId)
      .then((p) => nsp.to(sessionRoom(sessionId)).emit("presence", p))
      .catch(() => undefined);
  });
}

export function registerPeerNamespace(io: Server): { stop: () => Promise<void> } {
  const nsp = io.of("/peer") as unknown as PeerNamespace;
  setPeerNamespace(nsp as unknown as Namespace);
  const saver = new CodeSaver();

  // Same identity rules as the HTTP API: no token, a bad one or a revoked one is refused.
  nsp.use(async (socket, next) => {
    const result = await authenticateToken(socket.handshake.auth?.token);
    if (result.kind === "ok") {
      socket.data.userId = result.userId;
      return next();
    }
    const code = result.kind === "unavailable" ? "auth_unavailable" : "session_invalid";
    return next(Object.assign(new Error(code), { data: { code } }));
  });

  nsp.on("connection", (socket) => onConnection(nsp, socket, saver));

  // The clock is the server's: an active session past its end, or an invite nobody used in a
  // day, is closed here and both peers are told. Idempotent across instances (repository).
  const sweep = async () => {
    try {
      for (const ended of await sweepExpired()) {
        await saver.flush(ended.id);
        notifySessionEnded(ended.id, ended.ended_reason);
      }
    } catch (err) {
      console.error("Peer sweep failed", err);
    }
  };
  const timer = setInterval(() => void sweep(), SWEEP_MS);
  timer.unref?.();

  return {
    stop: async () => {
      clearInterval(timer);
      await saver.flushAll();
      setPeerNamespace(null);
    },
  };
}
