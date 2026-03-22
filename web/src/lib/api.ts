import { getToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  auth?: boolean;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = payload?.error || payload?.detail || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return payload as T;
}

export type Problem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
};

export type ProblemDetail = Problem & {
  test_cases: Array<{ input: string; expectedOutput: string }>;
};

export type InterviewMessage = {
  id: string;
  role: "assistant" | "candidate" | "system";
  stage: string;
  content: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
};

export const api = {
  register: (username: string, email: string, password: string, fullName?: string) =>
    request<{ token: string }>("/auth/register", {
      method: "POST",
      body: { username, email, password, fullName },
    }),
  login: (identifier: string, password: string) =>
    request<{ token: string }>("/auth/login", {
      method: "POST",
      body: { identifier, password },
    }),
  me: () =>
    request<{ user: { id: string; email: string; username: string | null; name: string | null } }>("/users/me", {
      auth: true,
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>("/users/change-password", {
      method: "POST",
      auth: true,
      body: { currentPassword, newPassword },
    }),
  listProblems: () => request<{ problems: Problem[] }>("/problems"),
  getProblem: (id: string) => request<{ problem: ProblemDetail }>(`/problems/${id}`),
  submitCode: (problemId: string, language: string, code: string) =>
    request<{
      submissionId: string;
      status: string;
      passed: boolean;
      results: Array<{ passed: boolean }>;
      runtimeMs?: number;
    }>("/submissions", {
      method: "POST",
      auth: true,
      body: { problemId, language, code },
    }),
  startInterview: (company: string, difficulty?: string) =>
    request<{
      session: { id: string; company: string; currentStage: string; status: string };
      openingQuestion: { question: string };
    }>("/interviews", {
      method: "POST",
      auth: true,
      body: { company, difficulty },
    }),
  getInterview: (id: string) =>
    request<{
      session: { id: string; company: string; current_stage: string; status: string };
      messages: InterviewMessage[];
    }>(`/interviews/${id}`, { auth: true }),
  answerInterview: (id: string, answer: string) =>
    request(`/interviews/${id}/answer`, {
      method: "POST",
      auth: true,
      body: { answer },
    }),
  transcribeSpeech: (audioBase64: string, mimeType = "audio/webm", filename = "recording.webm") =>
    request<{ transcript: string }>("/interviews/speech/transcribe", {
      method: "POST",
      auth: true,
      body: { audioBase64, mimeType, filename },
    }),
  evaluateExplanation: (
    audioBase64: string,
    question: string,
    mimeType = "audio/webm",
    filename = "recording.webm",
  ) =>
    request<{ transcript: string; evaluation: unknown }>("/interviews/speech/evaluate-explanation", {
      method: "POST",
      auth: true,
      body: { audioBase64, question, mimeType, filename },
    }),
};
