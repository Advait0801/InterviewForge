import { Router } from "express";
import { AuthRequest, requireAuth } from "../middleware/auth.middleware";
import { llmLimiter } from "../middleware/rate-limit.middleware";
import { AIServiceError } from "../services/ai.service";
import { DomainError } from "../services/errors";
import {
  executeSubmission,
  getSubmission,
  listSubmissions,
  reviewSubmission,
} from "../services/submissions.service";
import { UUID_REGEX, sendDomainError, sendInternalError } from "./http";

const router = Router();

/** What code-runner executes (code-runner/src/types.ts SupportedLanguage). */
const LANGUAGES = ["python3", "c", "cpp", "java", "javascript", "go", "rust"] as const;
const MODES = ["run", "submit"] as const;
/** Custom inputs per Run, and characters per input. */
const MAX_CUSTOM_INPUTS = 10;
const MAX_CUSTOM_INPUT_LENGTH = 10_000;

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const problemId = req.query.problemId as string | undefined;
  const status = req.query.status as string | undefined;
  const language = req.query.language as string | undefined;
  const parsedLimit = Number(req.query.limit ?? 50);
  const parsedOffset = Number(req.query.offset ?? 0);
  const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 200)) : 50;
  const offset = Number.isFinite(parsedOffset) ? Math.max(0, parsedOffset) : 0;

  if (problemId && !UUID_REGEX.test(problemId)) {
    return res.status(400).json({ error: "Invalid problemId" });
  }
  if (status && !["passed", "failed"].includes(status)) {
    return res.status(400).json({ error: "Invalid status filter" });
  }

  try {
    return res.json(await listSubmissions(userId, { problemId, status, language }, limit, offset));
  } catch (err) {
    return sendInternalError(res, "List submissions error", err);
  }
});

router.post("/:id/review", requireAuth, llmLimiter, async (req: AuthRequest, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];

  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: "Invalid submission id" });
  }

  try {
    return res.json({ review: await reviewSubmission(id, req.user!.id) });
  } catch (err) {
    if (err instanceof DomainError) return sendDomainError(res, err);
    if (err instanceof AIServiceError) {
      return res.status(err.statusCode >= 500 ? 503 : err.statusCode).json({
        error: err.message,
        details: err.details,
      });
    }
    return sendInternalError(res, "AI review error", err);
  }
});

router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];

  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: "Invalid submission id" });
  }

  try {
    return res.json({ submission: await getSubmission(id, req.user!.id) });
  } catch (err) {
    if (err instanceof DomainError) return sendDomainError(res, err);
    return sendInternalError(res, "Get submission error", err);
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { problemId, language, code, mode = "submit", customInputs } = req.body as {
    problemId?: string;
    language?: string;
    code?: string;
    mode?: "run" | "submit";
    customInputs?: unknown;
  };

  if (!problemId || !language || !code) {
    return res.status(400).json({
      error: "problemId, language, and code are required",
    });
  }
  // Checked here rather than left to Postgres and the runner (D-056): a malformed id
  // was a 500 from the uuid cast, and an unsupported language reached the runner and
  // came back as a misleading "Code runner unavailable".
  if (!UUID_REGEX.test(problemId)) {
    return res.status(400).json({ error: "Invalid problemId" });
  }
  if (!(LANGUAGES as readonly string[]).includes(language)) {
    return res.status(400).json({ error: `language must be one of: ${LANGUAGES.join(", ")}` });
  }
  if (!(MODES as readonly string[]).includes(mode)) {
    return res.status(400).json({ error: "mode must be run or submit" });
  }
  if (customInputs !== undefined) {
    if (mode !== "run") {
      // Submit is judged on the problem's own suite only.
      return res.status(400).json({ error: "customInputs are only accepted with mode run" });
    }
    if (
      !Array.isArray(customInputs) ||
      customInputs.length > MAX_CUSTOM_INPUTS ||
      !customInputs.every(
        (i) => typeof i === "string" && i.trim().length > 0 && i.length <= MAX_CUSTOM_INPUT_LENGTH
      )
    ) {
      return res.status(400).json({
        error: `customInputs must be up to ${MAX_CUSTOM_INPUTS} non-empty strings of at most ${MAX_CUSTOM_INPUT_LENGTH} characters`,
      });
    }
  }

  try {
    const { status, body } = await executeSubmission({
      userId,
      problemId,
      language,
      code,
      mode,
      customInputs: customInputs as string[] | undefined,
    });
    return res.status(status).json(body);
  } catch (err) {
    if (err instanceof DomainError) return sendDomainError(res, err);
    return sendInternalError(res, "Submission error", err);
  }
});

export default router;
