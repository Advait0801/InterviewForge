import { createHash, createHmac, randomBytes } from "node:crypto";
import { withTransaction } from "../db";
import * as repo from "../repositories/peer.repository";
import type { EndReason, PeerRole, PeerSessionViewRow } from "../repositories/peer.repository";
import { DomainError, badRequest, notFound } from "./errors";

/**
 * Peer mock interviews (D-078). Two users: one interviews, the other is the candidate. The
 * media goes peer to peer over WebRTC; this module owns everything else: the session and its
 * invite, who may be in it, its clock, the shared code and the feedback. The realtime layer
 * (realtime/peer.socket.ts) calls in here and never touches the database itself.
 *
 * Privacy: a session exists only for its two participants. Every lookup is filtered by them
 * and anyone else gets the same 404 as for a session that doesn't exist. An invite is a
 * bearer token stored as SHA-256 only (as share links are, D-071) and works once: it seats
 * the second participant.
 */

export const MAX_OPEN_INVITES = 5;
export const DEFAULT_DURATION = 45;
export const WAITING_TTL_HOURS = 24;
export const MAX_CODE_CHARS = 50_000;
export const NOTES_MAX = 2_000;
export const LANGUAGES = ["python3", "c", "cpp", "java", "javascript", "go", "rust"] as const;
/** What each side rates: the interviewer rates the candidate, and the other way round. */
export const FEEDBACK_KEYS: Record<PeerRole, readonly string[]> = {
  interviewer: ["problemSolving", "communication", "codeQuality"],
  candidate: ["clarity", "helpfulness"],
};

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const sessionNotFound = () => notFound("Peer session not found");
/** One answer for an unknown, malformed, used or closed invite, so none can be told apart. */
const inviteNotFound = () => notFound("This invite doesn't exist or is no longer open");

export const roleOf = (s: { host_id: string; host_role: PeerRole }, userId: string): PeerRole =>
  s.host_id === userId ? s.host_role : s.host_role === "interviewer" ? "candidate" : "interviewer";
const otherRole = (r: PeerRole): PeerRole => (r === "interviewer" ? "candidate" : "interviewer");

export type PeerSessionView = ReturnType<typeof view>;

function view(s: PeerSessionViewRow, userId: string, feedback: repo.FeedbackRow[] = []) {
  const isHost = s.host_id === userId;
  const myRole = roleOf(s, userId);
  const given = feedback.find((f) => f.author_id === userId);
  const received = feedback.find((f) => f.author_id !== userId);
  const partnerName = isHost ? s.guest_username : s.host_username;
  return {
    id: s.id,
    status: s.status,
    myRole,
    isHost,
    partner: partnerName ? { username: partnerName, role: otherRole(myRole) } : null,
    problem: s.problem_id && s.problem_slug
      ? { id: s.problem_id, slug: s.problem_slug, title: s.problem_title!, difficulty: s.problem_difficulty! }
      : null,
    durationMinutes: s.duration_minutes,
    createdAt: s.created_at,
    startedAt: s.started_at,
    endsAt: s.ends_at,
    endedAt: s.ended_at,
    endedReason: s.ended_reason,
    code: s.code,
    language: s.language,
    feedback: {
      given: given ? { ratings: given.ratings, notes: given.notes, createdAt: given.created_at } : null,
      // What the partner wrote is shown once the session is over, never during it.
      received:
        received && s.status === "completed"
          ? { ratings: received.ratings, notes: received.notes, createdAt: received.created_at }
          : null,
    },
  };
}

export async function createSession(
  hostId: string,
  input: { role: PeerRole; problemId?: string | null; durationMinutes?: number }
) {
  if (input.problemId && !(await repo.problemExists(input.problemId))) throw notFound("Problem not found");
  if ((await repo.countOpenHosted(hostId)) >= MAX_OPEN_INVITES) {
    throw new DomainError(409, `You already have ${MAX_OPEN_INVITES} open invites. Cancel one first.`);
  }
  const inviteToken = randomBytes(32).toString("base64url");
  const id = await repo.insertSession({
    hostId,
    hostRole: input.role,
    problemId: input.problemId ?? null,
    durationMinutes: input.durationMinutes ?? DEFAULT_DURATION,
    inviteHash: hashToken(inviteToken),
  });
  const session = await repo.findForParticipant(id, hostId);
  // The token is returned this once; only its hash is stored.
  return { session: view(session!, hostId), inviteToken };
}

/**
 * Take the guest seat. Joining again (or the host opening their own invite) is harmless and
 * returns the session; a second, different guest is a 409.
 */
export async function joinSession(userId: string, token: string) {
  if (!TOKEN.test(token)) throw inviteNotFound();
  const sessionId = await withTransaction(async (tx) => {
    const s = await repo.lockByInviteHash(tx, hashToken(token));
    if (!s || s.status === "completed" || s.status === "cancelled") throw inviteNotFound();
    if (s.host_id === userId || s.guest_id === userId) return s.id;
    if (s.guest_id) throw new DomainError(409, "This session already has both participants");
    await repo.setGuest(tx, s.id, userId);
    return s.id;
  });
  return getSession(sessionId, userId);
}

export async function getSession(sessionId: string, userId: string): Promise<PeerSessionView> {
  const s = await repo.findForParticipant(sessionId, userId);
  if (!s) throw sessionNotFound();
  return view(s, userId, await repo.listFeedback(sessionId));
}

export async function listSessions(userId: string) {
  return (await repo.listForUser(userId)).map((s) => view(s, userId));
}

/** Either participant may end it: a waiting session is cancelled, an active one completed. */
export async function endSession(sessionId: string, userId: string): Promise<{ session: PeerSessionView; changed: boolean }> {
  const s = await repo.findForParticipant(sessionId, userId);
  if (!s) throw sessionNotFound();
  let changed = false;
  if (s.status === "waiting") changed = await repo.endSession(sessionId, "waiting", "cancelled", "cancelled");
  else if (s.status === "active") changed = await repo.endSession(sessionId, "active", "completed", "ended_by_participant");
  return { session: await getSession(sessionId, userId), changed };
}

export async function submitFeedback(
  sessionId: string,
  userId: string,
  input: { ratings: Record<string, unknown>; notes?: string }
): Promise<PeerSessionView> {
  const s = await repo.findForParticipant(sessionId, userId);
  if (!s) throw sessionNotFound();
  if (s.status !== "completed") throw badRequest("Feedback opens once the session has ended");
  const keys = FEEDBACK_KEYS[roleOf(s, userId)];
  const given = Object.keys(input.ratings ?? {});
  if (given.length !== keys.length || !keys.every((k) => given.includes(k))) {
    throw badRequest(`ratings must have exactly: ${keys.join(", ")}`);
  }
  const ratings: Record<string, number> = {};
  for (const k of keys) {
    const v = input.ratings[k];
    if (!Number.isInteger(v) || (v as number) < 1 || (v as number) > 5) throw badRequest(`${k} must be an integer from 1 to 5`);
    ratings[k] = v as number;
  }
  const notes = (input.notes ?? "").trim();
  if (notes.length > NOTES_MAX) throw badRequest(`notes must be at most ${NOTES_MAX} characters`);
  if (!(await repo.insertFeedback(sessionId, userId, ratings, notes))) {
    throw new DomainError(409, "You've already left feedback for this session");
  }
  return getSession(sessionId, userId);
}

// ── for the realtime layer ──────────────────────────────────────────────────────────

/** Who the user is in this session, if they may be in its room right now. */
export async function enterRoom(sessionId: string, userId: string): Promise<PeerSessionView> {
  const s = await getSession(sessionId, userId);
  if (s.status === "completed" || s.status === "cancelled") throw new DomainError(409, "This session has ended");
  return s;
}

/** Both participants are in the room: start the clock (once). */
export async function startIfReady(sessionId: string): Promise<boolean> {
  return repo.activate(sessionId);
}

export async function saveSharedCode(sessionId: string, code: string, language: string): Promise<boolean> {
  return repo.saveCode(sessionId, code, language);
}

export async function sweepExpired(): Promise<Array<{ id: string; ended_reason: EndReason }>> {
  return repo.sweepExpired(WAITING_TTL_HOURS);
}

// ── ICE servers ─────────────────────────────────────────────────────────────────────

/**
 * STUN for every client; TURN when configured, with credentials that expire (the coturn
 * `use-auth-secret` scheme: username "<expiry>:<user>", password HMAC-SHA1(secret, username)),
 * so a credential lifted from one browser stops working within the hour.
 */
export function iceServers(userId: string, now = Date.now()) {
  const stun = (process.env.STUN_URLS ?? "stun:stun.l.google.com:19302")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  const servers: Array<{ urls: string[]; username?: string; credential?: string }> = stun.length ? [{ urls: stun }] : [];
  const turn = (process.env.TURN_URLS ?? "").split(",").map((u) => u.trim()).filter(Boolean);
  const secret = process.env.TURN_SECRET ?? "";
  const ttl = Number(process.env.TURN_TTL_SECONDS ?? 3600);
  let expiresAt: string | null = null;
  if (turn.length && secret) {
    const expiry = Math.floor(now / 1000) + (Number.isFinite(ttl) && ttl > 0 ? ttl : 3600);
    const username = `${expiry}:${userId}`;
    servers.push({ urls: turn, username, credential: createHmac("sha1", secret).update(username).digest("base64") });
    expiresAt = new Date(expiry * 1000).toISOString();
  }
  return { iceServers: servers, expiresAt };
}
