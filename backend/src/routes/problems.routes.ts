import { Router } from "express";
import { query } from "../db";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const result = await query<{
      id: string;
      slug: string;
      title: string;
      description: string;
      difficulty: string;
      created_at: string;
    }>(
      `SELECT id, slug, title, description, difficulty, created_at
       FROM problems
       ORDER BY difficulty, created_at`
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
      test_cases: unknown;
      starter_code: unknown;
      created_at: string;
    }>(
      `SELECT id, slug, title, description, difficulty, test_cases, starter_code, created_at
       FROM problems
       WHERE id = $1`,
      [id]
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