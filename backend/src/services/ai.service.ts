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

export interface VoiceRubricSection {
  score: number;
  notes: string;
}

export interface VoiceEvaluation {
  overallScore: number;
  technicalCorrectness: VoiceRubricSection;
  communicationClarity: VoiceRubricSection;
  completeness: VoiceRubricSection;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

export interface SpeechTranscriptionResult {
  transcript: string;
}

export interface VoiceEvaluationResult {
  transcript: string;
  evaluation: VoiceEvaluation;
}

export interface SystemDesignNode {
  id: string;
  label: string;
  type: string;
}

export interface SystemDesignEdge {
  source: string;
  target: string;
  label: string;
}

export interface SystemDesignAnalysis {
  summary: string;
  nodes: SystemDesignNode[];
  edges: SystemDesignEdge[];
  risks: string[];
  improvements: string[];
  rubric: Record<string, VoiceRubricSection>;
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

export async function transcribeSpeech(params: {
  audioBase64: string;
  mimeType?: string;
  filename?: string;
  language?: string;
}): Promise<SpeechTranscriptionResult> {
  return postJson<SpeechTranscriptionResult>("/api/speech/transcribe", params);
}

export async function evaluateVoiceExplanation(params: {
  audioBase64: string;
  mimeType?: string;
  filename?: string;
  language?: string;
  question: string;
  context?: string;
}): Promise<VoiceEvaluationResult> {
  return postJson<VoiceEvaluationResult>("/api/speech/evaluate-explanation", params);
}

export async function analyzeSystemDesign(params: {
  prompt: string;
  explanation: string;
  company?: string;
}): Promise<SystemDesignAnalysis> {
  return postJson<SystemDesignAnalysis>("/api/system-design/analyze", params);
}
