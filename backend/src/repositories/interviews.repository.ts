import { query, type Queryable } from "../db";

export type SessionRow = {
  id: string;
  user_id: string;
  company: string;
  current_stage: string;
  status: string;
  stage_turn_count: number;
  resume_grounded: boolean;
  persona: string;
  mode: string;
  llm_calls: number;
  llm_cost_usd: number;
  report_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  session_id: string;
  role: string;
  stage: string;
  content: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
};

export type NewMessage = {
  sessionId: string;
  role: "assistant" | "candidate" | "system";
  stage: string;
  content: string;
  metadata: Record<string, unknown>;
};

/** The session update a turn makes, applied only if the turn is still current. */
export type TurnUpdate = { set: string; params: unknown[] };

export async function listSessions(userId: string): Promise<Omit<SessionRow, "report_json">[]> {
  const result = await query<SessionRow>(
    `SELECT id, user_id, company, current_stage, status, stage_turn_count, resume_grounded,
              persona, mode, llm_calls, llm_cost_usd, created_at, updated_at
       FROM interview_sessions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
    [userId]
  );
  return result.rows;
}

export async function findSession(sessionId: string, userId: string): Promise<SessionRow | null> {
  const result = await query<SessionRow>(
    `SELECT id, user_id, company, current_stage, status, stage_turn_count, resume_grounded,
            persona, mode, llm_calls, llm_cost_usd, report_json, created_at, updated_at
     FROM interview_sessions
     WHERE id = $1 AND user_id = $2`,
    [sessionId, userId]
  );
  return result.rows[0] ?? null;
}

export async function listMessages(sessionId: string): Promise<MessageRow[]> {
  const result = await query<MessageRow>(
    `SELECT id, session_id, role, stage, content, metadata_json, created_at
     FROM interview_messages
     WHERE session_id = $1
     ORDER BY created_at ASC`,
    [sessionId]
  );
  return result.rows;
}

/** The question or follow-up the candidate is currently answering in `stage`. */
export async function findLatestQuestion(sessionId: string, stage: string): Promise<MessageRow | null> {
  const result = await query<MessageRow>(
    `SELECT id, session_id, role, stage, content, metadata_json, created_at
       FROM interview_messages
       WHERE session_id = $1 AND role = 'assistant' AND stage = $2
         AND (metadata_json->>'kind' = 'question' OR metadata_json->>'kind' = 'followup')
       ORDER BY created_at DESC
       LIMIT 1`,
    [sessionId, stage]
  );
  return result.rows[0] ?? null;
}

export async function insertSession(
  db: Queryable,
  row: {
    id: string;
    userId: string;
    company: string;
    stage: string;
    resumeGrounded: boolean;
    persona: string;
    mode: string;
  }
): Promise<void> {
  await db.query(
    `INSERT INTO interview_sessions (id, user_id, company, current_stage, status, stage_turn_count, resume_grounded, persona, mode)
         VALUES ($1, $2, $3, $4, 'active', 0, $5, $6, $7)`,
    [row.id, row.userId, row.company, row.stage, row.resumeGrounded, row.persona, row.mode]
  );
}

/**
 * Charge model calls to a session (D-067). An increment, not a set, and outside any turn
 * transaction: spend is recorded even when the turn it paid for failed.
 */
export async function addUsage(sessionId: string, calls: number, costUsd: number): Promise<void> {
  await query(
    `UPDATE interview_sessions SET llm_calls = llm_calls + $2, llm_cost_usd = llm_cost_usd + $3 WHERE id = $1`,
    [sessionId, calls, costUsd]
  );
}

/**
 * Hints given in `stage` since `since` (the question being answered was asked), oldest
 * first (D-066). Pass `db` to count inside a transaction.
 */
export async function listHintsSince(
  sessionId: string,
  stage: string,
  since: string,
  db: Queryable = { query }
): Promise<MessageRow[]> {
  const result = await db.query<MessageRow>(
    `SELECT id, session_id, role, stage, content, metadata_json, created_at
       FROM interview_messages
       WHERE session_id = $1 AND stage = $2 AND metadata_json->>'kind' = 'hint' AND created_at > $3
       ORDER BY created_at ASC`,
    [sessionId, stage, since]
  );
  return result.rows;
}

/**
 * Lock the session row for the rest of the transaction and return where it stands. A hint
 * and an answer to the same turn serialise on this lock (the answer's claim is an UPDATE of
 * the same row), so a hint is never recorded against a turn that has moved on.
 */
export async function lockSessionTurn(
  db: Queryable,
  sessionId: string
): Promise<{ status: string; current_stage: string; stage_turn_count: number } | null> {
  const result = await db.query<{ status: string; current_stage: string; stage_turn_count: number }>(
    `SELECT status, current_stage, stage_turn_count FROM interview_sessions WHERE id = $1 FOR UPDATE`,
    [sessionId]
  );
  return result.rows[0] ?? null;
}

export async function insertMessage(db: Queryable, params: NewMessage): Promise<void> {
  // clock_timestamp(), not the column default NOW(): inside a transaction NOW() is
  // frozen, so an answer, its evaluation and the next question would share one
  // timestamp and the transcript (ORDER BY created_at) would come back in any order.
  await db.query(
    `INSERT INTO interview_messages (session_id, role, stage, content, metadata_json, created_at)
     VALUES ($1, $2, $3, $4, $5, clock_timestamp())`,
    [params.sessionId, params.role, params.stage, params.content, JSON.stringify(params.metadata)]
  );
}

/**
 * Apply `update` only while the session is still active on the stage and turn the
 * answer responded to. Returns false when another request got there first.
 */
export async function claimTurn(
  db: Queryable,
  session: { id: string; stage: string; turnCount: number },
  update: TurnUpdate
): Promise<boolean> {
  const claimed = await db.query(
    `UPDATE interview_sessions SET ${update.set}, updated_at = NOW()
           WHERE id = $1 AND status = 'active' AND current_stage = $2 AND stage_turn_count = $3
           RETURNING id`,
    [session.id, session.stage, session.turnCount, ...update.params]
  );
  return claimed.rows.length > 0;
}

/** Store the report unless one is already stored. Returns false if another request won. */
export async function claimReport(db: Queryable, sessionId: string, report: unknown): Promise<boolean> {
  const claimed = await db.query<{ id: string }>(
    `UPDATE interview_sessions SET report_json = $2, updated_at = NOW()
         WHERE id = $1 AND report_json IS NULL
         RETURNING id`,
    [sessionId, JSON.stringify(report)]
  );
  return claimed.rows.length > 0;
}

export async function insertStageScore(db: Queryable, userId: string, stage: string, score: number): Promise<void> {
  await db.query(
    `INSERT INTO scores (user_id, category, score, max_score)
             VALUES ($1, $2, $3, 10)`,
    [userId, stage, score]
  );
}

export async function insertOverallScore(db: Queryable, userId: string, score: number): Promise<void> {
  await db.query(
    `INSERT INTO scores (user_id, category, score, max_score)
           VALUES ($1, 'overall', $2, 10)`,
    [userId, score]
  );
}
