import { Router } from "express";
import { query } from "../db";
import { AuthRequest, requireAuth } from "../middleware/auth.middleware";

const router = Router();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const result = await query<{ problem_id: string }>(
      "SELECT problem_id FROM problem_bookmarks WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    return res.json({ bookmarks: result.rows });
  } catch (err) {
    console.error("List bookmarks error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:problemId", requireAuth, async (req: AuthRequest, res) => {
  const problemId = typeof req.params.problemId === "string" ? req.params.problemId : req.params.problemId?.[0];
  if (!problemId) {
    return res.status(400).json({ error: "Invalid problem id" });
  }
  if (!UUID_REGEX.test(problemId)) {
    return res.status(400).json({ error: "Invalid problem id" });
  }
  try {
    const userId = req.user!.id;
    const exists = await query<{ id: string }>("SELECT id FROM problems WHERE id = $1", [problemId]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: "Problem not found" });
    }

    await query(
      `INSERT INTO problem_bookmarks (user_id, problem_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, problem_id) DO NOTHING`,
      [userId, problemId]
    );
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("Create bookmark error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:problemId", requireAuth, async (req: AuthRequest, res) => {
  const problemId = typeof req.params.problemId === "string" ? req.params.problemId : req.params.problemId?.[0];
  if (!problemId) {
    return res.status(400).json({ error: "Invalid problem id" });
  }
  if (!UUID_REGEX.test(problemId)) {
    return res.status(400).json({ error: "Invalid problem id" });
  }
  try {
    const userId = req.user!.id;
    await query("DELETE FROM problem_bookmarks WHERE user_id = $1 AND problem_id = $2", [userId, problemId]);
    return res.json({ ok: true });
  } catch (err) {
    console.error("Delete bookmark error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
