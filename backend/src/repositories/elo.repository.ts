import { query, type Queryable } from "../db";

export type RatingRow = { topic: string; rating: number; games: number };
export type ProblemForRating = { id: string; slug: string; title: string; difficulty: string; topics: string[] };
export type RatedProblemRow = ProblemForRating & { rating: number | null; games: number | null };

/** How many submissions the user has for this problem, the one just inserted included. */
export async function countSubmissions(db: Queryable, userId: string, problemId: string): Promise<number> {
  const result = await db.query<{ attempts: number }>(
    `SELECT COUNT(*)::int AS attempts FROM submissions WHERE user_id = $1 AND problem_id = $2`,
    [userId, problemId]
  );
  return result.rows[0]?.attempts ?? 0;
}

export async function findProblemForRating(db: Queryable, problemId: string): Promise<ProblemForRating | null> {
  const result = await db.query<ProblemForRating>(
    `SELECT id, slug, title, difficulty, topics FROM problems WHERE id = $1`,
    [problemId]
  );
  return result.rows[0] ?? null;
}

/**
 * Claim the user's one rated game for this problem. False when it was already claimed: a
 * second, racing first submission waits on the primary key here and then gets nothing.
 */
export async function claimRatedGame(
  db: Queryable,
  game: {
    userId: string;
    problemId: string;
    submissionId: string;
    score: number;
    expected: number;
    userRatingBefore: number;
    problemRatingBefore: number;
    delta: number;
  }
): Promise<boolean> {
  const result = await db.query(
    `INSERT INTO rated_games (user_id, problem_id, submission_id, score, expected, user_rating_before, problem_rating_before, delta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, problem_id) DO NOTHING
       RETURNING user_id`,
    [game.userId, game.problemId, game.submissionId, game.score, game.expected, game.userRatingBefore, game.problemRatingBefore, game.delta]
  );
  return result.rows.length > 0;
}

/** The problem's rating row, created from `start` if it has never been played, and locked. */
export async function lockProblemRating(db: Queryable, problemId: string, start: number): Promise<{ rating: number; games: number }> {
  await db.query(
    `INSERT INTO problem_ratings (problem_id, rating, games) VALUES ($1, $2, 0) ON CONFLICT (problem_id) DO NOTHING`,
    [problemId, start]
  );
  const result = await db.query<{ rating: number; games: number }>(
    `SELECT rating, games FROM problem_ratings WHERE problem_id = $1 FOR UPDATE`,
    [problemId]
  );
  return result.rows[0];
}

/**
 * The user's ratings, with the user's row locked: two games of one user at once mustn't both
 * read the old ratings. The users row, not the rating rows, because a new user has none yet.
 *
 * NO KEY UPDATE, not UPDATE: the submission just inserted holds a KEY SHARE lock on this row
 * (its foreign key), and FOR UPDATE conflicts with another transaction's KEY SHARE, so two
 * racing first Submits deadlocked (seen live in Phase 12). NO KEY UPDATE still excludes itself.
 */
export async function lockUserRatings(db: Queryable, userId: string): Promise<RatingRow[]> {
  await db.query(`SELECT id FROM users WHERE id = $1 FOR NO KEY UPDATE`, [userId]);
  const result = await db.query<RatingRow>(
    `SELECT topic, rating, games FROM user_topic_ratings WHERE user_id = $1 ORDER BY topic`,
    [userId]
  );
  return result.rows;
}

export async function saveUserRatings(db: Queryable, userId: string, rows: RatingRow[]): Promise<void> {
  for (const r of rows) {
    await db.query(
      `INSERT INTO user_topic_ratings (user_id, topic, rating, games) VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, topic) DO UPDATE SET rating = EXCLUDED.rating, games = EXCLUDED.games, updated_at = NOW()`,
      [userId, r.topic, r.rating, r.games]
    );
  }
}

export async function saveProblemRating(db: Queryable, problemId: string, rating: { rating: number; games: number }): Promise<void> {
  await db.query(`UPDATE problem_ratings SET rating = $2, games = $3, updated_at = NOW() WHERE problem_id = $1`, [
    problemId,
    rating.rating,
    rating.games,
  ]);
}

export async function findUserRatings(userId: string): Promise<RatingRow[]> {
  const result = await query<RatingRow>(
    `SELECT topic, rating, games FROM user_topic_ratings WHERE user_id = $1 ORDER BY topic`,
    [userId]
  );
  return result.rows;
}

/** Every problem the user has never submitted, with its rating if it has been played. */
export async function listUnattemptedProblems(userId: string): Promise<RatedProblemRow[]> {
  const result = await query<RatedProblemRow>(
    `SELECT p.id, p.slug, p.title, p.difficulty, p.topics, pr.rating, pr.games
       FROM problems p
       LEFT JOIN problem_ratings pr ON pr.problem_id = p.id
       WHERE NOT EXISTS (SELECT 1 FROM submissions s WHERE s.problem_id = p.id AND s.user_id = $1)
       ORDER BY p.slug`,
    [userId]
  );
  return result.rows;
}
