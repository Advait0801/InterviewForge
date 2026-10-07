import { Router } from "express";
import { AuthRequest, requireAuth } from "../middleware/auth.middleware";
import * as assessments from "../services/assessments.service";
import { DomainError } from "../services/errors";
import { UUID_REGEX, getSingleParam, sendDomainError, sendInternalError } from "./http";

const router = Router();

const DIFFICULTY_MIXES = ["mixed", "easy", "medium", "hard"];

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    return res.json({ assessments: await assessments.listAssessments(userId) });
  } catch (err) {
    return sendInternalError(res, "List assessments error", err);
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const {
    timeLimitMinutes = 60,
    problemCount = 3,
    difficultyMix = "mixed",
  } = req.body as {
    timeLimitMinutes?: number;
    problemCount?: number;
    difficultyMix?: string;
  };

  // Validated before use (D-056): a string here made Math.min/max produce NaN, and
  // `LIMIT NaN` reached Postgres as a 500.
  if (!Number.isFinite(problemCount) || !Number.isFinite(timeLimitMinutes)) {
    return res.status(400).json({ error: "problemCount and timeLimitMinutes must be numbers" });
  }
  if (!DIFFICULTY_MIXES.includes(difficultyMix)) {
    return res.status(400).json({ error: `difficultyMix must be one of: ${DIFFICULTY_MIXES.join(", ")}` });
  }

  const count = Math.min(Math.max(Math.trunc(problemCount), 1), 10);
  const timeLimit = Math.min(Math.max(Math.trunc(timeLimitMinutes), 15), 180);

  try {
    const created = await assessments.createAssessment({
      userId,
      problemCount: count,
      timeLimitMinutes: timeLimit,
      difficultyMix,
    });
    return res.status(201).json(created);
  } catch (err) {
    if (err instanceof DomainError) return sendDomainError(res, err);
    return sendInternalError(res, "Create assessment error", err);
  }
});

router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const id = getSingleParam(req.params.id);

  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: "Invalid assessment id" });
  }

  try {
    return res.json(await assessments.getAssessment(id, userId));
  } catch (err) {
    if (err instanceof DomainError) return sendDomainError(res, err);
    return sendInternalError(res, "Get assessment error", err);
  }
});

router.post("/:id/solve", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const id = getSingleParam(req.params.id);
  const { problemId, submissionId } = req.body as { problemId?: string; submissionId?: string };

  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: "Invalid assessment id" });
  }
  if (!problemId || !submissionId) {
    return res.status(400).json({ error: "problemId and submissionId are required" });
  }
  if (!UUID_REGEX.test(problemId)) {
    return res.status(400).json({ error: "Invalid problemId" });
  }
  if (!UUID_REGEX.test(submissionId)) {
    return res.status(400).json({ error: "Invalid submissionId" });
  }

  try {
    await assessments.linkSolution(id, userId, problemId, submissionId);
    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof DomainError) return sendDomainError(res, err);
    return sendInternalError(res, "Link assessment submission error", err);
  }
});

router.post("/:id/submit", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const id = getSingleParam(req.params.id);

  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: "Invalid assessment id" });
  }

  try {
    return res.json(await assessments.submitAssessment(id, userId));
  } catch (err) {
    if (err instanceof DomainError) return sendDomainError(res, err);
    return sendInternalError(res, "Submit assessment error", err);
  }
});

export default router;
