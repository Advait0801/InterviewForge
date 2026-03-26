import { Router } from "express";
import { query } from "../db";
import { AuthRequest, requireAuth } from "../middleware/auth.middleware";
import { hashPassword, verifyPassword } from "../auth";

const router = Router();

const MIN_PASSWORD_LENGTH = 6;

router.post("/change-password", requireAuth, async (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current password and new password are required" });
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({ error: "New password must be different from current password" });
  }

  try {
    const userId = req.user!.id;
    const result = await query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const ok = await verifyPassword(currentPassword, result.rows[0].password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const passwordHash = await hashPassword(newPassword);
    await query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [passwordHash, userId]);

    return res.json({ ok: true });
  } catch (err) {
    console.error("Change password error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

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

router.get("/stats", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    const [problemsRes, interviewsRes, streakRes] = await Promise.all([
      query<{ count: string }>(
        "SELECT COUNT(DISTINCT problem_id) AS count FROM submissions WHERE user_id = $1",
        [userId],
      ),
      query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM interview_sessions WHERE user_id = $1",
        [userId],
      ),
      query<{ best_streak: string | null }>(
        `WITH activity_dates AS (
           SELECT DISTINCT created_at::date AS d FROM submissions WHERE user_id = $1
           UNION
           SELECT DISTINCT created_at::date AS d FROM interview_sessions WHERE user_id = $1
         ),
         grouped AS (
           SELECT d, d - (ROW_NUMBER() OVER (ORDER BY d))::int AS grp FROM activity_dates
         )
         SELECT COALESCE(MAX(streak), 0) AS best_streak FROM (
           SELECT COUNT(*) AS streak FROM grouped GROUP BY grp
         ) t`,
        [userId],
      ),
    ]);

    return res.json({
      problemsAttempted: parseInt(problemsRes.rows[0].count, 10),
      interviewsStarted: parseInt(interviewsRes.rows[0].count, 10),
      bestStreak: parseInt(streakRes.rows[0].best_streak ?? "0", 10),
    });
  } catch (err) {
    console.error("Get user stats error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;