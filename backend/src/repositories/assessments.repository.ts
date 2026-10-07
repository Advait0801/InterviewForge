import { query, type Queryable } from "../db";

export type AssessmentRow = {
  id: string;
  user_id: string;
  status: string;
  time_limit_minutes: number;
  difficulty_mix: string;
  problem_count: number;
  started_at: string;
  finished_at: string | null;
  score: number | null;
  created_at: string;
};

export type AssessmentProblemRow = {
  id: string;
  assessment_id: string;
  problem_id: string;
  problem_order: number;
  submission_id: string | null;
  title: string;
  slug: string;
  difficulty: string;
  submission_status: string | null;
};

export async function listAssessments(userId: string): Promise<AssessmentRow[]> {
  const result = await query<AssessmentRow>(
    `SELECT id, user_id, status, time_limit_minutes, difficulty_mix, problem_count,
              started_at, finished_at, score, created_at
       FROM assessments
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
    [userId]
  );
  return result.rows;
}

export async function insertAssessment(
  db: Queryable,
  row: { userId: string; timeLimitMinutes: number; difficultyMix: string; problemCount: number }
): Promise<string> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO assessments (user_id, status, time_limit_minutes, difficulty_mix, problem_count, started_at)
         VALUES ($1, 'active', $2, $3, $4, NOW())
         RETURNING id`,
    [row.userId, row.timeLimitMinutes, row.difficultyMix, row.problemCount]
  );
  return result.rows[0].id;
}

export async function insertAssessmentProblem(
  db: Queryable,
  assessmentId: string,
  problemId: string,
  order: number
): Promise<void> {
  await db.query(
    `INSERT INTO assessment_problems (assessment_id, problem_id, problem_order)
           VALUES ($1, $2, $3)`,
    [assessmentId, problemId, order]
  );
}

export async function findAssessment(id: string, userId: string): Promise<AssessmentRow | null> {
  const result = await query<AssessmentRow>(
    `SELECT id, user_id, status, time_limit_minutes, difficulty_mix, problem_count,
              started_at, finished_at, score, created_at
       FROM assessments
       WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return result.rows[0] ?? null;
}

export async function listAssessmentProblems(assessmentId: string): Promise<AssessmentProblemRow[]> {
  const result = await query<AssessmentProblemRow>(
    `SELECT ap.id, ap.assessment_id, ap.problem_id, ap.problem_order, ap.submission_id,
              p.title, p.slug, p.difficulty,
              s.status AS submission_status
       FROM assessment_problems ap
       JOIN problems p ON p.id = ap.problem_id
       LEFT JOIN submissions s ON s.id = ap.submission_id
       WHERE ap.assessment_id = $1
       ORDER BY ap.problem_order ASC`,
    [assessmentId]
  );
  return result.rows;
}

/**
 * Status plus whether the deadline (with grace) has passed. `expired` is computed by
 * Postgres so the deadline uses the same clock as started_at, not this server's (D-057).
 */
export async function findDeadlineState(
  id: string,
  userId: string,
  graceSeconds: number
): Promise<{ status: string; expired: boolean } | null> {
  const result = await query<AssessmentRow & { expired: boolean }>(
    `SELECT id, user_id, status, started_at, time_limit_minutes,
              NOW() > started_at + make_interval(mins => time_limit_minutes) + $3::interval AS expired
       FROM assessments WHERE id = $1 AND user_id = $2`,
    [id, userId, `${graceSeconds} seconds`]
  );
  const row = result.rows[0];
  return row ? { status: row.status, expired: row.expired } : null;
}

/** Returns false when the problem isn't part of the assessment. */
export async function linkSubmission(assessmentId: string, problemId: string, submissionId: string): Promise<boolean> {
  const result = await query(
    `UPDATE assessment_problems SET submission_id = $1
       WHERE assessment_id = $2 AND problem_id = $3`,
    [submissionId, assessmentId, problemId]
  );
  return result.rowCount !== 0;
}

export async function findStatus(id: string, userId: string): Promise<string | null> {
  const result = await query<AssessmentRow>(
    `SELECT id, user_id, status FROM assessments WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return result.rows[0]?.status ?? null;
}

export async function linkedSubmissionStatuses(assessmentId: string): Promise<(string | null)[]> {
  const result = await query<{ submission_status: string | null }>(
    `SELECT s.status AS submission_status
       FROM assessment_problems ap
       LEFT JOIN submissions s ON s.id = ap.submission_id
       WHERE ap.assessment_id = $1`,
    [assessmentId]
  );
  return result.rows.map((r) => r.submission_status);
}

export async function complete(id: string, score: number): Promise<void> {
  await query(
    `UPDATE assessments SET status = 'completed', finished_at = NOW(), score = $2 WHERE id = $1`,
    [id, score]
  );
}
