import * as leaderboard from "../repositories/leaderboard.repository";
import { cached } from "./cache";

/**
 * The ranking aggregates every submission and no index helps (D-053), so pages are cached
 * (D-063). A new submission or avatar change bumps the version; the TTL bounds anything else.
 */
const CACHE_TTL_SECONDS = 60;

/** One page of the leaderboard, ranked by distinct problems solved. */
export function getLeaderboardPage(page: number, limit: number) {
  return cached("leaderboard", `${page}:${limit}`, CACHE_TTL_SECONDS, () => computeLeaderboardPage(page, limit));
}

async function computeLeaderboardPage(page: number, limit: number) {
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
