import { Response, Router } from "express";
import { AuthRequest, requireAuth } from "../middleware/auth.middleware";
import { AIServiceError } from "../services/ai.service";
import { deleteResume, getResume, uploadResume } from "../services/resumes.service";
import { sendInternalError } from "./http";

const router = Router();

// Upload limits are enforced here as well as in the parser. Base64 inflates by
// ~4/3, so a 5MB PDF arrives as ~6.7MB of JSON; anything larger is rejected
// before it is decoded rather than after.
const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_BASE64_CHARS = Math.ceil((MAX_PDF_BYTES * 4) / 3) + 1024;
const MAX_FILENAME_LENGTH = 255;

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
    return res.json({ resume: await getResume(req.user!.id) });
  } catch (err) {
    return sendInternalError(res, "Get resume error", err);
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
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

  try {
    const resume = await uploadResume(req.user!.id, {
      contentBase64: payload,
      filename: sanitizeFilename(filename),
      byteSize: Buffer.byteLength(payload, "base64"),
    });
    return res.status(201).json({ resume });
  } catch (err) {
    if (err instanceof AIServiceError) {
      return sendAIError(res, err);
    }
    return sendInternalError(res, "Upload resume error", err);
  }
});

router.delete("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const purge = await deleteResume(req.user!.id);
    return res.json({ deleted: true, ...purge });
  } catch (err) {
    if (err instanceof AIServiceError) {
      return sendAIError(res, err);
    }
    return sendInternalError(res, "Delete resume error", err);
  }
});

export default router;
