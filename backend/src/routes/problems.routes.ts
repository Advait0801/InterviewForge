import { Router } from "express";
import { query } from "../db";
import { verifyAccessToken } from "../auth";

const router = Router();
type SolvedFilter = "all" | "solved" | "unsolved";

function getOptionalUserId(authHeader?: string): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.substring("Bearer ".length);
    const payload = verifyAccessToken(token);
    return payload.userId;
  } catch {
    return null;
  }
}

router.get("/", async (req, res) => {
  const userId = getOptionalUserId(req.headers.authorization);
  const difficulty = typeof req.query.difficulty === "string" ? req.query.difficulty.toLowerCase() : "all";
  const topic = typeof req.query.topic === "string" ? req.query.topic.trim() : "";
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const solved = typeof req.query.solved === "string" ? req.query.solved.toLowerCase() : "all";

  if (!["all", "easy", "medium", "hard"].includes(difficulty)) {
    return res.status(400).json({ error: "Invalid difficulty filter" });
  }
  if (!["all", "solved", "unsolved"].includes(solved)) {
    return res.status(400).json({ error: "Invalid solved filter" });
  }
  if ((solved as SolvedFilter) !== "all" && !userId) {
    return res.status(401).json({ error: "Authentication required for solved filter" });
  }

  try {
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
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      conditions.push(`(LOWER(p.title) LIKE $${params.length} OR LOWER(p.description) LIKE $${params.length})`);
    }
    if (userId) {
      params.push(userId);
      userParamIdx = params.length;
    }
    if (userParamIdx && (solved as SolvedFilter) !== "all") {
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

    const result = await query<{
      id: string;
      slug: string;
      title: string;
      description: string;
      difficulty: string;
      topics: string[];
      created_at: string;
      is_solved: boolean;
      is_bookmarked: boolean;
    }>(
      `SELECT p.id, p.slug, p.title, p.description, p.difficulty, p.topics, p.created_at,
              ${solvedSelect},
              ${bookmarkedSelect}
       FROM problems p
       ${whereClause}
       ORDER BY CASE p.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 ELSE 4 END, p.created_at`,
      params
    );
    return res.json({ problems: result.rows });
  } catch (err) {
    console.error("List problems error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) {
    return res.status(400).json({ error: "Invalid problem id" });
  }
  try {
    const result = await query<{
      id: string;
      slug: string;
      title: string;
      description: string;
      difficulty: string;
      hints: string | null;
      editorial: string | null;
      topics: string[];
      companies: string[];
      test_cases: unknown;
      starter_code: unknown;
      created_at: string;
      is_solved: boolean;
      is_bookmarked: boolean;
    }>(
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
      [id, getOptionalUserId(req.headers.authorization)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Problem not found" });
    }

    return res.json({ problem: result.rows[0] });
  } catch (err) {
    console.error("Get problem error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;