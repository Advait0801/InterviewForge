import { query } from "../db";

/**
 * Per-user aggregates over submissions and interview sessions: counts, streaks, the
 * activity heatmap and analytics. Streaks are computed at query time (gaps-and-islands
 * over distinct activity days), so there is nothing to keep in sync on write.
 */

export async function countAttemptedProblems(userId: string): Promise<number> {
  const result = await query<{ count: string }>(
    "SELECT COUNT(DISTINCT problem_id) AS count FROM submissions WHERE user_id = $1",
    [userId],
  );
  return parseInt(result.rows[0].count, 10);
}

export async function countSolvedProblems(userId: string): Promise<number> {
  const result = await query<{ count: string }>(
    "SELECT COUNT(DISTINCT problem_id) AS count FROM submissions WHERE user_id = $1 AND status = 'passed'",
    [userId],
  );
  return parseInt(result.rows[0].count, 10);
}

export async function countInterviews(userId: string): Promise<number> {
  const result = await query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM interview_sessions WHERE user_id = $1",
    [userId],
  );
  return parseInt(result.rows[0]?.count ?? "0", 10);
}

export async function bestStreak(userId: string): Promise<number> {
  const result = await query<{ best_streak: string | null }>(
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
  );
  return parseInt(result.rows[0].best_streak ?? "0", 10);
}

/** Best streak, plus the streak ending today or yesterday (0 if broken). */
export async function streaks(userId: string): Promise<{ best: number; current: number }> {
  const result = await query<{ best_streak: string; current_streak: string }>(
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
           COALESCE((SELECT streak FROM streaks WHERE last_day >= CURRENT_DATE - 1 ORDER BY last_day DESC LIMIT 1), 0) AS current_streak
         FROM streaks`,
    [userId],
  );
  return {
    best: parseInt(result.rows[0]?.best_streak ?? "0", 10),
    current: parseInt(result.rows[0]?.current_streak ?? "0", 10),
  };
}

export async function submissionTotals(
  userId: string
): Promise<{ submissions: number; accepted: number; attempted: number }> {
  const result = await query<{ submissions_count: string; accepted_count: string; attempted_count: string }>(
    `SELECT COUNT(*) AS submissions_count,
                COUNT(*) FILTER (WHERE status = 'passed') AS accepted_count,
                COUNT(DISTINCT problem_id) AS attempted_count
         FROM submissions
         WHERE user_id = $1`,
    [userId]
  );
  return {
    submissions: parseInt(result.rows[0]?.submissions_count ?? "0", 10),
    accepted: parseInt(result.rows[0]?.accepted_count ?? "0", 10),
    attempted: parseInt(result.rows[0]?.attempted_count ?? "0", 10),
  };
}

export async function acceptanceTotals(userId: string): Promise<{ submissions: number; accepted: number }> {
  const result = await query<{ submissions_count: string; accepted_count: string }>(
    `SELECT COUNT(*) AS submissions_count,
                COUNT(*) FILTER (WHERE status = 'passed') AS accepted_count
         FROM submissions
         WHERE user_id = $1`,
    [userId],
  );
  return {
    submissions: parseInt(result.rows[0]?.submissions_count ?? "0", 10),
    accepted: parseInt(result.rows[0]?.accepted_count ?? "0", 10),
  };
}

export async function countSolvedProblemsForProfile(userId: string): Promise<number> {
  const result = await query<{ solved_count: string }>(
    "SELECT COUNT(DISTINCT problem_id) AS solved_count FROM submissions WHERE user_id = $1 AND status = 'passed'",
    [userId]
  );
  return parseInt(result.rows[0]?.solved_count ?? "0", 10);
}

/** Activity count per day over the last year, keyed by YYYY-MM-DD. */
export async function activityByDay(userId: string): Promise<Record<string, number>> {
  const result = await query<{ d: string; cnt: string }>(
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
  );
  const activityMap: Record<string, number> = {};
  for (const row of result.rows) {
    activityMap[row.d] = parseInt(row.cnt, 10);
  }
  return activityMap;
}

export type RecentActivityRow = {
  type: "submission" | "interview";
  title: string;
  status: string | null;
  created_at: string;
};

export async function recentActivity(userId: string): Promise<RecentActivityRow[]> {
  const result = await query<RecentActivityRow>(
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
    [userId]
  );
  return result.rows;
}

export async function solvedOverTime(userId: string): Promise<{ day: string; count: string }[]> {
  const result = await query<{ day: string; count: string }>(
    `SELECT created_at::date AS day, COUNT(DISTINCT problem_id) AS count
         FROM submissions
         WHERE user_id = $1 AND status = 'passed' AND created_at >= CURRENT_DATE - INTERVAL '90 days'
         GROUP BY day ORDER BY day`,
    [userId],
  );
  return result.rows;
}

export async function solvedByDifficulty(userId: string): Promise<{ difficulty: string; count: string }[]> {
  const result = await query<{ difficulty: string; count: string }>(
    `SELECT p.difficulty, COUNT(DISTINCT s.problem_id) AS count
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id
         WHERE s.user_id = $1 AND s.status = 'passed'
         GROUP BY p.difficulty`,
    [userId],
  );
  return result.rows;
}

export async function topSolvedTopics(userId: string): Promise<{ topic: string; count: string }[]> {
  const result = await query<{ topic: string; count: string }>(
    `SELECT UNNEST(p.topics) AS topic, COUNT(DISTINCT s.problem_id) AS count
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id
         WHERE s.user_id = $1 AND s.status = 'passed'
         GROUP BY topic
         ORDER BY count DESC
         LIMIT 10`,
    [userId],
  );
  return result.rows;
}

export async function weeklyAcceptance(userId: string): Promise<{ week: string; rate: string }[]> {
  const result = await query<{ week: string; rate: string }>(
    `SELECT DATE_TRUNC('week', created_at)::date AS week,
                CASE WHEN COUNT(*) > 0
                  THEN (COUNT(*) FILTER (WHERE status = 'passed') * 100 / COUNT(*))
                  ELSE 0
                END AS rate
         FROM submissions
         WHERE user_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '12 weeks'
         GROUP BY week ORDER BY week`,
    [userId],
  );
  return result.rows;
}
