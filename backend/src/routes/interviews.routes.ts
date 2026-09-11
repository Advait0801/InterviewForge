import { randomUUID } from "crypto";
import { Response, Router } from "express";
import { query } from "../db";
import { AuthRequest, requireAuth } from "../middleware/auth.middleware";
import { llmLimiter } from "../middleware/rate-limit.middleware";
import {
  UUID_REGEX,
  normalizeCompany,
  isValidInterviewStage,
  type InterviewStage,
  shouldAskFollowup,
  getNextStage,
  getDefaultDifficulty,
  buildEvaluationSummary,
} from "../services/interview-state.service";
import {
  analyzeSystemDesign,
  evaluateAnswer,
  evaluateVoiceExplanation,
  generateFollowup,
  generateNextQuestion,
  generateReport,
  AIServiceError,
  transcribeSpeech,
} from "../services/ai.service";

const router = Router();

type SessionRow = {
  id: string;
  user_id: string;
  company: string;
  current_stage: string;
  status: string;
  stage_turn_count: number;
  resume_grounded: boolean;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  session_id: string;
  role: string;
  stage: string;
  content: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
};

function getSingleParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function getAIServiceMessage(err: AIServiceError): string {
  if (
    typeof err.details === "object" &&
    err.details !== null &&
    "detail" in err.details &&
    typeof (err.details as { detail?: unknown }).detail === "string"
  ) {
    return (err.details as { detail: string }).detail;
  }

  return err.message;
}

function sendAIServiceError(res: Response, err: AIServiceError) {
  const statusCode = err.statusCode === 429 ? 429 : 503;
  return res.status(statusCode).json({
    error: getAIServiceMessage(err),
    retryable: true,
  });
}

/**
 * Whether this user has a resume indexed. Read from Postgres rather than asked
 * of the AI service: it is one indexed query on the request path, and it means
 * a user with no resume never causes a cross-service call at all.
 */
async function userHasResume(userId: string): Promise<boolean> {
  try {
    const result = await query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM resumes WHERE user_id = $1 AND chunk_count > 0) AS exists`,
      [userId]
    );
    return result.rows[0]?.exists === true;
  } catch (err) {
    // Personalisation is additive; never fail an interview because the lookup did.
    console.error("Resume lookup failed, continuing without grounding", err);
    return false;
  }
}

async function getSessionForUser(sessionId: string, userId: string) {
  return query<SessionRow>(
    `SELECT id, user_id, company, current_stage, status, stage_turn_count, resume_grounded,
            created_at, updated_at
     FROM interview_sessions
     WHERE id = $1 AND user_id = $2`,
    [sessionId, userId]
  );
}

async function getSessionMessages(sessionId: string) {
  return query<MessageRow>(
    `SELECT id, session_id, role, stage, content, metadata_json, created_at
     FROM interview_messages
     WHERE session_id = $1
     ORDER BY created_at ASC`,
    [sessionId]
  );
}

async function insertMessage(params: {
  sessionId: string;
  role: "assistant" | "candidate" | "system";
  stage: string;
  content: string;
  metadata: Record<string, unknown>;
}) {
  await query(
    `INSERT INTO interview_messages (session_id, role, stage, content, metadata_json)
     VALUES ($1, $2, $3, $4, $5)`,
    [params.sessionId, params.role, params.stage, params.content, JSON.stringify(params.metadata)]
  );
}

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    const result = await query<SessionRow>(
      `SELECT id, user_id, company, current_stage, status, stage_turn_count, resume_grounded,
              created_at, updated_at
       FROM interview_sessions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );
    return res.json({ sessions: result.rows });
  } catch (err) {
    console.error("List interview sessions error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, llmLimiter, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
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
    return res.status(400).json({ error: "company must be one of: amazon, google, meta, apple" });
  }

  const startingStage: InterviewStage = "behavioral";
  const stageDifficulty = difficulty ?? getDefaultDifficulty(startingStage);

  // Default on: a user who uploaded a resume expects it to be used. `false`
  // opts out explicitly, for practising a company's generic loop.
  const wantsResume = useResume !== false;
  const resumeGrounded = wantsResume && (await userHasResume(userId));

  // Minted here rather than by the database default because the question is
  // generated before the row exists, and the live-fetch limiter needs a session
  // key to bound how much one interview can spend. Generating first and
  // inserting after is deliberate: a failed generation leaves no orphan row.
  const sessionId = randomUUID();

  try {
    const nextQuestion = await generateNextQuestion({
      company: normalizedCompany,
      stage: startingStage,
      difficulty: stageDifficulty,
      user_id: userId,
      resume_grounded: resumeGrounded,
      session_id: sessionId,
    });

    await query(
      `INSERT INTO interview_sessions (id, user_id, company, current_stage, status, stage_turn_count, resume_grounded)
       VALUES ($1, $2, $3, $4, 'active', 0, $5)`,
      [sessionId, userId, normalizedCompany, startingStage, resumeGrounded]
    );

    await insertMessage({
      sessionId,
      role: "assistant",
      stage: startingStage,
      content: nextQuestion.question,
      metadata: {
        kind: "question",
        company: normalizedCompany,
        stage: startingStage,
        reasoningFocus: nextQuestion.reasoningFocus,
        expectedCompetencies: nextQuestion.expectedCompetencies,
        context: nextQuestion.context,
        resumeGrounded: nextQuestion.resumeGrounded ?? false,
        groundedIn: nextQuestion.groundedIn ?? null,
        resumeEvidence: nextQuestion.resumeEvidence ?? [],
        retrievalConfidence: nextQuestion.retrievalConfidence ?? null,
        liveIngestion: nextQuestion.liveIngestion ?? null,
      },
    });

    return res.status(201).json({
      session: {
        id: sessionId,
        company: normalizedCompany,
        currentStage: startingStage,
        status: "active",
        resumeGrounded: nextQuestion.resumeGrounded ?? false,
      },
      openingQuestion: nextQuestion,
    });
  } catch (err) {
    if (err instanceof AIServiceError) {
      return sendAIServiceError(res, err);
    }
    console.error("Create interview session error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const id = getSingleParam(req.params.id);

  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: "Invalid session id" });
  }

  try {
    const sessionResult = await getSessionForUser(id, userId);
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: "Interview session not found" });
    }

    const messagesResult = await getSessionMessages(id);
    return res.json({
      session: sessionResult.rows[0],
      messages: messagesResult.rows,
    });
  } catch (err) {
    console.error("Get interview session error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/report", requireAuth, llmLimiter, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const id = getSingleParam(req.params.id);

  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: "Invalid session id" });
  }

  try {
    const sessionResult = await getSessionForUser(id, userId);
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: "Interview session not found" });
    }

    const session = sessionResult.rows[0];
    if (session.status !== "completed") {
      return res.status(400).json({ error: "Interview is not yet completed" });
    }

    const messagesResult = await getSessionMessages(id);
    const conversation = messagesResult.rows
      .map((m) => `[${m.stage}] ${m.role}: ${m.content}`)
      .join("\n\n");

    const report = await generateReport({
      company: session.company,
      conversation,
    });

    const stageScores = report.stageScores || {};
    for (const [stage, data] of Object.entries(stageScores)) {
      const score = typeof data.score === "string" ? parseInt(data.score, 10) : data.score;
      if (!isNaN(score)) {
        await query(
          `INSERT INTO scores (user_id, category, score, max_score)
           VALUES ($1, $2, $3, 10)`,
          [userId, stage, score]
        );
      }
    }

    if (report.overallScore) {
      await query(
        `INSERT INTO scores (user_id, category, score, max_score)
         VALUES ($1, 'overall', $2, 10)`,
        [userId, report.overallScore]
      );
    }

    return res.json({
      sessionId: id,
      company: session.company,
      ...report,
    });
  } catch (err) {
    if (err instanceof AIServiceError) {
      return sendAIServiceError(res, err);
    }
    console.error("Generate interview report error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/answer", requireAuth, llmLimiter, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const id = getSingleParam(req.params.id);
  const { answer } = req.body as { answer?: string };

  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: "Invalid session id" });
  }

  if (!answer?.trim()) {
    return res.status(400).json({ error: "answer is required" });
  }

  try {
    const sessionResult = await getSessionForUser(id, userId);
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: "Interview session not found" });
    }

    const session = sessionResult.rows[0];
    if (!isValidInterviewStage(session.current_stage)) {
      return res.status(500).json({ error: "Interview session is in an invalid stage" });
    }

    if (session.status !== "active") {
      return res.status(400).json({ error: "Interview session is not active" });
    }

    const latestQuestionResult = await query<MessageRow>(
      `SELECT id, session_id, role, stage, content, metadata_json, created_at
       FROM interview_messages
       WHERE session_id = $1 AND role = 'assistant' AND stage = $2
         AND (metadata_json->>'kind' = 'question' OR metadata_json->>'kind' = 'followup')
       ORDER BY created_at DESC
       LIMIT 1`,
      [id, session.current_stage]
    );

    if (latestQuestionResult.rows.length === 0) {
      return res.status(400).json({ error: "No active interview question found" });
    }

    const latestQuestion = latestQuestionResult.rows[0];
    const normalizedCompany = normalizeCompany(session.company);
    if (!normalizedCompany) {
      return res.status(500).json({ error: "Interview session has an invalid company" });
    }

    const evaluation = await evaluateAnswer({
      company: normalizedCompany,
      stage: session.current_stage,
      question: latestQuestion.content,
      answer,
      context: String(latestQuestion.metadata_json.context ?? ""),
    });

    if (shouldAskFollowup(session.stage_turn_count) && evaluation.shouldAskFollowup) {
      const followup = await generateFollowup({
        company: normalizedCompany,
        stage: session.current_stage,
        question: latestQuestion.content,
        answer,
        evaluation,
      });

      await insertMessage({
        sessionId: id,
        role: "candidate",
        stage: session.current_stage,
        content: answer,
        metadata: { kind: "answer" },
      });

      await insertMessage({
        sessionId: id,
        role: "system",
        stage: session.current_stage,
        content: buildEvaluationSummary(evaluation),
        metadata: { kind: "evaluation", ...evaluation },
      });

      await insertMessage({
        sessionId: id,
        role: "assistant",
        stage: session.current_stage,
        content: followup.question,
        metadata: {
          kind: "followup",
          focus: followup.focus,
          reason: followup.reason,
        },
      });

      await query(
        `UPDATE interview_sessions
         SET stage_turn_count = stage_turn_count + 1, updated_at = NOW()
         WHERE id = $1`,
        [id]
      );

      return res.json({
        action: "followup",
        sessionId: id,
        stage: session.current_stage,
        evaluation,
        nextQuestion: followup,
      });
    }

    const nextStage = getNextStage(session.current_stage);
    if (nextStage === "report") {
      await insertMessage({
        sessionId: id,
        role: "candidate",
        stage: session.current_stage,
        content: answer,
        metadata: { kind: "answer" },
      });

      await insertMessage({
        sessionId: id,
        role: "system",
        stage: session.current_stage,
        content: buildEvaluationSummary(evaluation),
        metadata: { kind: "evaluation", ...evaluation },
      });

      await query(
        `UPDATE interview_sessions
         SET current_stage = 'report', status = 'completed', stage_turn_count = 0, updated_at = NOW()
         WHERE id = $1`,
        [id]
      );

      return res.json({
        action: "completed",
        sessionId: id,
        evaluation,
      });
    }

    const nextQuestion = await generateNextQuestion({
      company: normalizedCompany,
      stage: nextStage,
      difficulty: getDefaultDifficulty(nextStage),
      previousAnswer: answer,
      user_id: userId,
      // The session's own flag, not a fresh lookup: a resume deleted mid-
      // interview must stop grounding, and `resume_grounded` with no chunks
      // degrades to an ordinary question on the AI service side.
      resume_grounded: session.resume_grounded === true,
      session_id: id,
    });

    await insertMessage({
      sessionId: id,
      role: "candidate",
      stage: session.current_stage,
      content: answer,
      metadata: { kind: "answer" },
    });

    await insertMessage({
      sessionId: id,
      role: "system",
      stage: session.current_stage,
      content: buildEvaluationSummary(evaluation),
      metadata: { kind: "evaluation", ...evaluation },
    });

    await insertMessage({
      sessionId: id,
      role: "assistant",
      stage: nextStage,
      content: nextQuestion.question,
      metadata: {
        kind: "question",
        company: session.company,
        stage: nextStage,
        reasoningFocus: nextQuestion.reasoningFocus,
        expectedCompetencies: nextQuestion.expectedCompetencies,
        context: nextQuestion.context,
        resumeGrounded: nextQuestion.resumeGrounded ?? false,
        groundedIn: nextQuestion.groundedIn ?? null,
        resumeEvidence: nextQuestion.resumeEvidence ?? [],
        retrievalConfidence: nextQuestion.retrievalConfidence ?? null,
        liveIngestion: nextQuestion.liveIngestion ?? null,
      },
    });

    await query(
      `UPDATE interview_sessions
       SET current_stage = $2, stage_turn_count = 0, updated_at = NOW()
       WHERE id = $1`,
      [id, nextStage]
    );

    return res.json({
      action: "advance_stage",
      sessionId: id,
      previousStage: session.current_stage,
      currentStage: nextStage,
      evaluation,
      nextQuestion,
    });
  } catch (err) {
    if (err instanceof AIServiceError) {
      return sendAIServiceError(res, err);
    }
    console.error("Submit interview answer error", err);
    return res.status(500).json({ error: "Internal server error" });
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
      return sendAIServiceError(res, err);
    }
    console.error("Speech transcription error", err);
    return res.status(500).json({ error: "Internal server error" });
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
      return sendAIServiceError(res, err);
    }
    console.error("Voice explanation evaluation error", err);
    return res.status(500).json({ error: "Internal server error" });
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
    console.error("System design analysis error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
