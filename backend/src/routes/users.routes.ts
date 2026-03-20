import { Router } from "express";
import { query } from "../db";
import { AuthRequest, requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const result = await query<{ id: string; email: string; username: string | null; name: string | null; created_at: string }>(
      "SELECT id, email, username, name, created_at FROM users WHERE id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error("Get me error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;