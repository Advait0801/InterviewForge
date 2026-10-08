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

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    return res.json({ sessions: await interviews.listSessions(req.user!.id) });
  } catch (err) {
    return sendInternalError(res, "List interview sessions error", err);
  }
});

router.post("/", requireAuth, llmLimiter, async (req: AuthRequest, res) => {
  const { company, difficulty, useResume } = req.body as {
    company?: string;
    difficulty?: string;
    useResume?: boolean;
  };

  if (!company) {
    return res.status(400).json({ error: "company is required" });
  }

  const normalizedCompany = normalizeCompany(company);
  if (!normalizedCompany) {
    return res.status(400).json({ error: `company must be one of: ${COMPANIES.join(", ")}` });
  }

  try {
    const started = await interviews.startInterview({
      userId: req.user!.id,
      company: normalizedCompany,
      difficulty,
      useResume,
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
  const { company, difficulty, useResume } = req.body as {
    company?: string;
    difficulty?: string;
    useResume?: boolean;
  };

  if (!company) {
    return res.status(400).json({ error: "company is required" });
  }

  const normalizedCompany = normalizeCompany(company);
  if (!normalizedCompany) {
    return res.status(400).json({ error: `company must be one of: ${COMPANIES.join(", ")}` });
  }

  const stream = openEventStream(req, res);
  try {
    const started = await interviews.startInterview(
      { userId: req.user!.id, company: normalizedCompany, difficulty, useResume },
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
