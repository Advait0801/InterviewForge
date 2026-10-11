import { query } from "../db";
import type { MessageRow } from "./interviews.repository";

export type ShareLinkRow = {
  id: string;
  token_hint: string;
  display_name: string | null;
  expires_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
};

const LINK_COLUMNS = `id, token_hint, display_name, expires_at::text AS expires_at, view_count,
       last_viewed_at::text AS last_viewed_at, created_at::text AS created_at`;

export async function insertLink(row: {
  sessionId: string;
  userId: string;
  tokenHash: string;
  tokenHint: string;
  displayName: string | null;
  expiresInDays: number | null;
}): Promise<ShareLinkRow> {
  const result = await query<ShareLinkRow>(
    `INSERT INTO interview_share_links (session_id, user_id, token_hash, token_hint, display_name, expires_at)
       VALUES ($1, $2, $3, $4, $5, CASE WHEN $6::int IS NULL THEN NULL ELSE NOW() + make_interval(days => $6::int) END)
       RETURNING ${LINK_COLUMNS}`,
    [row.sessionId, row.userId, row.tokenHash, row.tokenHint, row.displayName, row.expiresInDays]
  );
  return result.rows[0];
}

/** The owner's links for a session that still work (not revoked, not expired), newest first. */
export async function listActiveLinks(sessionId: string, userId: string): Promise<ShareLinkRow[]> {
  const result = await query<ShareLinkRow>(
    `SELECT ${LINK_COLUMNS} FROM interview_share_links
      WHERE session_id = $1 AND user_id = $2 AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC`,
    [sessionId, userId]
  );
  return result.rows;
}

export async function revokeLink(linkId: string, sessionId: string, userId: string): Promise<boolean> {
  const result = await query(
    `UPDATE interview_share_links SET revoked_at = NOW()
      WHERE id = $1 AND session_id = $2 AND user_id = $3 AND revoked_at IS NULL`,
    [linkId, sessionId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export type SharedSessionRow = {
  link_id: string;
  display_name: string | null;
  session_id: string;
  company: string;
  persona: string;
  mode: string;
  status: string;
  report_json: unknown;
  created_at: string;
};

/**
 * The session behind a working link, counting the view. One statement, so a link revoked a
 * moment earlier can't be served by a read that raced the revocation.
 */
export async function openLink(tokenHash: string): Promise<SharedSessionRow | null> {
  const result = await query<SharedSessionRow>(
    `UPDATE interview_share_links l
        SET view_count = l.view_count + 1, last_viewed_at = NOW()
       FROM interview_sessions s
      WHERE l.token_hash = $1 AND l.revoked_at IS NULL
        AND (l.expires_at IS NULL OR l.expires_at > NOW())
        AND s.id = l.session_id
      RETURNING l.id AS link_id, l.display_name, s.id AS session_id, s.company, s.persona, s.mode,
                s.status, s.report_json, s.created_at::text AS created_at`,
    [tokenHash]
  );
  return result.rows[0] ?? null;
}

export async function listSharedMessages(sessionId: string): Promise<Pick<MessageRow, "role" | "stage" | "content" | "metadata_json" | "created_at">[]> {
  const result = await query<MessageRow>(
    `SELECT role, stage, content, metadata_json, created_at::text AS created_at
       FROM interview_messages
      WHERE session_id = $1
      ORDER BY created_at ASC`,
    [sessionId]
  );
  return result.rows;
}
