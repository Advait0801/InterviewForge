import { query } from "../db";

export type ResumeRow = {
  id: string;
  user_id: string;
  filename: string;
  byte_size: number;
  page_count: number;
  char_count: number;
  chunk_count: number;
  sections: string[];
  created_at: string;
  updated_at: string;
};

export async function findResume(userId: string): Promise<ResumeRow | null> {
  const result = await query<ResumeRow>(
    `SELECT id, user_id, filename, byte_size, page_count, char_count, chunk_count,
              sections, created_at, updated_at
       FROM resumes WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function findResumeId(userId: string): Promise<string | null> {
  const result = await query<{ id: string }>(
    `SELECT id FROM resumes WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0]?.id ?? null;
}

/** One resume per user: a re-upload replaces the row in place, keeping its id. */
export async function upsertResume(row: {
  id: string;
  userId: string;
  filename: string;
  byteSize: number;
  pageCount: number;
  charCount: number;
  chunkCount: number;
  sections: string[];
}): Promise<ResumeRow> {
  const result = await query<ResumeRow>(
    `INSERT INTO resumes (id, user_id, filename, byte_size, page_count, char_count, chunk_count, sections)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id) DO UPDATE
         SET filename = EXCLUDED.filename,
             byte_size = EXCLUDED.byte_size,
             page_count = EXCLUDED.page_count,
             char_count = EXCLUDED.char_count,
             chunk_count = EXCLUDED.chunk_count,
             sections = EXCLUDED.sections,
             updated_at = NOW()
       RETURNING id, user_id, filename, byte_size, page_count, char_count, chunk_count,
                 sections, created_at, updated_at`,
    [
      row.id,
      row.userId,
      row.filename,
      row.byteSize,
      row.pageCount,
      row.charCount,
      row.chunkCount,
      JSON.stringify(row.sections),
    ]
  );
  return result.rows[0];
}

export async function deleteResume(userId: string): Promise<void> {
  await query(`DELETE FROM resumes WHERE user_id = $1`, [userId]);
}

/** Whether the user has a resume with indexed chunks: one indexed query, no AI call. */
export async function hasIndexedResume(userId: string): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM resumes WHERE user_id = $1 AND chunk_count > 0) AS exists`,
    [userId]
  );
  return result.rows[0]?.exists === true;
}
