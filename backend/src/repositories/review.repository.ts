import { query, type Queryable } from "../db";

export type ReviewItemRow = {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
  due_on: string;
  last_reviewed_at: string | null;
  created_at: string;
};

export type ReviewState = {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  dueOn: string;
  quality: number | null;
  reviewed: boolean;
};

export type QueueRow = {
  problem_id: string;
  slug: string;
  title: string;
  difficulty: string;
  topics: string[];
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
  due_on: string;
  last_quality: number | null;
  last_reviewed_at: string | null;
  source: string;
};

const ITEM_COLUMNS = `ease_factor, interval_days, repetitions, lapses, to_char(due_on, 'YYYY-MM-DD') AS due_on,
       last_reviewed_at::text AS last_reviewed_at, created_at::text AS created_at`;

/** The item, locked for the rest of the transaction so two submissions can't both grade it. */
export async function findItemForUpdate(db: Queryable, userId: string, problemId: string): Promise<ReviewItemRow | null> {
  const result = await db.query<ReviewItemRow>(
    `SELECT ${ITEM_COLUMNS} FROM review_items WHERE user_id = $1 AND problem_id = $2 FOR UPDATE`,
    [userId, problemId]
  );
  return result.rows[0] ?? null;
}

export async function insertItem(
  db: Queryable,
  userId: string,
  problemId: string,
  state: ReviewState,
  source: "failed" | "struggled" | "manual"
): Promise<boolean> {
  const result = await db.query(
    `INSERT INTO review_items
         (user_id, problem_id, ease_factor, interval_days, repetitions, lapses, due_on, last_quality, last_reviewed_at, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8, CASE WHEN $9 THEN clock_timestamp() END, $10)
       ON CONFLICT (user_id, problem_id) DO NOTHING`,
    [userId, problemId, state.easeFactor, state.intervalDays, state.repetitions, state.lapses, state.dueOn, state.quality, state.reviewed, source]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateItem(db: Queryable, userId: string, problemId: string, state: ReviewState): Promise<void> {
  await db.query(
    `UPDATE review_items
        SET ease_factor = $3, interval_days = $4, repetitions = $5, lapses = $6, due_on = $7::date,
            last_quality = $8, last_reviewed_at = clock_timestamp()
      WHERE user_id = $1 AND problem_id = $2`,
    [userId, problemId, state.easeFactor, state.intervalDays, state.repetitions, state.lapses, state.dueOn, state.quality]
  );
}

/** Failed submissions after `since` (all of them when null). */
export async function failuresSince(db: Queryable, userId: string, problemId: string, since: string | null): Promise<number> {
  const result = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM submissions
      WHERE user_id = $1 AND problem_id = $2 AND status = 'failed'
        AND ($3::timestamptz IS NULL OR created_at > $3::timestamptz)`,
    [userId, problemId, since]
  );
  return result.rows[0]?.n ?? 0;
}

/** Whether hints were shown after `since` (at all when null). */
export async function hintedSince(db: Queryable, userId: string, problemId: string, since: string | null): Promise<boolean> {
  const result = await db.query(
    `SELECT 1 FROM problem_hint_views
      WHERE user_id = $1 AND problem_id = $2
        AND ($3::timestamptz IS NULL OR last_viewed_at > $3::timestamptz)`,
    [userId, problemId, since]
  );
  return result.rows.length > 0;
}

/** Every item, due first; then the least-remembered (lowest ease); then by slug. */
export async function listItems(userId: string): Promise<QueueRow[]> {
  const result = await query<QueueRow>(
    `SELECT r.problem_id, p.slug, p.title, p.difficulty, p.topics,
            r.ease_factor, r.interval_days, r.repetitions, r.lapses,
            to_char(r.due_on, 'YYYY-MM-DD') AS due_on, r.last_quality,
            r.last_reviewed_at::text AS last_reviewed_at, r.source
       FROM review_items r
       JOIN problems p ON p.id = r.problem_id
      WHERE r.user_id = $1
      ORDER BY r.due_on ASC, r.ease_factor ASC, p.slug ASC`,
    [userId]
  );
  return result.rows;
}

/** Queue a problem by hand, due on `dueOn`, with SM-2's starting state. False if already queued. */
export async function addManualItem(userId: string, problemId: string, dueOn: string): Promise<boolean> {
  const result = await query(
    `INSERT INTO review_items (user_id, problem_id, due_on, source)
       VALUES ($1, $2, $3::date, 'manual')
       ON CONFLICT (user_id, problem_id) DO NOTHING`,
    [userId, problemId, dueOn]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function deleteItem(userId: string, problemId: string): Promise<boolean> {
  const result = await query(`DELETE FROM review_items WHERE user_id = $1 AND problem_id = $2`, [userId, problemId]);
  return (result.rowCount ?? 0) > 0;
}

/** How many hints the problem has; null when the problem doesn't exist. */
export async function hintCount(problemId: string): Promise<number | null> {
  const result = await query<{ hints: string | null }>(`SELECT hints FROM problems WHERE id = $1`, [problemId]);
  if (!result.rows.length) return null;
  try {
    const parsed = JSON.parse(result.rows[0].hints ?? "[]");
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/** Hints shown so far; never decreases, so a re-render that reports fewer can't undo it. */
export async function recordHintViews(userId: string, problemId: string, count: number): Promise<number> {
  const result = await query<{ hints_viewed: number }>(
    `INSERT INTO problem_hint_views (user_id, problem_id, hints_viewed)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, problem_id) DO UPDATE
         SET hints_viewed = GREATEST(problem_hint_views.hints_viewed, EXCLUDED.hints_viewed),
             last_viewed_at = CASE WHEN EXCLUDED.hints_viewed > problem_hint_views.hints_viewed
                                   THEN NOW() ELSE problem_hint_views.last_viewed_at END
       RETURNING hints_viewed`,
    [userId, problemId, count]
  );
  return result.rows[0].hints_viewed;
}
