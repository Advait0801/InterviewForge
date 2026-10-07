import { query } from "../db";
import type { TestCase } from "../services/test-cases";

export type SolvedFilter = "all" | "solved" | "unsolved";

export type ProblemListFilters = {
  difficulty: string;
  topic: string;
  company: string;
  search: string;
  solved: SolvedFilter;
  /** Enriches each row with is_solved / is_bookmarked when present. */
  userId: string | null;
};

export type ProblemListRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  topics: string[];
  companies: string[];
  created_at: string;
  is_solved: boolean;
  is_bookmarked: boolean;
};

export type ProblemDetailRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  hints: string | null;
  editorial: string | null;
  topics: string[];
  companies: string[];
  test_cases: TestCase[] | null;
  starter_code: unknown;
  created_at: string;
  is_solved: boolean;
  is_bookmarked: boolean;
};

export async function listProblems(filters: ProblemListFilters): Promise<ProblemListRow[]> {
  const { difficulty, topic, company, search, solved, userId } = filters;
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let userParamIdx: number | null = null;

  if (difficulty !== "all") {
    params.push(difficulty);
    conditions.push(`p.difficulty = $${params.length}`);
  }
  if (topic) {
    params.push(topic);
    conditions.push(`$${params.length} = ANY(p.topics)`);
  }
  if (company && company.toLowerCase() !== "all") {
    // Case-insensitive, so ?company=amazon and ?company=Amazon agree.
    params.push(company.toLowerCase());
    conditions.push(`EXISTS (SELECT 1 FROM unnest(p.companies) AS c WHERE LOWER(c) = $${params.length})`);
  }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    conditions.push(`(LOWER(p.title) LIKE $${params.length} OR LOWER(p.description) LIKE $${params.length})`);
  }
  if (userId) {
    params.push(userId);
    userParamIdx = params.length;
  }
  if (userParamIdx && solved !== "all") {
    const solvedCondition =
      solved === "solved"
        ? `EXISTS (SELECT 1 FROM submissions s WHERE s.user_id = $${userParamIdx} AND s.problem_id = p.id AND s.status = 'passed')`
        : `NOT EXISTS (SELECT 1 FROM submissions s WHERE s.user_id = $${userParamIdx} AND s.problem_id = p.id AND s.status = 'passed')`;
    conditions.push(solvedCondition);
  }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const solvedSelect = userParamIdx
    ? `EXISTS (
          SELECT 1 FROM submissions s
          WHERE s.user_id = $${userParamIdx} AND s.problem_id = p.id AND s.status = 'passed'
        ) AS is_solved`
    : "false AS is_solved";
  const bookmarkedSelect = userParamIdx
    ? `EXISTS (
          SELECT 1 FROM problem_bookmarks pb
          WHERE pb.user_id = $${userParamIdx} AND pb.problem_id = p.id
        ) AS is_bookmarked`
    : "false AS is_bookmarked";

  const result = await query<ProblemListRow>(
    `SELECT p.id, p.slug, p.title, p.description, p.difficulty, p.topics, p.companies, p.created_at,
              ${solvedSelect},
              ${bookmarkedSelect}
       FROM problems p
       ${whereClause}
       ORDER BY CASE p.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 ELSE 4 END, p.created_at`,
    params
  );
  return result.rows;
}

/** The full row, hidden test suite included. Callers must not return `test_cases` as is. */
export async function findProblemDetail(id: string, userId: string | null): Promise<ProblemDetailRow | null> {
  const result = await query<ProblemDetailRow>(
    `SELECT p.id, p.slug, p.title, p.description, p.difficulty, p.hints, p.editorial, p.topics, p.companies,
              p.test_cases, p.starter_code, p.created_at,
              EXISTS (
                SELECT 1 FROM submissions s
                WHERE s.problem_id = p.id
                AND s.status = 'passed'
                AND s.user_id = COALESCE($2::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
              ) AS is_solved,
              EXISTS (
                SELECT 1 FROM problem_bookmarks pb
                WHERE pb.problem_id = p.id
                AND pb.user_id = COALESCE($2::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
              ) AS is_bookmarked
       FROM problems p
       WHERE p.id = $1`,
    [id, userId]
  );
  return result.rows[0] ?? null;
}

export async function problemExists(id: string): Promise<boolean> {
  const result = await query<{ id: string }>("SELECT id FROM problems WHERE id = $1", [id]);
  return result.rows.length > 0;
}

/** What a run or submit needs: the slug for the harness and every test case. */
export async function findProblemForExecution(
  id: string
): Promise<{ id: string; slug: string; test_cases: TestCase[] } | null> {
  const result = await query<{ id: string; slug: string; test_cases: TestCase[] }>(
    "SELECT id, slug, test_cases FROM problems WHERE id = $1",
    [id]
  );
  return result.rows[0] ?? null;
}

/** Random problem ids for an assessment, optionally of one difficulty. */
export async function pickRandomProblemIds(count: number, difficulty: string | null): Promise<string[]> {
  let whereClause = "";
  const params: (string | number)[] = [count];

  if (difficulty) {
    whereClause = "WHERE difficulty = $2";
    params.push(difficulty);
  }

  const result = await query<{ id: string }>(
    `SELECT id FROM problems ${whereClause} ORDER BY RANDOM() LIMIT $1`,
    params
  );
  return result.rows.map((r) => r.id);
}
