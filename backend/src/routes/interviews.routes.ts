import { Response, Router } from "express";
import { AuthRequest, requireAuth } from "../middleware/auth.middleware";
import { llmLimiter } from "../middleware/rate-limit.middleware";
import { UUID_REGEX, COMPANIES, normalizeCompany } from "../services/interview-state.service";
import {
  analyzeSystemDesign,
  evaluateVoiceExplanation,
  AIServiceError,
  transcribeSpeech,
} from "../services/ai.service";
import { DomainError } from "../services/errors";
import * as interviews from "../services/interviews.service";
import { DIFFICULTIES, isDifficulty, isTooLong, MAX_TEXT_CHARS } from "../services/limits";
import { createShareLink, getReplay, listShareLinks, revokeShareLink } from "../services/sharing.service";
import { getAIServiceMessage, getSingleParam, sendDomainError, sendInternalError } from "./http";
import { openEventStream } from "./sse";

const router = Router();

function sendAIServiceError(res: Response, err: AIServiceError) {
  const statusCode = err.statusCode === 429 ? 429 : 503;
  return res.status(statusCode).json({
    error: getAIServiceMessage(err),
    retryable: true,
  });
}

/**
 * Speech errors the AI service attributes to the recording itself (unreadable, silent,
 * too large, not audio). Retrying the same audio cannot succeed, so these keep their
 * status and are marked non-retryable instead of being reported as an outage.
 */
const SPEECH_CLIENT_ERRORS = new Set([400, 413, 422]);

function sendSpeechError(res: Response, err: AIServiceError) {
  if (SPEECH_CLIENT_ERRORS.has(err.statusCode)) {
    return res.status(err.statusCode).json({ error: getAIServiceMessage(err), retryable: false });
  }
  return sendAIServiceError(res, err);
}

/** Domain errors keep their status; AI-service failures are retryable 503s (429 stays 429). */
function sendInterviewError(res: Response, label: string, err: unknown) {
  if (err instanceof DomainError) return sendDomainError(res, err);
  if (err instanceof AIServiceError) return sendAIServiceError(res, err);
  return sendInternalError(res, label, err);
}

/** The body of both start endpoints. */
function parseStart(body: unknown) {
  const { company, difficulty, useResume, persona, mode } = (body ?? {}) as {
    company?: string;
    difficulty?: string;
    useResume?: boolean;
    persona?: unknown;
    mode?: unknown;
  };
  if (!company) return { error: "company is required" };
  const normalized = normalizeCompany(company);
  if (!normalized) return { error: `company must be one of: ${COMPANIES.join(", ")}` };
  if (persona !== undefined && !interviews.isPersona(persona)) {
    return { error: `persona must be one of: ${interviews.PERSONAS.join(", ")}` };
  }
  if (mode !== undefined && !interviews.isMode(mode)) {
    return { error: `mode must be one of: ${interviews.MODES.join(", ")}` };
  }
  // It goes into the opening question's prompt and retrieval query, so only the three levels.
  const level = typeof difficulty === "string" ? difficulty.trim().toLowerCase() : difficulty;
  if (level !== undefined && !isDifficulty(level)) {
    return { error: `difficulty must be one of: ${DIFFICULTIES.join(", ")}` };
  }
  return { company: normalized, difficulty: level, useResume, persona, mode };
}

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    return res.json({ sessions: await interviews.listSessions(req.user!.id) });
  } catch (err) {
    return sendInternalError(res, "List interview sessions error", err);
  }
});

router.post("/", requireAuth, llmLimiter, async (req: AuthRequest, res) => {
  const parsed = parseStart(req.body);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });
  const { company: normalizedCompany, difficulty, useResume, persona, mode } = parsed;

  try {
    const started = await interviews.startInterview({
      userId: req.user!.id,
      company: normalizedCompany,
      difficulty,
      useResume,
      persona,
      mode,
    });
    return res.status(201).json(started);
  } catch (err) {
    return sendInterviewError(res, "Create interview session error", err);
  }
});

/**
 * `POST /` with the opening question streamed (D-065). Input errors are JSON, as on
 * `POST /`; once the stream opens, the outcome is a `done` event carrying the same body
 * `POST /` returns, or an `error` event with the status it would have used.
 */
router.post("/stream", requireAuth, llmLimiter, async (req: AuthRequest, res) => {
  const parsed = parseStart(req.body);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });
  const { company: normalizedCompany, difficulty, useResume, persona, mode } = parsed;

  const stream = openEventStream(req, res);
  try {
    const started = await interviews.startInterview(
      { userId: req.user!.id, company: normalizedCompany, difficulty, useResume, persona, mode },
      stream.turn
    );
    await stream.send({ type: "done", result: started });
  } catch (err) {
    await stream.fail("Create interview session stream error", err);
  } finally {
    stream.end();
  }
});

router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const id = getSingleParam(req.params.id);

  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: "Invalid session id" });
  }

  try {
    return res.json(await interviews.getSession(id, req.user!.id));
  } catch (err) {
    return sendInterviewError(res, "Get interview session error", err);
  }
});

/** The session as a timeline: exactly what a share link of it would show (D-071). */
router.get("/:id/replay", requireAuth, async (req: AuthRequest, res) => {
  const id = getSingleParam(req.params.id);
  if (!id || !UUID_REGEX.test(id)) return res.status(400).json({ error: "Invalid session id" });
  try {
    return res.json(await getReplay(id, req.user!.id));
  } catch (err) {
    return sendInterviewError(res, "Interview replay error", err);
  }
});

const MAX_DISPLAY_NAME = 60;
const MAX_EXPIRY_DAYS = 365;

router.post("/:id/share", requireAuth, async (req: AuthRequest, res) => {
  const id = getSingleParam(req.params.id);
  if (!id || !UUID_REGEX.test(id)) return res.status(400).json({ error: "Invalid session id" });
  const { displayName, expiresInDays } = (req.body ?? {}) as { displayName?: unknown; expiresInDays?: unknown };
  const name = typeof displayName === "string" ? displayName.trim() : displayName;
  if (name !== undefined && name !== null && (typeof name !== "string" || !name || name.length > MAX_DISPLAY_NAME)) {
    return res.status(400).json({ error: `displayName must be 1-${MAX_DISPLAY_NAME} characters` });
  }
  if (
    expiresInDays !== undefined &&
    expiresInDays !== null &&
    !(typeof expiresInDays === "number" && Number.isInteger(expiresInDays) && expiresInDays >= 1 && expiresInDays <= MAX_EXPIRY_DAYS)
  ) {
    return res.status(400).json({ error: `expiresInDays must be a whole number from 1 to ${MAX_EXPIRY_DAYS}` });
  }
  try {
    const created = await createShareLink(id, req.user!.id, {
      displayName: (name as string | undefined) ?? null,
      expiresInDays: (expiresInDays as number | undefined) ?? null,
    });
    return res.status(201).json(created);
  } catch (err) {
    return sendInterviewError(res, "Create share link error", err);
  }
});

router.get("/:id/share", requireAuth, async (req: AuthRequest, res) => {
  const id = getSingleParam(req.params.id);
  if (!id || !UUID_REGEX.test(id)) return res.status(400).json({ error: "Invalid session id" });
  try {
    return res.json(await listShareLinks(id, req.user!.id));
  } catch (err) {
    return sendInterviewError(res, "List share links error", err);
  }
});

router.delete("/:id/share/:linkId", requireAuth, async (req: AuthRequest, res) => {
  const id = getSingleParam(req.params.id);
  const linkId = getSingleParam(req.params.linkId);
  if (!id || !UUID_REGEX.test(id) || !linkId || !UUID_REGEX.test(linkId)) {
    return res.status(400).json({ error: "Invalid id" });
  }
  try {
    await revokeShareLink(id, linkId, req.user!.id);
    return res.json({ ok: true });
  } catch (err) {
    return sendInterviewError(res, "Revoke share link error", err);
  }
});

router.get("/:id/report", requireAuth, llmLimiter, async (req: AuthRequest, res) => {
  const id = getSingleParam(req.params.id);

  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: "Invalid session id" });
  }

  try {
    return res.json(await interviews.getReport(id, req.user!.id));
  } catch (err) {
    return sendInterviewError(res, "Generate interview report error", err);
  }
});

router.post("/:id/answer", requireAuth, llmLimiter, async (req: AuthRequest, res) => {
  const id = getSingleParam(req.params.id);
  const { answer } = req.body as { answer?: string };

  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: "Invalid session id" });
  }

  if (!answer?.trim()) {
    return res.status(400).json({ error: "answer is required" });
  }
  if (isTooLong(answer)) {
    return res.status(400).json({ error: `answer must be at most ${MAX_TEXT_CHARS} characters` });
  }

  try {
    return res.json(await interviews.submitAnswer(id, req.user!.id, answer));
  } catch (err) {
    return sendInterviewError(res, "Submit interview answer error", err);
  }
});

/** `POST /:id/answer` with the next question streamed; same split as `POST /stream`. */
router.post("/:id/answer/stream", requireAuth, llmLimiter, async (req: AuthRequest, res) => {
  const id = getSingleParam(req.params.id);
  const { answer } = req.body as { answer?: string };

  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: "Invalid session id" });
  }

  if (!answer?.trim()) {
    return res.status(400).json({ error: "answer is required" });
  }
  if (isTooLong(answer)) {
    return res.status(400).json({ error: `answer must be at most ${MAX_TEXT_CHARS} characters` });
  }

  let turn: interviews.Turn;
  try {
    turn = await interviews.loadTurn(id, req.user!.id);
  } catch (err) {
    return sendInterviewError(res, "Submit interview answer error", err);
  }

  const stream = openEventStream(req, res);
  try {
    const outcome = await interviews.answerTurn(turn, req.user!.id, answer, stream.turn);
    await stream.send({ type: "done", result: outcome });
  } catch (err) {
    await stream.fail("Submit interview answer stream error", err);
  } finally {
    stream.end();
  }
});

/**
 * The next hint for the question being answered (D-066). Each one costs a point off that
 * answer's score; 409 with `code` when none are left or the next isn't unlocked yet.
 */
router.post("/:id/hint", requireAuth, llmLimiter, async (req: AuthRequest, res) => {
  const id = getSingleParam(req.params.id);
  const { draft } = (req.body ?? {}) as { draft?: unknown };

  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: "Invalid session id" });
  }
  if (draft !== undefined && (typeof draft !== "string" || isTooLong(draft))) {
    return res.status(400).json({ error: `draft must be a string of at most ${MAX_TEXT_CHARS} characters` });
  }

  try {
    return res.json(await interviews.requestHint(id, req.user!.id, draft));
  } catch (err) {
    return sendInterviewError(res, "Interview hint error", err);
  }
});

router.post("/speech/transcribe", requireAuth, llmLimiter, async (req: AuthRequest, res) => {
  const { audioBase64, mimeType, filename, language } = req.body as {
    audioBase64?: string;
    mimeType?: string;
    filename?: string;
    language?: string;
  };

  if (!audioBase64?.trim()) {
    return res.status(400).json({ error: "audioBase64 is required" });
  }

  try {
    const result = await transcribeSpeech({
      audioBase64,
      mimeType,
      filename,
      language,
    });
    return res.json(result);
  } catch (err) {
    if (err instanceof AIServiceError) {
      return sendSpeechError(res, err);
    }
    return sendInternalError(res, "Speech transcription error", err);
  }
});

router.post("/speech/evaluate-explanation", requireAuth, llmLimiter, async (req: AuthRequest, res) => {
  const { audioBase64, mimeType, filename, language, question, context } = req.body as {
    audioBase64?: string;
    mimeType?: string;
    filename?: string;
    language?: string;
    question?: string;
    context?: string;
  };

  if (!audioBase64?.trim()) {
    return res.status(400).json({ error: "audioBase64 is required" });
  }
  if (!question?.trim()) {
    return res.status(400).json({ error: "question is required" });
  }
  if (isTooLong(question) || isTooLong(context)) {
    return res.status(400).json({ error: `question and context must each be at most ${MAX_TEXT_CHARS} characters` });
  }

  try {
    const result = await evaluateVoiceExplanation({
      audioBase64,
      mimeType,
      filename,
      language,
      question,
      context,
    });
    return res.json(result);
  } catch (err) {
    if (err instanceof AIServiceError) {
      return sendSpeechError(res, err);
    }
    return sendInternalError(res, "Voice explanation evaluation error", err);
  }
});

router.post("/system-design/analyze", requireAuth, llmLimiter, async (req: AuthRequest, res) => {
  const { prompt, explanation, company } = req.body as {
    prompt?: string;
    explanation?: string;
    company?: string;
  };

  if (!prompt?.trim()) {
    return res.status(400).json({ error: "prompt is required" });
  }
  if (!explanation?.trim()) {
    return res.status(400).json({ error: "explanation is required" });
  }
  if (isTooLong(prompt) || isTooLong(explanation) || isTooLong(company, 100)) {
    return res.status(400).json({
      error: `prompt and explanation must each be at most ${MAX_TEXT_CHARS} characters, company at most 100`,
    });
  }

  try {
    const result = await analyzeSystemDesign({
      prompt,
      explanation,
      company,
    });
    return res.json(result);
  } catch (err) {
    if (err instanceof AIServiceError) {
      return sendAIServiceError(res, err);
    }
    return sendInternalError(res, "System design analysis error", err);
  }
});

export default router;
