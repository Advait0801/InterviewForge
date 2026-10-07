import * as leaderboard from "../repositories/leaderboard.repository";

/** One page of the leaderboard, ranked by distinct problems solved. */
export async function getLeaderboardPage(page: number, limit: number) {
  const offset = (page - 1) * limit;
  const total = await leaderboard.countRankedUsers();
  const rows = await leaderboard.listRankings(limit, offset);

  const entries = rows.map((r, i) => {
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

  return { leaderboard: entries, total, page, limit };
}
