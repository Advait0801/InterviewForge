import { query, type Queryable } from "../db";

export type PathSummaryRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  topic: string;
  difficulty_level: string;
  problem_count: string;
  owner_user_id: string | null;
};

export type PathRow = Omit<PathSummaryRow, "problem_count"> & { focus_json: unknown };

export type PathProblemRow = {
  problem_id: string;
  position: number;
  title: string;
  slug: string;
  difficulty: string;
};

/** The curated paths, plus the caller's own personal path (first). Never anyone else's. */
export async function listPathSummaries(userId: string | null): Promise<PathSummaryRow[]> {
  const result = await query<PathSummaryRow>(
    `SELECT lp.id, lp.slug, lp.title, lp.description, lp.topic, lp.difficulty_level,
              COUNT(lpp.id)::text AS problem_count, lp.owner_user_id
       FROM learning_paths lp
       LEFT JOIN learning_path_problems lpp ON lpp.path_id = lp.id
       WHERE lp.owner_user_id IS NULL OR lp.owner_user_id = $1
       GROUP BY lp.id
       ORDER BY (lp.owner_user_id IS NULL) ASC, lp.title ASC`,
    [userId]
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
    `SELECT id, slug, title, description, topic, difficulty_level, owner_user_id, focus_json
       FROM learning_paths WHERE slug = $1`,
    [slug]
  );
  return result.rows[0] ?? null;
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

/**
 * A passed submission completes the problem in every path that contains it: the curated
 * ones and the user's own, never another user's personal path.
 */
export async function markCompletedInEveryPath(db: Queryable, userId: string, problemId: string): Promise<void> {
  await db.query(
    `INSERT INTO user_path_progress (user_id, path_id, problem_id)
         SELECT $1, lpp.path_id, lpp.problem_id
         FROM learning_path_problems lpp
         JOIN learning_paths lp ON lp.id = lpp.path_id
         WHERE lpp.problem_id = $2
           AND (lp.owner_user_id IS NULL OR lp.owner_user_id = $1)
         ON CONFLICT (user_id, path_id, problem_id) DO NOTHING`,
    [userId, problemId]
  );
}

export type TopicStatsRow = {
  topic: string;
  submissions: number;
  failed: number;
  problems_solved: number;
  lapses: number;
  hinted_problems: number;
};

/**
 * Per topic, everything the weakness score uses (services/weakness.ts): submissions and
 * failures, problems solved, review lapses and problems where hints were shown. A queued
 * problem's enrolling failure is already a failed submission, so it isn't counted again as
 * a lapse; a later lapse (failing it again after reviewing) does count twice, on purpose.
 */
export async function topicStats(userId: string): Promise<TopicStatsRow[]> {
  const result = await query<TopicStatsRow>(
    `WITH subs AS (
       SELECT t.topic, COUNT(*)::int AS submissions,
              COUNT(*) FILTER (WHERE s.status = 'failed')::int AS failed,
              COUNT(DISTINCT s.problem_id) FILTER (WHERE s.status = 'passed')::int AS problems_solved
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id
         CROSS JOIN LATERAL unnest(p.topics) AS t(topic)
        WHERE s.user_id = $1
        GROUP BY t.topic
     ), lapses AS (
       SELECT t.topic, SUM(GREATEST(r.lapses - CASE WHEN r.source = 'failed' THEN 1 ELSE 0 END, 0))::int AS lapses
         FROM review_items r
         JOIN problems p ON p.id = r.problem_id
         CROSS JOIN LATERAL unnest(p.topics) AS t(topic)
        WHERE r.user_id = $1
        GROUP BY t.topic
     ), hinted AS (
       SELECT t.topic, COUNT(*)::int AS hinted_problems
         FROM problem_hint_views h
         JOIN problems p ON p.id = h.problem_id
         CROSS JOIN LATERAL unnest(p.topics) AS t(topic)
        WHERE h.user_id = $1
        GROUP BY t.topic
     )
     SELECT subs.topic, subs.submissions, subs.failed, subs.problems_solved,
            COALESCE(lapses.lapses, 0) AS lapses, COALESCE(hinted.hinted_problems, 0) AS hinted_problems
       FROM subs
       LEFT JOIN lapses USING (topic)
       LEFT JOIN hinted USING (topic)`,
    [userId]
  );
  return result.rows;
}

export async function submissionCount(userId: string): Promise<number> {
  const result = await query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM submissions WHERE user_id = $1`, [userId]);
  return result.rows[0]?.n ?? 0;
}

export type CandidateRow = { id: string; slug: string; title: string; difficulty: string; topics: string[] };

/** Problems the user hasn't passed. */
export async function unsolvedProblems(userId: string): Promise<CandidateRow[]> {
  const result = await query<CandidateRow>(
    `SELECT p.id, p.slug, p.title, p.difficulty, p.topics
       FROM problems p
      WHERE NOT EXISTS (
        SELECT 1 FROM submissions s WHERE s.user_id = $1 AND s.problem_id = p.id AND s.status = 'passed'
      )`,
    [userId]
  );
  return result.rows;
}

/**
 * Replace the user's personal path. The old one goes (its progress rows cascade); the new
 * one is written with its problems in order. Run inside a transaction.
 */
export async function replacePersonalPath(
  db: Queryable,
  userId: string,
  path: { slug: string; title: string; description: string; topic: string; difficultyLevel: string; focus: unknown },
  problemIds: string[]
): Promise<string> {
  await db.query(`DELETE FROM learning_paths WHERE owner_user_id = $1`, [userId]);
  const inserted = await db.query<{ id: string }>(
    `INSERT INTO learning_paths (slug, title, description, topic, difficulty_level, owner_user_id, focus_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
    [path.slug, path.title, path.description, path.topic, path.difficultyLevel, userId, JSON.stringify(path.focus)]
  );
  const pathId = inserted.rows[0].id;
  await db.query(
    `INSERT INTO learning_path_problems (path_id, problem_id, position)
       SELECT $1, problem_id, position FROM unnest($2::uuid[]) WITH ORDINALITY AS t(problem_id, position)`,
    [pathId, problemIds]
  );
  return pathId;
}
