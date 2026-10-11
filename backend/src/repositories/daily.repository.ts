import { query } from "../db";

export type CatalogueRow = { id: string; slug: string; difficulty: string };

export type DailyRow = {
  day: string;
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  topics: string[];
};

/** Every problem, for the daily pick (services/daily.ts). */
export async function catalogue(): Promise<CatalogueRow[]> {
  const result = await query<CatalogueRow>(`SELECT id, slug, difficulty FROM problems`);
  return result.rows;
}

/** Recorded days in [from, to], newest first. */
export async function recordedDays(from: string, to: string): Promise<DailyRow[]> {
  const result = await query<DailyRow>(
    `SELECT to_char(d.day, 'YYYY-MM-DD') AS day, p.id, p.slug, p.title, p.difficulty, p.topics
       FROM daily_problems d
       JOIN problems p ON p.id = d.problem_id
       WHERE d.day BETWEEN $1::date AND $2::date
       ORDER BY d.day DESC`,
    [from, to]
  );
  return result.rows;
}

/**
 * Record picks for days not yet recorded. A day already recorded keeps its problem: of two
 * concurrent first requests, the first insert wins and both read it back.
 */
export async function recordDays(picks: Array<{ day: string; problemId: string }>): Promise<void> {
  if (!picks.length) return;
  await query(
    `INSERT INTO daily_problems (day, problem_id)
       SELECT * FROM unnest($1::date[], $2::uuid[])
       ON CONFLICT (day) DO NOTHING`,
    [picks.map((p) => p.day), picks.map((p) => p.problemId)]
  );
}

/**
 * Days on which the user solved that day's problem, that same (UTC) day. Solving it later
 * from the history doesn't count towards the daily streak.
 */
export async function daysSolvedOnTheDay(userId: string, from?: string, to?: string): Promise<string[]> {
  const result = await query<{ day: string }>(
    `SELECT DISTINCT to_char(d.day, 'YYYY-MM-DD') AS day
       FROM daily_problems d
       JOIN submissions s
         ON s.problem_id = d.problem_id
        AND s.user_id = $1
        AND s.status = 'passed'
        AND (s.created_at AT TIME ZONE 'UTC')::date = d.day
       WHERE ($2::date IS NULL OR d.day >= $2::date)
         AND ($3::date IS NULL OR d.day <= $3::date)`,
    [userId, from ?? null, to ?? null]
  );
  return result.rows.map((r) => r.day);
}

/** Of these problems, the ones the user has ever passed. */
export async function solvedAmong(userId: string, problemIds: string[]): Promise<Set<string>> {
  if (!problemIds.length) return new Set();
  const result = await query<{ problem_id: string }>(
    `SELECT DISTINCT problem_id FROM submissions
       WHERE user_id = $1 AND status = 'passed' AND problem_id = ANY($2::uuid[])`,
    [userId, problemIds]
  );
  return new Set(result.rows.map((r) => r.problem_id));
}
