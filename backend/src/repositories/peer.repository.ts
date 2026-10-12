import { query, type Queryable } from "../db";

export type PeerRole = "interviewer" | "candidate";
export type PeerStatus = "waiting" | "active" | "completed" | "cancelled";
export type EndReason = "ended_by_participant" | "time_up" | "cancelled" | "expired";

export type PeerSessionRow = {
  id: string;
  host_id: string;
  guest_id: string | null;
  host_role: PeerRole;
  problem_id: string | null;
  duration_minutes: number;
  status: PeerStatus;
  created_at: string;
  started_at: string | null;
  ends_at: string | null;
  ended_at: string | null;
  ended_reason: EndReason | null;
  code: string;
  language: string;
};

/** A session as one participant sees it: the partner's name and the problem's summary joined in. */
export type PeerSessionViewRow = PeerSessionRow & {
  host_username: string;
  guest_username: string | null;
  problem_slug: string | null;
  problem_title: string | null;
  problem_difficulty: string | null;
};

export type FeedbackRow = { author_id: string; ratings: Record<string, number>; notes: string; created_at: string };

const COLUMNS = `ps.id, ps.host_id, ps.guest_id, ps.host_role, ps.problem_id, ps.duration_minutes, ps.status,
       ps.created_at, ps.started_at, ps.ends_at, ps.ended_at, ps.ended_reason, ps.code, ps.language`;
const VIEW = `SELECT ${COLUMNS}, hu.username AS host_username, gu.username AS guest_username,
       p.slug AS problem_slug, p.title AS problem_title, p.difficulty AS problem_difficulty
  FROM peer_sessions ps
  JOIN users hu ON hu.id = ps.host_id
  LEFT JOIN users gu ON gu.id = ps.guest_id
  LEFT JOIN problems p ON p.id = ps.problem_id`;

export async function problemExists(problemId: string): Promise<boolean> {
  const result = await query(`SELECT 1 FROM problems WHERE id = $1`, [problemId]);
  return result.rows.length > 0;
}

export async function countOpenHosted(userId: string): Promise<number> {
  const result = await query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM peer_sessions WHERE host_id = $1 AND status = 'waiting'`,
    [userId]
  );
  return result.rows[0]?.n ?? 0;
}

export async function insertSession(s: {
  hostId: string;
  hostRole: PeerRole;
  problemId: string | null;
  durationMinutes: number;
  inviteHash: string;
}): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO peer_sessions (host_id, host_role, problem_id, duration_minutes, invite_hash)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [s.hostId, s.hostRole, s.problemId, s.durationMinutes, s.inviteHash]
  );
  return result.rows[0].id;
}

/** The session an invite opens, locked so two people can't both take the guest seat. */
export async function lockByInviteHash(db: Queryable, inviteHash: string): Promise<PeerSessionRow | null> {
  const result = await db.query<PeerSessionRow>(
    `SELECT ${COLUMNS} FROM peer_sessions ps WHERE ps.invite_hash = $1 FOR UPDATE`,
    [inviteHash]
  );
  return result.rows[0] ?? null;
}

export async function setGuest(db: Queryable, sessionId: string, guestId: string): Promise<void> {
  await db.query(`UPDATE peer_sessions SET guest_id = $2 WHERE id = $1 AND guest_id IS NULL`, [sessionId, guestId]);
}

/** Only ever for one of its two participants: anyone else gets nothing. */
export async function findForParticipant(sessionId: string, userId: string): Promise<PeerSessionViewRow | null> {
  const result = await query<PeerSessionViewRow>(
    `${VIEW} WHERE ps.id = $1 AND (ps.host_id = $2 OR ps.guest_id = $2)`,
    [sessionId, userId]
  );
  return result.rows[0] ?? null;
}

export async function listForUser(userId: string): Promise<PeerSessionViewRow[]> {
  const result = await query<PeerSessionViewRow>(
    `${VIEW} WHERE ps.host_id = $1 OR ps.guest_id = $1 ORDER BY ps.created_at DESC LIMIT 50`,
    [userId]
  );
  return result.rows;
}

/** waiting -> active, once, when both participants are first in the room. */
export async function activate(sessionId: string): Promise<boolean> {
  const result = await query(
    `UPDATE peer_sessions
        SET status = 'active', started_at = NOW(), ends_at = NOW() + make_interval(mins => duration_minutes)
      WHERE id = $1 AND status = 'waiting' AND guest_id IS NOT NULL
      RETURNING id`,
    [sessionId]
  );
  return result.rows.length > 0;
}

/** End a session that is still open. False when it had already ended (or never existed). */
export async function endSession(sessionId: string, from: PeerStatus, to: PeerStatus, reason: EndReason): Promise<boolean> {
  const result = await query(
    `UPDATE peer_sessions SET status = $3, ended_at = NOW(), ended_reason = $4
      WHERE id = $1 AND status = $2
      RETURNING id`,
    [sessionId, from, to, reason]
  );
  return result.rows.length > 0;
}

/**
 * Sessions whose time is up become completed; invites nobody used within a day are
 * cancelled. Each id comes back once, from whichever instance's sweep got there first.
 */
export async function sweepExpired(waitingTtlHours: number): Promise<Array<{ id: string; ended_reason: EndReason }>> {
  const result = await query<{ id: string; ended_reason: EndReason }>(
    `UPDATE peer_sessions
        SET status = CASE WHEN status = 'active' THEN 'completed' ELSE 'cancelled' END,
            ended_reason = CASE WHEN status = 'active' THEN 'time_up' ELSE 'expired' END,
            ended_at = CASE WHEN status = 'active' THEN ends_at ELSE NOW() END
      WHERE (status = 'active' AND ends_at <= NOW())
         OR (status = 'waiting' AND created_at <= NOW() - make_interval(hours => $1))
      RETURNING id, ended_reason`,
    [waitingTtlHours]
  );
  return result.rows;
}

/**
 * The shared editor's state, while the session is live and for a few seconds after it ends,
 * so the last throttled save (realtime/peer.socket.ts) still lands when time runs out.
 */
export async function saveCode(sessionId: string, code: string, language: string): Promise<boolean> {
  const result = await query(
    `UPDATE peer_sessions SET code = $2, language = $3
      WHERE id = $1
        AND (status IN ('waiting', 'active') OR (status = 'completed' AND ended_at > NOW() - INTERVAL '10 seconds'))
      RETURNING id`,
    [sessionId, code, language]
  );
  return result.rows.length > 0;
}

export async function insertFeedback(
  sessionId: string,
  authorId: string,
  ratings: Record<string, number>,
  notes: string
): Promise<boolean> {
  const result = await query(
    `INSERT INTO peer_feedback (session_id, author_id, ratings, notes) VALUES ($1, $2, $3, $4)
       ON CONFLICT (session_id, author_id) DO NOTHING RETURNING author_id`,
    [sessionId, authorId, JSON.stringify(ratings), notes]
  );
  return result.rows.length > 0;
}

export async function listFeedback(sessionId: string): Promise<FeedbackRow[]> {
  const result = await query<FeedbackRow>(
    `SELECT author_id, ratings, notes, created_at FROM peer_feedback WHERE session_id = $1`,
    [sessionId]
  );
  return result.rows;
}
