import {
  Company,
  InterviewStage,
} from "./interview-state.service";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://ai-service:8000";

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
  const response = await fetch(`${AI_SERVICE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI service error (${response.status}): ${text}`);
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
