import { query } from "../db";

/** What a measurement needs: the user's own submission, its problem, its outcome. */
export type ComplexitySourceRow = {
  id: string;
  language: string;
  code: string;
  status: string;
  slug: string;
};

export type ComplexityAnalysisRow = {
  fit: unknown;
  stopped: "done" | "time_limit" | "error";
  error: string | null;
  error_at_n: number | null;
  created_at: string;
};

export async function findComplexitySource(id: string, userId: string): Promise<ComplexitySourceRow | null> {
  const result = await query<ComplexitySourceRow>(
    `SELECT s.id, s.language, s.code, s.status, p.slug
       FROM submissions s
       JOIN problems p ON p.id = s.problem_id
       WHERE s.id = $1 AND s.user_id = $2`,
    [id, userId]
  );
  return result.rows[0] ?? null;
}

export async function saveComplexityAnalysis(
  submissionId: string,
  row: { fit: unknown; stopped: string; error: string | null; errorAtN: number | null }
): Promise<ComplexityAnalysisRow> {
  const result = await query<ComplexityAnalysisRow>(
    `INSERT INTO complexity_analyses (submission_id, fit, stopped, error, error_at_n)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (submission_id) DO UPDATE
         SET fit = EXCLUDED.fit, stopped = EXCLUDED.stopped, error = EXCLUDED.error,
             error_at_n = EXCLUDED.error_at_n, created_at = NOW()
       RETURNING fit, stopped, error, error_at_n, created_at`,
    [submissionId, JSON.stringify(row.fit), row.stopped, row.error, row.errorAtN]
  );
  return result.rows[0];
}

export async function findComplexityAnalysis(submissionId: string): Promise<ComplexityAnalysisRow | null> {
  const result = await query<ComplexityAnalysisRow>(
    `SELECT fit, stopped, error, error_at_n, created_at FROM complexity_analyses WHERE submission_id = $1`,
    [submissionId]
  );
  return result.rows[0] ?? null;
}

export async function saveSubmissionReview(submissionId: string, review: unknown): Promise<void> {
  await query(
    `INSERT INTO submission_reviews (submission_id, review)
       VALUES ($1, $2)
       ON CONFLICT (submission_id) DO UPDATE SET review = EXCLUDED.review, created_at = NOW()`,
    [submissionId, JSON.stringify(review)]
  );
}

/** The reviewer's time-complexity claim from the latest stored review, if there is one. */
export async function findClaimedTimeComplexity(submissionId: string): Promise<string | null> {
  const result = await query<{ claimed: string | null }>(
    `SELECT review->>'timeComplexity' AS claimed FROM submission_reviews WHERE submission_id = $1`,
    [submissionId]
  );
  return result.rows[0]?.claimed ?? null;
}
