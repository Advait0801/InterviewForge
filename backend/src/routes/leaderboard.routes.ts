import { Router } from "express";
import { query } from "../db";

const router = Router();

router.get("/", async (req, res) => {
  const parsedPage = Number(req.query.page ?? 1);
  const parsedLimit = Number(req.query.limit ?? 20);
  const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
  const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 100)) : 20;
  const offset = (page - 1) * limit;

  try {
    const totalRes = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT user_id) AS count FROM submissions`,
    );
    const total = parseInt(totalRes.rows[0]?.count ?? "0", 10);

    const rows = await query<{
      username: string;
      name: string | null;
      avatar_url: string | null;
      solved: string;
      submissions_count: string;
      accepted_count: string;
    }>(
      `SELECT
         u.username,
         u.name,
         u.avatar_url,
         COUNT(DISTINCT s.problem_id) FILTER (WHERE s.status = 'passed') AS solved,
         COUNT(*) AS submissions_count,
         COUNT(*) FILTER (WHERE s.status = 'passed') AS accepted_count
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       GROUP BY u.id, u.username, u.name, u.avatar_url
       ORDER BY solved DESC, accepted_count DESC, u.username ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    const leaderboard = rows.rows.map((r, i) => {
      const subs = parseInt(r.submissions_count, 10);
      const acc = parseInt(r.accepted_count, 10);
      return {
        rank: offset + i + 1,
        username: r.username,
        name: r.name,
        avatar_url: r.avatar_url,
        solved: parseInt(r.solved, 10),
        acceptanceRate: subs > 0 ? Math.round((acc / subs) * 100) : 0,
      };
    });

    return res.json({ leaderboard, total, page, limit });
  } catch (err) {
    console.error("Leaderboard error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
