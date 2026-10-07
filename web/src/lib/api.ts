import createClient from "openapi-fetch";
import type { components, operations, paths } from "./api/schema";
import { clearToken, getToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export function emailVerificationUrl(token: string) {
  return `${API_URL}/auth/verify-email?token=${encodeURIComponent(token)}`;
}

/** End only a session explicitly rejected by the backend (D-055). */
function endSession() {
  clearToken();
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.assign("/login?expired=1");
  }
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly retryable?: boolean) {
    super(message);
    this.name = "ApiError";
  }
}

const client = createClient<paths>({
  baseUrl: API_URL,
  // Resolve fetch at request time, including when tests replace it after module load.
  fetch: (request) => globalThis.fetch(request),
});
client.use({
  async onResponse({ request, response }) {
    if (response.status === 401 && request.headers.has("Authorization")) {
      const payload: unknown = await response.clone().json().catch(() => null);
      if (typeof payload === "object" && payload !== null && "code" in payload && payload.code === "session_invalid") endSession();
    }
  },
});

function authHeaders(auth = true) {
  const token = auth ? getToken() : null;
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

/** Unwrap the generated client's envelope; domain responses remain inferred from paths. */
async function unwrap<T>(pending: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  const { data, error, response } = await pending;
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let retryable: boolean | undefined;
    if (typeof error === "object" && error !== null) {
      if ("error" in error && typeof error.error === "string") message = error.error;
      else if ("detail" in error && typeof error.detail === "string") message = error.detail;
      if ("retryable" in error && typeof error.retryable === "boolean") retryable = error.retryable;
    }
    throw new ApiError(message, response.status, retryable);
  }
  if (data === undefined) throw new ApiError("The server returned an empty response. Please try again.", response.status);
  return data;
}

export type Problem = components["schemas"]["ProblemSummary"];
export type ProblemDetail = components["schemas"]["ProblemDetail"];
export type Submission = components["schemas"]["SubmissionSummary"];
export type SubmissionDetail = components["schemas"]["SubmissionDetail"];
export type UserStats = components["schemas"]["UserStats"];
export type PublicProfile = components["schemas"]["PublicProfile"];
export type LeaderboardEntry = components["schemas"]["LeaderboardEntry"];
export type LeaderboardResponse = operations["getLeaderboard"]["responses"][200]["content"]["application/json"];
export type ActivityResponse = operations["getUserActivity"]["responses"][200]["content"]["application/json"];
export type AnalyticsResponse = operations["getUserAnalytics"]["responses"][200]["content"]["application/json"];
export type InterviewMessage = components["schemas"]["InterviewMessage"];
export type RubricSection = components["schemas"]["RubricSection"];
export type SystemDesignAnalysis = components["schemas"]["SystemDesignAnalysis"];
export type SystemDesignNode = SystemDesignAnalysis["nodes"][number];
export type SystemDesignEdge = SystemDesignAnalysis["edges"][number];
export type VoiceRubricSection = components["schemas"]["RubricSection"];
export type VoiceEvaluation = components["schemas"]["VoiceEvaluation"];
export type InterviewSession = components["schemas"]["InterviewSessionSummary"];
export type InterviewReport = components["schemas"]["InterviewReport"];
export type Assessment = components["schemas"]["Assessment"];
export type AssessmentProblem = components["schemas"]["AssessmentProblem"];
export type LearningPathSummary = components["schemas"]["LearningPathSummary"];
export type LearningPathDetailResponse = components["schemas"]["LearningPathDetail"];
export type PathProblemItem = LearningPathDetailResponse["problems"][number];
export type CodeReview = components["schemas"]["CodeReview"];
export type RecommendedProblemCard = components["schemas"]["ProblemCard"];
export type RevisitProblemCard = components["schemas"]["Recommendations"]["revisit"][number];
export type RecommendationsResponse = components["schemas"]["Recommendations"];

// Preserve the public string argument signatures while validating the contract enums.
function languageValue(value: string): components["schemas"]["Language"] {
  const values: components["schemas"]["Language"][] = ["python3", "c", "cpp", "java"];
  const language = values.find((item) => item === value);
  if (!language) throw new Error("Choose a supported coding language.");
  return language;
}
function companyValue(value: string): components["schemas"]["Company"] {
  const values: components["schemas"]["Company"][] = ["amazon", "google", "meta", "apple", "microsoft", "uber", "bloomberg", "adobe", "linkedin", "airbnb"];
  const company = values.find((item) => item === value.toLowerCase());
  if (!company) throw new Error("Choose a supported interview company.");
  return company;
}
function difficultyMixValue(value: string): Assessment["difficulty_mix"] {
  const values: Assessment["difficulty_mix"][] = ["mixed", "easy", "medium", "hard"];
  const mix = values.find((item) => item === value);
  if (!mix) throw new Error("Choose a supported assessment difficulty.");
  return mix;
}

export const api = {
  register: (username: string, email: string, password: string, fullName?: string) =>
    unwrap(client.POST("/auth/register", { body: { username, email, password, fullName } })),
  login: (identifier: string, password: string) =>
    unwrap(client.POST("/auth/login", { body: { identifier, password } })),
  forgotPassword: (email: string) =>
    unwrap(client.POST("/auth/forgot-password", { body: { email } })),
  resetPassword: (token: string, newPassword: string) =>
    unwrap(client.POST("/auth/reset-password", { body: { token, newPassword } })),
  logoutAll: () => unwrap(client.POST("/auth/logout-all", { headers: authHeaders() })),
  me: () => unwrap(client.GET("/users/me", { headers: authHeaders() })),
  changePassword: (currentPassword: string, newPassword: string) =>
    unwrap(client.POST("/users/change-password", { headers: authHeaders(), body: { currentPassword, newPassword } })),
  listProblems: (opts?: {
    difficulty?: "all" | "easy" | "medium" | "hard";
    topic?: string;
    search?: string;
    solved?: "all" | "solved" | "unsolved";
    company?: string;
    auth?: boolean;
  }) => unwrap(client.GET("/problems", {
    headers: authHeaders(opts?.auth ?? false),
    params: { query: {
      difficulty: opts?.difficulty === "all" ? undefined : opts?.difficulty,
      topic: opts?.topic === "all" ? undefined : opts?.topic,
      search: opts?.search || undefined,
      solved: opts?.solved === "all" ? undefined : opts?.solved,
      company: opts?.company === "all" ? undefined : opts?.company,
    } },
  })),
  getProblem: (id: string, auth = false) =>
    unwrap(client.GET("/problems/{id}", { params: { path: { id } }, headers: authHeaders(auth) })),
  listBookmarks: () => unwrap(client.GET("/problem-bookmarks", { headers: authHeaders() })),
  addBookmark: (problemId: string) =>
    unwrap(client.POST("/problem-bookmarks/{problemId}", { params: { path: { problemId } }, headers: authHeaders() })),
  removeBookmark: (problemId: string) =>
    unwrap(client.DELETE("/problem-bookmarks/{problemId}", { params: { path: { problemId } }, headers: authHeaders() })),
  runCode: async (problemId: string, language: string, code: string) => {
    const result = await unwrap(client.POST("/submissions", { headers: authHeaders(), body: { problemId, language: languageValue(language), code, mode: "run" } }));
    if (result.mode !== "run") throw new Error("The server did not return a Run result.");
    return result;
  },
  submitCode: async (problemId: string, language: string, code: string) => {
    const result = await unwrap(client.POST("/submissions", { headers: authHeaders(), body: { problemId, language: languageValue(language), code, mode: "submit" } }));
    if (result.mode !== "submit") throw new Error("The server did not return a Submit result.");
    return result;
  },
  startInterview: (company: string, difficulty?: string) =>
    unwrap(client.POST("/interviews", { headers: authHeaders(), body: { company: companyValue(company), difficulty } })),
  getInterview: (id: string) =>
    unwrap(client.GET("/interviews/{id}", { params: { path: { id } }, headers: authHeaders() })),
  answerInterview: (id: string, answer: string) =>
    unwrap(client.POST("/interviews/{id}/answer", { params: { path: { id } }, headers: authHeaders(), body: { answer } })),
  transcribeSpeech: (audioBase64: string, mimeType = "audio/webm", filename?: string) =>
    unwrap(client.POST("/interviews/speech/transcribe", { headers: authHeaders(), body: { audioBase64, mimeType, filename } })),
  evaluateExplanation: (audioBase64: string, question: string, mimeType = "audio/webm", filename?: string) =>
    unwrap(client.POST("/interviews/speech/evaluate-explanation", { headers: authHeaders(), body: { audioBase64, question, mimeType, filename } })),
  analyzeSystemDesign: (prompt: string, explanation: string, company?: string) =>
    unwrap(client.POST("/interviews/system-design/analyze", { headers: authHeaders(), body: { prompt, explanation, company } })),
  getSubmissions: (opts?: { problemId?: string; status?: "passed" | "failed"; language?: string; limit?: number; offset?: number }) =>
    unwrap(client.GET("/submissions", { params: { query: opts }, headers: authHeaders() })),
  getSubmission: (id: string) =>
    unwrap(client.GET("/submissions/{id}", { params: { path: { id } }, headers: authHeaders() })),
  createAssessment: (opts: { timeLimitMinutes?: number; problemCount?: number; difficultyMix?: string } = {}) =>
    unwrap(client.POST("/assessments", { headers: authHeaders(), body: { ...opts, difficultyMix: opts.difficultyMix ? difficultyMixValue(opts.difficultyMix) : undefined } })),
  getAssessment: (id: string) =>
    unwrap(client.GET("/assessments/{id}", { params: { path: { id } }, headers: authHeaders() })),
  listAssessments: () => unwrap(client.GET("/assessments", { headers: authHeaders() })),
  linkAssessmentSubmission: (assessmentId: string, problemId: string, submissionId: string) =>
    unwrap(client.POST("/assessments/{id}/solve", { params: { path: { id: assessmentId } }, headers: authHeaders(), body: { problemId, submissionId } })),
  submitAssessment: (id: string) =>
    unwrap(client.POST("/assessments/{id}/submit", { params: { path: { id } }, headers: authHeaders() })),
  listInterviews: () => unwrap(client.GET("/interviews", { headers: authHeaders() })),
  getInterviewReport: (id: string) =>
    unwrap(client.GET("/interviews/{id}/report", { params: { path: { id } }, headers: authHeaders() })),
  userStats: () => unwrap(client.GET("/users/stats", { headers: authHeaders() })),
  getPublicProfile: (username: string) => unwrap(client.GET("/users/{username}", { params: { path: { username } } })),
  getLeaderboard: (page = 1, limit = 20) => unwrap(client.GET("/leaderboard", { params: { query: { page, limit } } })),
  getUserActivity: () => unwrap(client.GET("/users/activity", { headers: authHeaders() })),
  getUserAnalytics: () => unwrap(client.GET("/users/analytics", { headers: authHeaders() })),
  uploadAvatar: (dataUri: string) => unwrap(client.POST("/users/avatar", { headers: authHeaders(), body: { avatar: dataUri } })),
  removeAvatar: () => unwrap(client.DELETE("/users/avatar", { headers: authHeaders() })),
  getLearningPaths: (auth = false) => unwrap(client.GET("/learning-paths", { headers: authHeaders(auth) })),
  getLearningPath: (slug: string, auth = false) =>
    unwrap(client.GET("/learning-paths/{slug}", { params: { path: { slug } }, headers: authHeaders(auth) })),
  completePathProblem: (slug: string, problemId: string) =>
    unwrap(client.POST("/learning-paths/{slug}/complete/{problemId}", { params: { path: { slug, problemId } }, headers: authHeaders() })),
  reviewSubmission: (submissionId: string) =>
    unwrap(client.POST("/submissions/{id}/review", { params: { path: { id: submissionId } }, headers: authHeaders() })),
  getRecommendations: () => unwrap(client.GET("/recommendations", { headers: authHeaders() })),
};
