import type { components } from "../generated/ai-service";
import {
  Company,
  InterviewStage,
} from "./interview-state.service";

import { readEvents } from "./sse-reader";
import {
  CORRELATION_HEADER,
  getCurrentCorrelationId,
} from "../middleware/correlation.middleware";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://ai-service:8000";

export class AIServiceError extends Error {
  statusCode: number;
  details: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = "AIServiceError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

// The ai-service contract, generated from ai-service/openapi.json (D-062). Never edit these
// by hand: change the FastAPI model, re-export the spec, then `npm run gen:ai-types`.
type Schemas = components["schemas"];

export type StructuredEvaluation = Schemas["StructuredEvaluationOutput"];
export type RetrievalConfidence = Schemas["RetrievalConfidence"];
export type LiveIngestionOutcome = Schemas["LiveIngestion"];
export type ResumeEvidence = Schemas["ResumeEvidence"];
/**
 * `resumeGrounded` reflects what actually happened, not what was requested: asking for
 * grounding with no resume indexed yields a normal question with it false.
 * `liveIngestion.triggered` is how the write-back cache is observed from outside.
 */
export type StructuredQuestion = Schemas["NextQuestionResponse"];
export type StructuredFollowup = Schemas["StructuredFollowupOutput"];
export type VoiceRubricSection = Schemas["RubricSectionScore"];
export type VoiceEvaluation = Schemas["VoiceRubricOutput"];
export type SpeechTranscriptionResult = Schemas["TranscriptResponse"];
export type VoiceEvaluationResult = Schemas["VoiceEvaluationResponse"];
export type SystemDesignNode = Schemas["ArchitectureNode"];
export type SystemDesignEdge = Schemas["ArchitectureEdge"];
export type SystemDesignAnalysis = Schemas["SystemDesignAnalysisOutput"];
export type ResumeIngestResult = Schemas["ResumeIngestResponse"];
export type ResumePurgeResult = Schemas["ResumePurgeResponse"];
export type InterviewReport = Schemas["InterviewReportResponse"];
export type CodeReviewResult = Schemas["CodeReviewOutput"];
export type RecommendationAIResult = Schemas["RecommendationOutput"];

/**
 * Send a request and return the response once its status is OK; a non-OK status becomes an
 * AIServiceError carrying FastAPI's `detail`. Aborting `signal` (the client went away) rejects
 * with the abort reason itself, not an AIServiceError: nothing failed, nobody is waiting.
 */
async function send(
  method: "POST" | "DELETE",
  path: string,
  payload: unknown,
  signal?: AbortSignal
): Promise<globalThis.Response> {
  let response: globalThis.Response;
  const correlationId = getCurrentCorrelationId();
  const startedAt = Date.now();
  try {
    response = await fetch(`${AI_SERVICE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        // Propagate the request id so ai-service logs join to ours.
        ...(correlationId ? { [CORRELATION_HEADER]: correlationId } : {}),
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    console.error(
      JSON.stringify({
        level: "error",
        event: "ai_service_unreachable",
        path,
        correlationId,
        durationMs: Date.now() - startedAt,
      })
    );
    const message =
      error instanceof Error ? error.message : "AI service request failed before receiving a response";
    throw new AIServiceError(503, `AI service unavailable: ${message}`);
  }

  console.info(
    JSON.stringify({
      level: "info",
      event: "ai_service_call",
      path,
      status: response.status,
      correlationId,
      durationMs: Date.now() - startedAt,
    })
  );

  if (!response.ok) {
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }

    const message =
      typeof parsed === "object" &&
      parsed !== null &&
      "detail" in parsed &&
      typeof (parsed as { detail?: unknown }).detail === "string"
        ? (parsed as { detail: string }).detail
        : `AI service error (${response.status})`;

    throw new AIServiceError(response.status, message, parsed);
  }

  return response;
}

async function sendJson<T>(
  method: "POST" | "DELETE",
  path: string,
  payload?: unknown,
  signal?: AbortSignal
): Promise<T> {
  const response = await send(method, path, payload, signal);
  return response.json() as Promise<T>;
}

/** How a streamed question reaches its caller. `onDelta` is awaited before more is read. */
export type QuestionStreamOptions = {
  signal: AbortSignal;
  onDelta: (text: string) => Promise<void>;
};

type StreamEvent = Schemas["NextQuestionStreamEvent"] | Schemas["FollowupStreamEvent"];

/**
 * POST to one of the ai-service's `/stream` endpoints (D-065) and resolve with the `done`
 * event's result, which is exactly what the JSON endpoint returns. Failures before the stream
 * opens are AIServiceErrors from `send`, as on the JSON path; an `error` event, or a stream
 * that ends without `done`, becomes one too.
 *
 * Each delta is awaited before the next chunk is read, so a slow browser holds the read here
 * and the backpressure reaches the model (see `readEvents`).
 */
async function streamQuestion<T>(path: string, payload: unknown, options: QuestionStreamOptions): Promise<T> {
  const startedAt = Date.now();
  let firstDeltaMs: number | null = null;
  let outcome = "aborted";
  try {
    const response = await send("POST", path, payload, options.signal);
    if (!response.body) throw new AIServiceError(503, "AI service stream had no body");
    for await (const message of readEvents(response.body)) {
      const event = JSON.parse(message.data) as StreamEvent;
      if (event.type === "delta") {
        firstDeltaMs ??= Date.now() - startedAt;
        await options.onDelta(event.text);
      } else if (event.type === "done") {
        outcome = "done";
        return event.result as T;
      } else if (event.type === "error") {
        outcome = "error";
        throw new AIServiceError(event.status, event.detail, { detail: event.detail });
      }
    }
    outcome = "truncated";
    throw new AIServiceError(503, "AI service stream ended before the question was complete");
  } catch (err) {
    if (options.signal.aborted) throw options.signal.reason;
    if (outcome === "aborted") outcome = "failed";
    throw err;
  } finally {
    console.info(
      JSON.stringify({
        level: "info",
        event: "ai_service_stream",
        path,
        outcome,
        correlationId: getCurrentCorrelationId(),
        firstDeltaMs,
        durationMs: Date.now() - startedAt,
      })
    );
  }
}

/**
 * POST a request body typed by the ai-service spec. Callers pass an object literal, so an
 * unknown field (a renamed or misspelled key that FastAPI would silently drop) fails tsc.
 */
async function postJson<T, K extends keyof Schemas>(
  path: string,
  payload: Schemas[K],
  signal?: AbortSignal
): Promise<T> {
  return sendJson<T>("POST", path, payload, signal);
}

type NextQuestionParams = {
  company: Company;
  stage: InterviewStage;
  difficulty: string;
  user_id?: string;
  resume_grounded?: boolean;
  session_id?: string;
};

// previous_answer is deliberately not sent. The backend used to send it as
// `previousAnswer`, which FastAPI dropped, so the ai-service has never seen it; turning it
// on changes every later stage's retrieval query and needs the eval harness (D-062).
const nextQuestionBody = (params: NextQuestionParams): Schemas["NextQuestionRequest"] => ({
  company: params.company,
  stage: params.stage,
  difficulty: params.difficulty,
  user_id: params.user_id,
  resume_grounded: params.resume_grounded,
  session_id: params.session_id,
});

export async function generateNextQuestion(params: NextQuestionParams): Promise<StructuredQuestion> {
  return postJson<StructuredQuestion, "NextQuestionRequest">("/api/interview/next-question", nextQuestionBody(params));
}

/** `generateNextQuestion`, with the question's text passed to `onDelta` as it's generated. */
export async function streamNextQuestion(
  params: NextQuestionParams,
  options: QuestionStreamOptions
): Promise<StructuredQuestion> {
  return streamQuestion<StructuredQuestion>("/api/interview/next-question/stream", nextQuestionBody(params), options);
}

export async function ingestResume(params: {
  user_id: string;
  resume_id: string;
  content_base64: string;
  filename: string;
}): Promise<ResumeIngestResult> {
  return postJson<ResumeIngestResult, "IngestResumeRequest">("/api/resume/ingest", {
    user_id: params.user_id,
    resume_id: params.resume_id,
    content_base64: params.content_base64,
    filename: params.filename,
  });
}

export async function deleteResumeVectors(userId: string): Promise<ResumePurgeResult> {
  return sendJson<ResumePurgeResult>("DELETE", `/api/resume/${encodeURIComponent(userId)}`);
}

export async function evaluateAnswer(params: {
  company: Company;
  stage: InterviewStage;
  question: string;
  answer: string;
  context?: string;
}, signal?: AbortSignal): Promise<StructuredEvaluation> {
  return postJson<StructuredEvaluation, "EvaluateAnswerRequest">(
    "/api/interview/evaluate-answer",
    {
      company: params.company,
      stage: params.stage,
      question: params.question,
      answer: params.answer,
      context: params.context,
    },
    signal
  );
}

type FollowupParams = {
  company: Company;
  stage: InterviewStage;
  question: string;
  answer: string;
  evaluation: StructuredEvaluation;
};

const followupBody = (params: FollowupParams): Schemas["GenerateFollowupRequest"] => ({
  company: params.company,
  stage: params.stage,
  question: params.question,
  answer: params.answer,
  evaluation: params.evaluation,
});

export async function generateFollowup(params: FollowupParams): Promise<StructuredFollowup> {
  return postJson<StructuredFollowup, "GenerateFollowupRequest">("/api/interview/generate-followup", followupBody(params));
}

/** `generateFollowup`, with the question's text passed to `onDelta` as it's generated. */
export async function streamFollowup(params: FollowupParams, options: QuestionStreamOptions): Promise<StructuredFollowup> {
  return streamQuestion<StructuredFollowup>("/api/interview/generate-followup/stream", followupBody(params), options);
}

export async function transcribeSpeech(params: {
  audioBase64: string;
  mimeType?: string;
  filename?: string;
  language?: string;
}): Promise<SpeechTranscriptionResult> {
  return postJson<SpeechTranscriptionResult, "TranscribeRequest">("/api/speech/transcribe", {
    audioBase64: params.audioBase64,
    mimeType: params.mimeType,
    filename: params.filename,
    language: params.language,
  });
}

export async function evaluateVoiceExplanation(params: {
  audioBase64: string;
  mimeType?: string;
  filename?: string;
  language?: string;
  question: string;
  context?: string;
}): Promise<VoiceEvaluationResult> {
  return postJson<VoiceEvaluationResult, "EvaluateExplanationRequest">("/api/speech/evaluate-explanation", {
    audioBase64: params.audioBase64,
    mimeType: params.mimeType,
    filename: params.filename,
    language: params.language,
    question: params.question,
    context: params.context,
  });
}

export async function generateReport(params: {
  company: string;
  conversation: string;
}): Promise<InterviewReport> {
  return postJson<InterviewReport, "GenerateReportRequest">("/api/interview/generate-report", {
    company: params.company,
    conversation: params.conversation,
  });
}

export async function analyzeSystemDesign(params: {
  prompt: string;
  explanation: string;
  company?: string;
}): Promise<SystemDesignAnalysis> {
  return postJson<SystemDesignAnalysis, "SystemDesignAnalysisRequest">("/api/system-design/analyze", {
    prompt: params.prompt,
    explanation: params.explanation,
    company: params.company,
  });
}

export async function reviewCode(params: {
  code: string;
  language: string;
  problem_title: string;
  problem_description: string;
  problem_difficulty: string;
}): Promise<CodeReviewResult> {
  return postJson<CodeReviewResult, "CodeReviewRequest">("/api/code-review/review", {
    code: params.code,
    language: params.language,
    problem_title: params.problem_title,
    problem_description: params.problem_description,
    problem_difficulty: params.problem_difficulty,
  });
}

export async function recommendTopics(params: {
  total_solved: number;
  difficulty_distribution: Record<string, number>;
  topic_counts: Record<string, number>;
  weak_topics: string[];
  recent_notes?: string | null;
}): Promise<RecommendationAIResult> {
  return postJson<RecommendationAIResult, "RecommendRequest">("/api/recommendations/recommend", {
    total_solved: params.total_solved,
    difficulty_distribution: params.difficulty_distribution,
    topic_counts: params.topic_counts,
    weak_topics: params.weak_topics,
    recent_notes: params.recent_notes,
  });
}
