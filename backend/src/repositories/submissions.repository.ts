import { query } from "../db";

export type SubmissionFilters = {
  problemId?: string;
  status?: string;
  language?: string;
};

export type SubmissionListRow = {
  id: string;
  problem_id: string;
  problem_title: string;
  language: string;
  status: string;
  runtime_ms: number | null;
  memory_kb: number | null;
  created_at: string;
};

export type SubmissionRow = {
  id: string;
  problem_id: string;
  language: string;
  code: string;
  status: string;
  runtime_ms: number | null;
  memory_kb: number | null;
  created_at: string;
};

export type ReviewSourceRow = {
  code: string;
  language: string;
  title: string;
  description: string;
  difficulty: string;
};

/** One page of a user's submissions, newest first, plus the total matching count. */
export async function listSubmissions(
  userId: string,
  filters: SubmissionFilters,
  limit: number,
  offset: number
): Promise<{ rows: SubmissionListRow[]; total: number }> {
  const conditions = ["s.user_id = $1"];
  const params: (string | number)[] = [userId];

  if (filters.problemId) {
    params.push(filters.problemId);
    conditions.push(`s.problem_id = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`s.status = $${params.length}`);
  }
  if (filters.language) {
    params.push(filters.language);
    conditions.push(`s.language = $${params.length}`);
  }

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const totalResult = await query<{ count: string }>(
    `SELECT COUNT(*) AS count
       FROM submissions s
       WHERE ${conditions.join(" AND ")}`,
    params.slice(0, offsetIdx - 2)
  );

  const result = await query<SubmissionListRow>(
    `SELECT s.id, s.problem_id, p.title AS problem_title, s.language, s.status,
              s.runtime_ms, s.memory_kb, s.created_at
       FROM submissions s
       JOIN problems p ON p.id = s.problem_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY s.created_at DESC
       LIMIT $${limitIdx}
       OFFSET $${offsetIdx}`,
    params
  );

  return { rows: result.rows, total: parseInt(totalResult.rows[0]?.count ?? "0", 10) };
}

/** The submission's code with its problem, only if it belongs to the user. */
export async function findReviewSource(id: string, userId: string): Promise<ReviewSourceRow | null> {
  const result = await query<ReviewSourceRow>(
    `SELECT s.code, s.language, p.title, p.description, p.difficulty
       FROM submissions s
       JOIN problems p ON p.id = s.problem_id
       WHERE s.id = $1 AND s.user_id = $2`,
    [id, userId]
  );
  return result.rows[0] ?? null;
}

export async function findSubmission(id: string, userId: string): Promise<SubmissionRow | null> {
  const result = await query<SubmissionRow>(
    `SELECT id, problem_id, language, code, status, runtime_ms, memory_kb, created_at
       FROM submissions WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return result.rows[0] ?? null;
}

/** The problem a user's own submission is for; null if it isn't theirs or doesn't exist. */
export async function findOwnSubmissionProblemId(id: string, userId: string): Promise<string | null> {
  const result = await query<{ problem_id: string }>(
    `SELECT problem_id FROM submissions WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return result.rows[0]?.problem_id ?? null;
}

export async function insertSubmission(row: {
  userId: string;
  problemId: string;
  language: string;
  code: string;
  status: "passed" | "failed";
  runtimeMs: number | null;
  memoryKb: number | null;
}): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO submissions (user_id, problem_id, language, code, status, runtime_ms, memory_kb)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
    [row.userId, row.problemId, row.language, row.code, row.status, row.runtimeMs, row.memoryKb]
  );
  return result.rows[0].id;
}
