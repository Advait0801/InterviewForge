import { Router } from "express";
import { query } from "../db";
import { AuthRequest, requireAuth } from "../middleware/auth.middleware";
import { hashPassword, verifyPassword } from "../auth";

const router = Router();

const MIN_PASSWORD_LENGTH = 6;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,32}$/;
const AVATAR_MAX_BYTES = 500_000;
const AVATAR_MIME_RE = /^data:image\/(jpeg|png|webp);base64,/;

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
    const result = await query<{ password_hash: string | null }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const hash = result.rows[0].password_hash;
    if (!hash) {
      return res.status(400).json({
        error: "No password is set for this account. Use Forgot password with your email to create one.",
      });
    }

    const ok = await verifyPassword(currentPassword, hash);
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
    const result = await query<{ id: string; email: string; username: string | null; name: string | null; avatar_url: string | null; created_at: string }>(
      "SELECT id, email, username, name, avatar_url, created_at FROM users WHERE id = $1",
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

router.post("/avatar", requireAuth, async (req: AuthRequest, res) => {
  const { avatar } = req.body as { avatar?: string };
  if (!avatar || typeof avatar !== "string") {
    return res.status(400).json({ error: "avatar (base64 data URI) is required" });
  }
  if (!AVATAR_MIME_RE.test(avatar)) {
    return res.status(400).json({ error: "Avatar must be a JPEG, PNG, or WebP image" });
  }
  if (Buffer.byteLength(avatar, "utf-8") > AVATAR_MAX_BYTES) {
    return res.status(400).json({ error: "Avatar must be under 500KB" });
  }
  try {
    await query("UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2", [avatar, req.user!.id]);
    return res.json({ ok: true, avatar_url: avatar });
  } catch (err) {
    console.error("Upload avatar error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/avatar", requireAuth, async (req: AuthRequest, res) => {
  try {
    await query("UPDATE users SET avatar_url = NULL, updated_at = NOW() WHERE id = $1", [req.user!.id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error("Delete avatar error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stats", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    const [problemsRes, solvedRes, interviewsRes, streakRes, acceptanceRes] = await Promise.all([
      query<{ count: string }>(
        "SELECT COUNT(DISTINCT problem_id) AS count FROM submissions WHERE user_id = $1",
        [userId],
      ),
      query<{ count: string }>(
        "SELECT COUNT(DISTINCT problem_id) AS count FROM submissions WHERE user_id = $1 AND status = 'passed'",
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
      query<{ submissions_count: string; accepted_count: string }>(
        `SELECT COUNT(*) AS submissions_count,
                COUNT(*) FILTER (WHERE status = 'passed') AS accepted_count
         FROM submissions
         WHERE user_id = $1`,
        [userId],
      ),
    ]);

    const submissionsCount = parseInt(acceptanceRes.rows[0]?.submissions_count ?? "0", 10);
    const acceptedCount = parseInt(acceptanceRes.rows[0]?.accepted_count ?? "0", 10);
    const acceptanceRate = submissionsCount > 0 ? Math.round((acceptedCount / submissionsCount) * 100) : 0;

    return res.json({
      problemsAttempted: parseInt(problemsRes.rows[0].count, 10),
      problemsSolved: parseInt(solvedRes.rows[0].count, 10),
      interviewsStarted: parseInt(interviewsRes.rows[0].count, 10),
      bestStreak: parseInt(streakRes.rows[0].best_streak ?? "0", 10),
      submissionsCount,
      acceptanceRate,
    });
  } catch (err) {
    console.error("Get user stats error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/activity", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    const [heatmapRes, streakRes] = await Promise.all([
      query<{ d: string; cnt: string }>(
        `SELECT d::text, cnt FROM (
           SELECT created_at::date AS d, COUNT(*) AS cnt
           FROM (
             SELECT created_at FROM submissions WHERE user_id = $1
             UNION ALL
             SELECT created_at FROM interview_sessions WHERE user_id = $1
           ) acts
           WHERE created_at >= CURRENT_DATE - INTERVAL '365 days'
           GROUP BY d
         ) t ORDER BY d`,
        [userId],
      ),
      query<{ best_streak: string; current_streak: string }>(
        `WITH activity_dates AS (
           SELECT DISTINCT created_at::date AS d FROM submissions WHERE user_id = $1
           UNION
           SELECT DISTINCT created_at::date AS d FROM interview_sessions WHERE user_id = $1
         ),
         grouped AS (
           SELECT d, d - (ROW_NUMBER() OVER (ORDER BY d))::int AS grp FROM activity_dates
         ),
         streaks AS (
           SELECT grp, COUNT(*) AS streak, MAX(d) AS last_day FROM grouped GROUP BY grp
         )
         SELECT
           COALESCE(MAX(streak), 0) AS best_streak,
           COALESCE((SELECT streak FROM streaks WHERE last_day >= CURRENT_DATE - 1 ORDER BY last_day DESC LIMIT 1), 0) AS current_streak`,
        [userId],
      ),
    ]);

    const activityMap: Record<string, number> = {};
    for (const row of heatmapRes.rows) {
      activityMap[row.d] = parseInt(row.cnt, 10);
    }

    return res.json({
      currentStreak: parseInt(streakRes.rows[0]?.current_streak ?? "0", 10),
      bestStreak: parseInt(streakRes.rows[0]?.best_streak ?? "0", 10),
      activityMap,
    });
  } catch (err) {
    console.error("Get activity error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    const [solvedOverTimeRes, difficultyRes, topicRes, trendRes] = await Promise.all([
      query<{ day: string; count: string }>(
        `SELECT created_at::date AS day, COUNT(DISTINCT problem_id) AS count
         FROM submissions
         WHERE user_id = $1 AND status = 'passed' AND created_at >= CURRENT_DATE - INTERVAL '90 days'
         GROUP BY day ORDER BY day`,
        [userId],
      ),
      query<{ difficulty: string; count: string }>(
        `SELECT p.difficulty, COUNT(DISTINCT s.problem_id) AS count
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id
         WHERE s.user_id = $1 AND s.status = 'passed'
         GROUP BY p.difficulty`,
        [userId],
      ),
      query<{ topic: string; count: string }>(
        `SELECT UNNEST(p.topics) AS topic, COUNT(DISTINCT s.problem_id) AS count
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id
         WHERE s.user_id = $1 AND s.status = 'passed'
         GROUP BY topic
         ORDER BY count DESC
         LIMIT 10`,
        [userId],
      ),
      query<{ week: string; rate: string }>(
        `SELECT DATE_TRUNC('week', created_at)::date AS week,
                CASE WHEN COUNT(*) > 0
                  THEN (COUNT(*) FILTER (WHERE status = 'passed') * 100 / COUNT(*))
                  ELSE 0
                END AS rate
         FROM submissions
         WHERE user_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '12 weeks'
         GROUP BY week ORDER BY week`,
        [userId],
      ),
    ]);

    const difficultyDistribution: Record<string, number> = {};
    for (const row of difficultyRes.rows) {
      difficultyDistribution[row.difficulty] = parseInt(row.count, 10);
    }

    return res.json({
      solvedOverTime: solvedOverTimeRes.rows.map((r) => ({
        day: r.day,
        count: parseInt(r.count, 10),
      })),
      difficultyDistribution,
      topicStrengths: topicRes.rows.map((r) => ({
        topic: r.topic,
        count: parseInt(r.count, 10),
      })),
      acceptanceTrend: trendRes.rows.map((r) => ({
        week: r.week,
        rate: parseInt(r.rate, 10),
      })),
    });
  } catch (err) {
    console.error("Get analytics error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:username", async (req, res) => {
  const username = req.params.username;
  if (!USERNAME_REGEX.test(username)) {
    return res.status(400).json({ error: "Invalid username" });
  }

  try {
    const userRes = await query<{ id: string; username: string; name: string | null; avatar_url: string | null; created_at: string }>(
      "SELECT id, username, name, avatar_url, created_at FROM users WHERE LOWER(username) = LOWER($1)",
      [username]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userRes.rows[0];
    const [statsRes, solvedRes, interviewsRes, recentActivityRes, activityHeatmapRes] = await Promise.all([
      query<{ submissions_count: string; accepted_count: string; attempted_count: string }>(
        `SELECT COUNT(*) AS submissions_count,
                COUNT(*) FILTER (WHERE status = 'passed') AS accepted_count,
                COUNT(DISTINCT problem_id) AS attempted_count
         FROM submissions
         WHERE user_id = $1`,
        [user.id]
      ),
      query<{ solved_count: string }>(
        "SELECT COUNT(DISTINCT problem_id) AS solved_count FROM submissions WHERE user_id = $1 AND status = 'passed'",
        [user.id]
      ),
      query<{ count: string }>("SELECT COUNT(*) AS count FROM interview_sessions WHERE user_id = $1", [user.id]),
      query<{ type: "submission" | "interview"; title: string; status: string | null; created_at: string }>(
        `SELECT activity.type, activity.title, activity.status, activity.created_at
         FROM (
           SELECT 'submission'::text AS type, p.title, s.status, s.created_at
           FROM submissions s
           JOIN problems p ON p.id = s.problem_id
           WHERE s.user_id = $1
           UNION ALL
           SELECT 'interview'::text AS type, i.company || ' interview' AS title, i.status, i.created_at
           FROM interview_sessions i
           WHERE i.user_id = $1
         ) activity
         ORDER BY activity.created_at DESC
         LIMIT 12`,
        [user.id]
      ),
      query<{ d: string; cnt: string }>(
        `SELECT d::text, cnt FROM (
           SELECT created_at::date AS d, COUNT(*) AS cnt
           FROM (
             SELECT created_at FROM submissions WHERE user_id = $1
             UNION ALL
             SELECT created_at FROM interview_sessions WHERE user_id = $1
           ) acts
           WHERE created_at >= CURRENT_DATE - INTERVAL '365 days'
           GROUP BY d
         ) t ORDER BY d`,
        [user.id],
      ),
    ]);

    const submissionsCount = parseInt(statsRes.rows[0]?.submissions_count ?? "0", 10);
    const acceptedCount = parseInt(statsRes.rows[0]?.accepted_count ?? "0", 10);

    const activityMap: Record<string, number> = {};
    for (const row of activityHeatmapRes.rows) {
      activityMap[row.d] = parseInt(row.cnt, 10);
    }

    return res.json({
      profile: {
        username: user.username,
        name: user.name,
        avatar_url: user.avatar_url,
        createdAt: user.created_at,
      },
      stats: {
        problemsAttempted: parseInt(statsRes.rows[0]?.attempted_count ?? "0", 10),
        problemsSolved: parseInt(solvedRes.rows[0]?.solved_count ?? "0", 10),
        interviewsStarted: parseInt(interviewsRes.rows[0]?.count ?? "0", 10),
        submissionsCount,
        acceptanceRate: submissionsCount > 0 ? Math.round((acceptedCount / submissionsCount) * 100) : 0,
      },
      recentActivity: recentActivityRes.rows,
      activityMap,
    });
  } catch (err) {
    console.error("Get public profile error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;