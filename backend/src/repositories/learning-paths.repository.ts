import { query } from "../db";

export type PathSummaryRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  topic: string;
  difficulty_level: string;
  problem_count: string;
};

export type PathRow = Omit<PathSummaryRow, "problem_count">;

export type PathProblemRow = {
  problem_id: string;
  position: number;
  title: string;
  slug: string;
  difficulty: string;
};

export async function listPathSummaries(): Promise<PathSummaryRow[]> {
  const result = await query<PathSummaryRow>(
    `SELECT lp.id, lp.slug, lp.title, lp.description, lp.topic, lp.difficulty_level,
              COUNT(lpp.id)::text AS problem_count
       FROM learning_paths lp
       LEFT JOIN learning_path_problems lpp ON lpp.path_id = lp.id
       GROUP BY lp.id
       ORDER BY lp.title ASC`
  );
  return result.rows;
}

/**
 * Completed problems per path id. The JOIN counts only problems still in the path, so
 * progress on a problem later removed from it doesn't inflate the count.
 */
export async function completedCountsByPath(userId: string): Promise<Record<string, number>> {
  const result = await query<{ path_id: string; cnt: string }>(
    `SELECT upp.path_id, COUNT(*)::text AS cnt
         FROM user_path_progress upp
         JOIN learning_path_problems lpp
           ON lpp.path_id = upp.path_id AND lpp.problem_id = upp.problem_id
         WHERE upp.user_id = $1
         GROUP BY upp.path_id`,
    [userId]
  );
  return Object.fromEntries(result.rows.map((r) => [r.path_id, parseInt(r.cnt, 10)]));
}

export async function findPathBySlug(slug: string): Promise<PathRow | null> {
  const result = await query<PathRow>(
    `SELECT id, slug, title, description, topic, difficulty_level FROM learning_paths WHERE slug = $1`,
    [slug]
  );
  return result.rows[0] ?? null;
}

export async function findPathIdBySlug(slug: string): Promise<string | null> {
  const result = await query<{ id: string }>(`SELECT id FROM learning_paths WHERE slug = $1`, [slug]);
  return result.rows[0]?.id ?? null;
}

export async function listPathProblems(pathId: string): Promise<PathProblemRow[]> {
  const result = await query<PathProblemRow>(
    `SELECT p.id AS problem_id, lpp.position, p.title, p.slug, p.difficulty
       FROM learning_path_problems lpp
       JOIN problems p ON p.id = lpp.problem_id
       WHERE lpp.path_id = $1
       ORDER BY lpp.position ASC`,
    [pathId]
  );
  return result.rows;
}

export async function completedProblemIds(userId: string, pathId: string): Promise<Set<string>> {
  const result = await query<{ problem_id: string }>(
    `SELECT problem_id FROM user_path_progress WHERE user_id = $1 AND path_id = $2`,
    [userId, pathId]
  );
  return new Set(result.rows.map((r) => r.problem_id));
}

export async function isPathMember(pathId: string, problemId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM learning_path_problems WHERE path_id = $1 AND problem_id = $2`,
    [pathId, problemId]
  );
  return result.rows.length > 0;
}

export async function markCompleted(userId: string, pathId: string, problemId: string): Promise<void> {
  await query(
    `INSERT INTO user_path_progress (user_id, path_id, problem_id) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, path_id, problem_id) DO NOTHING`,
    [userId, pathId, problemId]
  );
}

/** A passed submission completes the problem in every path that contains it. */
export async function markCompletedInEveryPath(userId: string, problemId: string): Promise<void> {
  await query(
    `INSERT INTO user_path_progress (user_id, path_id, problem_id)
         SELECT $1, lpp.path_id, lpp.problem_id
         FROM learning_path_problems lpp
         WHERE lpp.problem_id = $2
         ON CONFLICT (user_id, path_id, problem_id) DO NOTHING`,
    [userId, problemId]
  );
}
