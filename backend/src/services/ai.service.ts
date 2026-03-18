import {
  Company,
  InterviewStage,
} from "./interview-state.service";

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

export interface StructuredEvaluation {
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  shouldAskFollowup: boolean;
  followupFocus: string;
}

export interface StructuredQuestion {
  question: string;
  reasoningFocus: string;
  expectedCompetencies: string[];
  retrievalHits: number;
  context: string;
}

export interface StructuredFollowup {
  question: string;
  focus: string;
  reason: string;
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  let response: globalThis.Response;
  try {
    response = await fetch(`${AI_SERVICE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI service request failed before receiving a response";
    throw new AIServiceError(503, `AI service unavailable: ${message}`);
  }

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

  return response.json() as Promise<T>;
}

export async function generateNextQuestion(params: {
  company: Company;
  stage: InterviewStage;
  difficulty: string;
  previousAnswer?: string | null;
}): Promise<StructuredQuestion> {
  return postJson<StructuredQuestion>("/api/interview/next-question", params);
}

export async function evaluateAnswer(params: {
  company: Company;
  stage: InterviewStage;
  question: string;
  answer: string;
  context?: string;
}): Promise<StructuredEvaluation> {
  return postJson<StructuredEvaluation>("/api/interview/evaluate-answer", params);
}

export async function generateFollowup(params: {
  company: Company;
  stage: InterviewStage;
  question: string;
  answer: string;
  evaluation: StructuredEvaluation;
}): Promise<StructuredFollowup> {
  return postJson<StructuredFollowup>("/api/interview/generate-followup", params);
}
