/**
 * The peer room's wire protocol (D-078): what a client may send, checked before anything is
 * relayed. Pure. The server relays signalling without understanding it, so the check is an
 * allowlist of shapes and sizes: anything else is dropped rather than forwarded to the other
 * browser.
 *
 * Client -> server
 *   join    { sessionId }                    ack: { ok, session, presence } | { ok: false, code, error }
 *   signal  SignalData                       relayed to the other participant as signal { from, data }
 *   code    { code, language }               relayed as code { from, code, language }; saved, throttled
 *   end     (no payload)                     ack; the room gets ended { reason }
 *   leave   (no payload)                     leaves the room
 *
 * Server -> client
 *   presence { interviewer, candidate }      who is in the room now
 *   started  { startedAt, endsAt }           both arrived for the first time: the clock runs
 *   signal / code                            from the other participant
 *   ended    { reason }                      ended_by_participant | time_up | cancelled | expired
 *   peer_error { code, error }               a dropped message: invalid | rate_limited | not_joined
 */
import { LANGUAGES, MAX_CODE_CHARS } from "../services/peer.service";

export const MAX_SDP_CHARS = 20_000;
export const MAX_CANDIDATE_CHARS = 1_000;

export type SignalData =
  | { type: "offer" | "answer"; sdp: string }
  | {
      type: "candidate";
      candidate: { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null; usernameFragment: string | null };
    };

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const optString = (x: unknown, max: number) => x === undefined || x === null || (typeof x === "string" && x.length <= max);

/** A copy holding only the allowed fields, or null. Unknown fields never reach the other side. */
export function validateSignal(data: unknown): SignalData | null {
  if (!isObject(data)) return null;
  if (data.type === "offer" || data.type === "answer") {
    if (typeof data.sdp !== "string" || data.sdp.length === 0 || data.sdp.length > MAX_SDP_CHARS) return null;
    return { type: data.type, sdp: data.sdp };
  }
  if (data.type === "candidate") {
    const c = data.candidate;
    if (!isObject(c) || typeof c.candidate !== "string" || c.candidate.length > MAX_CANDIDATE_CHARS) return null;
    if (!optString(c.sdpMid, 64) || !optString(c.usernameFragment, 256)) return null;
    const index = c.sdpMLineIndex;
    if (!(index === undefined || index === null || (Number.isInteger(index) && (index as number) >= 0 && (index as number) < 64))) return null;
    return {
      type: "candidate",
      candidate: {
        candidate: c.candidate,
        sdpMid: (c.sdpMid as string | null | undefined) ?? null,
        sdpMLineIndex: (index as number | null | undefined) ?? null,
        usernameFragment: (c.usernameFragment as string | null | undefined) ?? null,
      },
    };
  }
  return null;
}

export function validateCode(data: unknown): { code: string; language: string } | null {
  if (!isObject(data)) return null;
  if (typeof data.code !== "string" || data.code.length > MAX_CODE_CHARS) return null;
  if (typeof data.language !== "string" || !(LANGUAGES as readonly string[]).includes(data.language)) return null;
  return { code: data.code, language: data.language };
}

/**
 * Per socket and per kind of message: `capacity` at once, refilled at `perSecond`. Signalling
 * is bursty (a dozen ICE candidates in a moment) but small; code updates are frequent while
 * typing and are throttled harder.
 */
export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly capacity: number,
    private readonly perSecond: number,
    private readonly clock: () => number = Date.now
  ) {
    this.tokens = capacity;
    this.last = clock();
  }

  take(): boolean {
    const now = this.clock();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.perSecond);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

export const LIMITS = {
  signal: { capacity: 60, perSecond: 20 },
  code: { capacity: 20, perSecond: 10 },
};
