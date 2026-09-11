import { randomUUID } from "crypto";
import { Response, Router } from "express";
import { query } from "../db";
import { AuthRequest, requireAuth } from "../middleware/auth.middleware";
import {
  AIServiceError,
  deleteResumeVectors,
  ingestResume,
  type ResumeIngestResult,
} from "../services/ai.service";

const router = Router();

// Upload limits are enforced here as well as in the parser. Base64 inflates by
// ~4/3, so a 5MB PDF arrives as ~6.7MB of JSON; anything larger is rejected
// before it is decoded rather than after.
const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_BASE64_CHARS = Math.ceil((MAX_PDF_BYTES * 4) / 3) + 1024;
const MAX_FILENAME_LENGTH = 255;

type ResumeRow = {
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

/** Strip a `data:application/pdf;base64,` prefix if the browser sent one. */
export function stripDataUrlPrefix(value: string): string {
  const comma = value.indexOf(",");
  return value.startsWith("data:") && comma !== -1 ? value.slice(comma + 1) : value;
}

/**
 * The filename is user-controlled and only ever displayed or logged, so path
 * separators and control characters have no legitimate use in it.
 */
export function sanitizeFilename(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "resume.pdf";
  const cleaned = value
    .split("")
    .filter((ch) => ch.charCodeAt(0) >= 0x20 && ch !== "/" && ch !== "\\")
    .join("")
    .trim()
    .slice(0, MAX_FILENAME_LENGTH);
  return cleaned || "resume.pdf";
}

export function isBase64WithinLimit(payload: string): boolean {
  return payload.length <= MAX_BASE64_CHARS;
}

function sendAIError(res: Response, err: AIServiceError) {
  // 400/422 are the user's problem (wrong file, scanned PDF) and the detail is
  // written for them; 5xx is ours and is reported as a transient failure.
  if (err.statusCode === 400 || err.statusCode === 422) {
    const details = err.details as
      | { detail?: { code?: string; message?: string } | string }
      | undefined;
    const parsed = typeof details?.detail === "object" ? details.detail : undefined;
    return res.status(422).json({
      error: parsed?.message ?? err.message,
      code: parsed?.code ?? "resume_unprocessable",
    });
  }
  return res.status(err.statusCode === 429 ? 429 : 503).json({
    error: err.message,
    retryable: true,
  });
}

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await query<ResumeRow>(
      `SELECT id, user_id, filename, byte_size, page_count, char_count, chunk_count,
              sections, created_at, updated_at
       FROM resumes WHERE user_id = $1`,
      [req.user!.id]
    );
    return res.json({ resume: result.rows[0] ?? null });
  } catch (err) {
    console.error("Get resume error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { contentBase64, filename } = req.body as {
    contentBase64?: unknown;
    filename?: unknown;
  };

  if (typeof contentBase64 !== "string" || !contentBase64.trim()) {
    return res.status(400).json({ error: "contentBase64 is required" });
  }

  const payload = stripDataUrlPrefix(contentBase64.trim());
  if (!isBase64WithinLimit(payload)) {
    return res.status(413).json({ error: "Resume exceeds the 5MB limit" });
  }

  const byteSize = Buffer.byteLength(payload, "base64");
  const safeName = sanitizeFilename(filename);

  // Nothing is mutated until the new resume is successfully ingested.
  //
  // The obvious ordering -- upsert the row, ingest, roll back on failure -- was
  // implemented first and is wrong: uploading a scanned or corrupt PDF then
  // *destroys the good resume the user already had*, because the rollback
  // deletes the row and purges the namespace. A rejected upload must be a no-op.
  //
  // The id is reused when a resume already exists so the row id stays stable
  // across re-uploads, and minted here otherwise so the chunks can be labelled
  // before the row is written.
  let resumeId: string;
  try {
    const existing = await query<{ id: string }>(
      `SELECT id FROM resumes WHERE user_id = $1`,
      [userId]
    );
    resumeId = existing.rows[0]?.id ?? randomUUID();
  } catch (err) {
    console.error("Look up resume row error", err);
    return res.status(500).json({ error: "Internal server error" });
  }

  let ingest: ResumeIngestResult;
  try {
    ingest = await ingestResume({
      user_id: userId,
      resume_id: resumeId,
      content_base64: payload,
      filename: safeName,
    });
  } catch (err) {
    // Deliberately no rollback: the database was never touched, and the store
    // only replaces a namespace after embedding has already succeeded.
    if (err instanceof AIServiceError) {
      return sendAIError(res, err);
    }
    console.error("Resume ingest error", err);
    return res.status(500).json({ error: "Internal server error" });
  }

  try {
    const saved = await query<ResumeRow>(
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
        resumeId,
        userId,
        safeName,
        byteSize,
        ingest.pageCount,
        ingest.charCount,
        ingest.chunkCount,
        JSON.stringify(ingest.sections ?? []),
      ]
    );
    return res.status(201).json({ resume: saved.rows[0] });
  } catch (err) {
    console.error("Save resume row error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/me", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    // Vectors first. If the row went first and the purge then failed, the user
    // would see no resume while their chunks were still retrievable -- exactly
    // the failure a deletion feature exists to prevent.
    const purge = await deleteResumeVectors(userId);
    await query(`DELETE FROM resumes WHERE user_id = $1`, [userId]);
    return res.json({
      deleted: true,
      deletedChunks: purge.deletedChunks,
      remainingChunks: purge.remainingChunks,
    });
  } catch (err) {
    if (err instanceof AIServiceError) {
      return sendAIError(res, err);
    }
    console.error("Delete resume error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
