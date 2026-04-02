import { Router } from "express";
import { query } from "../db";
import { AuthRequest, optionalAuth, requireAuth } from "../middleware/auth.middleware";

const router = Router();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

router.get("/", optionalAuth, async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  try {
    const pathsRes = await query<{
      id: string;
      slug: string;
      title: string;
      description: string;
      topic: string;
      difficulty_level: string;
      problem_count: string;
    }>(
      `SELECT lp.id, lp.slug, lp.title, lp.description, lp.topic, lp.difficulty_level,
              COUNT(lpp.id)::text AS problem_count
       FROM learning_paths lp
       LEFT JOIN learning_path_problems lpp ON lpp.path_id = lp.id
       GROUP BY lp.id
       ORDER BY lp.title ASC`
    );

    let completedByPath: Record<string, number> = {};
    if (userId) {
      const progRes = await query<{ path_id: string; cnt: string }>(
        `SELECT path_id, COUNT(*)::text AS cnt
         FROM user_path_progress
         WHERE user_id = $1
         GROUP BY path_id`,
        [userId]
      );
      completedByPath = Object.fromEntries(progRes.rows.map((r) => [r.path_id, parseInt(r.cnt, 10)]));
    }

    const paths = pathsRes.rows.map((row) => ({
      id: row.slug,
      slug: row.slug,
      title: row.title,
      description: row.description,
      topic: row.topic,
      difficultyLevel: row.difficulty_level,
      problemCount: parseInt(row.problem_count, 10),
      completedCount: completedByPath[row.id] ?? 0,
    }));

    return res.json({ paths });
  } catch (err) {
    console.error("List learning paths error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:slug", optionalAuth, async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  const slug = typeof req.params.slug === "string" ? req.params.slug : "";
  if (!SLUG_REGEX.test(slug)) {
    return res.status(400).json({ error: "Invalid path slug" });
  }

  try {
    const pathRes = await query<{
      id: string;
      slug: string;
      title: string;
      description: string;
      topic: string;
      difficulty_level: string;
    }>(
      `SELECT id, slug, title, description, topic, difficulty_level FROM learning_paths WHERE slug = $1`,
      [slug]
    );

    if (pathRes.rows.length === 0) {
      return res.status(404).json({ error: "Learning path not found" });
    }

    const pathRow = pathRes.rows[0];

    const problemsRes = await query<{
      problem_id: string;
      position: number;
      title: string;
      slug: string;
      difficulty: string;
    }>(
      `SELECT p.id AS problem_id, lpp.position, p.title, p.slug, p.difficulty
       FROM learning_path_problems lpp
       JOIN problems p ON p.id = lpp.problem_id
       WHERE lpp.path_id = $1
       ORDER BY lpp.position ASC`,
      [pathRow.id]
    );

    let completedSet = new Set<string>();
    if (userId) {
      const doneRes = await query<{ problem_id: string }>(
        `SELECT problem_id FROM user_path_progress WHERE user_id = $1 AND path_id = $2`,
        [userId, pathRow.id]
      );
      completedSet = new Set(doneRes.rows.map((r) => r.problem_id));
    }

    const problems = problemsRes.rows.map((p) => ({
      problemId: p.problem_id,
      position: p.position,
      title: p.title,
      slug: p.slug,
      difficulty: p.difficulty,
      isCompleted: completedSet.has(p.problem_id),
    }));

    return res.json({
      path: {
        slug: pathRow.slug,
        title: pathRow.title,
        description: pathRow.description,
        topic: pathRow.topic,
        difficultyLevel: pathRow.difficulty_level,
        problemCount: problems.length,
        completedCount: problems.filter((x) => x.isCompleted).length,
      },
      problems,
    });
  } catch (err) {
    console.error("Get learning path error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:slug/complete/:problemId", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const slug = typeof req.params.slug === "string" ? req.params.slug : "";
  const problemId = typeof req.params.problemId === "string" ? req.params.problemId : "";

  if (!SLUG_REGEX.test(slug)) {
    return res.status(400).json({ error: "Invalid path slug" });
  }
  if (!UUID_REGEX.test(problemId)) {
    return res.status(400).json({ error: "Invalid problem id" });
  }

  try {
    const pathRes = await query<{ id: string }>(`SELECT id FROM learning_paths WHERE slug = $1`, [slug]);
    if (pathRes.rows.length === 0) {
      return res.status(404).json({ error: "Learning path not found" });
    }
    const pathId = pathRes.rows[0].id;

    const memberRes = await query(
      `SELECT 1 FROM learning_path_problems WHERE path_id = $1 AND problem_id = $2`,
      [pathId, problemId]
    );
    if (memberRes.rows.length === 0) {
      return res.status(400).json({ error: "Problem is not part of this path" });
    }

    await query(
      `INSERT INTO user_path_progress (user_id, path_id, problem_id) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, path_id, problem_id) DO NOTHING`,
      [userId, pathId, problemId]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("Complete path problem error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
