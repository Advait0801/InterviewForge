import { query } from "../db";

export async function listBookmarkedProblemIds(userId: string): Promise<{ problem_id: string }[]> {
  const result = await query<{ problem_id: string }>(
    "SELECT problem_id FROM problem_bookmarks WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  return result.rows;
}

/** Idempotent: bookmarking twice leaves one row. */
export async function addBookmark(userId: string, problemId: string): Promise<void> {
  await query(
    `INSERT INTO problem_bookmarks (user_id, problem_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, problem_id) DO NOTHING`,
    [userId, problemId]
  );
}

export async function removeBookmark(userId: string, problemId: string): Promise<void> {
  await query("DELETE FROM problem_bookmarks WHERE user_id = $1 AND problem_id = $2", [userId, problemId]);
}
