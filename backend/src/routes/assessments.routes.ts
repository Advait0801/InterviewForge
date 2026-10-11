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

const EVENT_KEYS = new Set(["type", "at", "chars"]);
const COUNTED = new Set(["paste", "copy"]);

/**
 * Proctoring events, batched by the browser (D-071). Strict on shape: only `type`, `at` and,
 * for a paste or copy, `chars`. Pasted text is never accepted, even if a client sends it.
 */
router.post("/:id/events", requireAuth, async (req: AuthRequest, res) => {
  const id = getSingleParam(req.params.id);
  if (!id || !UUID_REGEX.test(id)) return res.status(400).json({ error: "Invalid assessment id" });
  const events = (req.body as { events?: unknown } | undefined)?.events;
  if (!Array.isArray(events) || events.length < 1 || events.length > assessments.MAX_EVENTS_PER_BATCH) {
    return res.status(400).json({ error: `events must be 1-${assessments.MAX_EVENTS_PER_BATCH} items` });
  }
  const parsed: assessments.ProctoringEvent[] = [];
  for (const [i, raw] of events.entries()) {
    const e = raw as Record<string, unknown>;
    const fail = (why: string) => res.status(400).json({ error: `Event ${i + 1}: ${why}` });
    if (!e || typeof e !== "object" || Array.isArray(e)) return fail("must be an object");
    const extra = Object.keys(e).filter((k) => !EVENT_KEYS.has(k));
    if (extra.length) return fail(`unexpected field ${extra[0]}; only type, at and chars are accepted`);
    if (typeof e.type !== "string" || !(assessments.EVENT_TYPES as readonly string[]).includes(e.type)) {
      return fail(`type must be one of ${assessments.EVENT_TYPES.join(", ")}`);
    }
    if (typeof e.at !== "string" || Number.isNaN(Date.parse(e.at)) || !/^\d{4}-\d{2}-\d{2}T/.test(e.at)) {
      return fail("at must be an ISO 8601 timestamp");
    }
    const counted = COUNTED.has(e.type);
    if (counted && !(typeof e.chars === "number" && Number.isInteger(e.chars) && e.chars >= 0 && e.chars <= 1_000_000)) {
      return fail(`a ${e.type} needs chars, a whole number of characters`);
    }
    if (!counted && e.chars !== undefined) return fail(`chars is only for paste and copy`);
    parsed.push({ type: e.type as assessments.ProctoringEvent["type"], at: e.at, chars: counted ? (e.chars as number) : null });
  }
  try {
    return res.status(201).json(await assessments.recordEvents(id, req.user!.id, parsed));
  } catch (err) {
    if (err instanceof DomainError) return sendDomainError(res, err);
    return sendInternalError(res, "Record assessment events error", err);
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
