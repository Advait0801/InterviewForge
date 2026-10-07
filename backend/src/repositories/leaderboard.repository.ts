import { query } from "../db";

export type RankingRow = {
  username: string;
  name: string | null;
  avatar_url: string | null;
  solved: string;
  submissions_count: string;
  accepted_count: string;
};

/** Users with at least one submission: everyone the leaderboard can rank. */
export async function countRankedUsers(): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(DISTINCT user_id) AS count FROM submissions`,
  );
  return parseInt(result.rows[0]?.count ?? "0", 10);
}

/** Aggregates every submission on each call; no index helps (D-053). */
export async function listRankings(limit: number, offset: number): Promise<RankingRow[]> {
  const result = await query<RankingRow>(
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
  return result.rows;
}
