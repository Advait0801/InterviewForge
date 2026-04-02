import { getToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

type RequestOptions = {
  method?: "GET" | "POST" | "DELETE";
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
  topics?: string[];
  is_solved?: boolean;
  is_bookmarked?: boolean;
};

export type ProblemDetail = Problem & {
  test_cases: Array<{ input: string; expectedOutput: string }>;
  starter_code: Record<string, string>;
  hints?: string | null;
  editorial?: string | null;
  companies?: string[];
};

export type Submission = {
  id: string;
  problem_id: string;
  problem_title: string;
  language: string;
  status: string;
  runtime_ms: number | null;
  memory_kb: number | null;
  created_at: string;
};

export type UserStats = {
  problemsAttempted: number;
  problemsSolved: number;
  interviewsStarted: number;
  bestStreak: number;
  submissionsCount: number;
  acceptanceRate: number;
};

export type PublicProfile = {
  profile: {
    username: string;
    name: string | null;
    avatar_url: string | null;
    createdAt: string;
  };
  stats: {
    problemsAttempted: number;
    problemsSolved: number;
    interviewsStarted: number;
    submissionsCount: number;
    acceptanceRate: number;
  };
  recentActivity: Array<{
    type: "submission" | "interview";
    title: string;
    status: string | null;
    created_at: string;
  }>;
  activityMap: Record<string, number>;
};

export type LeaderboardEntry = {
  rank: number;
  username: string;
  name: string | null;
  avatar_url: string | null;
  solved: number;
  acceptanceRate: number;
};

export type LeaderboardResponse = {
  leaderboard: LeaderboardEntry[];
  total: number;
  page: number;
  limit: number;
};

export type ActivityResponse = {
  currentStreak: number;
  bestStreak: number;
  activityMap: Record<string, number>;
};

export type AnalyticsResponse = {
  solvedOverTime: Array<{ day: string; count: number }>;
  difficultyDistribution: Record<string, number>;
  topicStrengths: Array<{ topic: string; count: number }>;
  acceptanceTrend: Array<{ week: string; rate: number }>;
};

export type SubmissionDetail = {
  id: string;
  problem_id: string;
  language: string;
  code: string;
  status: string;
  runtime_ms: number | null;
  memory_kb: number | null;
  created_at: string;
};

export type InterviewMessage = {
  id: string;
  role: "assistant" | "candidate" | "system";
  stage: string;
  content: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
};

export type RubricSection = {
  score: number;
  notes: string;
};

export type SystemDesignNode = {
  id: string;
  label: string;
  type: string;
};

export type SystemDesignEdge = {
  source: string;
  target: string;
  label: string;
};

export type VoiceRubricSection = {
  score: number;
  notes: string;
};

export type VoiceEvaluation = {
  overallScore: number;
  technicalCorrectness: VoiceRubricSection;
  communicationClarity: VoiceRubricSection;
  completeness: VoiceRubricSection;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
};

export type InterviewSession = {
  id: string;
  company: string;
  current_stage: string;
  status: string;
  created_at: string;
};

export type InterviewReport = {
  sessionId: string;
  company: string;
  overallScore: number;
  stageScores: Record<string, { score: number; feedback: string }>;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
};

export type Assessment = {
  id: string;
  status: string;
  time_limit_minutes: number;
  difficulty_mix: string;
  problem_count: number;
  started_at: string;
  finished_at: string | null;
  score: number | null;
  created_at: string;
};

export type AssessmentProblem = {
  id: string;
  assessment_id: string;
  problem_id: string;
  problem_order: number;
  submission_id: string | null;
  title: string;
  slug: string;
  difficulty: string;
  submission_status: string | null;
};

export type LearningPathSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  topic: string;
  difficultyLevel: string;
  problemCount: number;
  completedCount: number;
};

export type PathProblemItem = {
  problemId: string;
  position: number;
  title: string;
  slug: string;
  difficulty: string;
  isCompleted: boolean;
};

export type LearningPathDetailResponse = {
  path: {
    slug: string;
    title: string;
    description: string;
    topic: string;
    difficultyLevel: string;
    problemCount: number;
    completedCount: number;
  };
  problems: PathProblemItem[];
};

export type SystemDesignAnalysis = {
  summary: string;
  nodes: SystemDesignNode[];
  edges: SystemDesignEdge[];
  risks: string[];
  improvements: string[];
  rubric: Record<string, RubricSection>;
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
  forgotPassword: (email: string) =>
    request<{ ok: boolean }>("/auth/forgot-password", {
      method: "POST",
      body: { email },
    }),
  resetPassword: (token: string, newPassword: string) =>
    request<{ ok: boolean }>("/auth/reset-password", {
      method: "POST",
      body: { token, newPassword },
    }),
  me: () =>
    request<{ user: { id: string; email: string; username: string | null; name: string | null; avatar_url: string | null } }>("/users/me", {
      auth: true,
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>("/users/change-password", {
      method: "POST",
      auth: true,
      body: { currentPassword, newPassword },
    }),
  listProblems: (opts?: {
    difficulty?: "all" | "easy" | "medium" | "hard";
    topic?: string;
    search?: string;
    solved?: "all" | "solved" | "unsolved";
    auth?: boolean;
  }) => {
    const params = new URLSearchParams();
    if (opts?.difficulty && opts.difficulty !== "all") params.set("difficulty", opts.difficulty);
    if (opts?.topic && opts.topic !== "all") params.set("topic", opts.topic);
    if (opts?.search) params.set("search", opts.search);
    if (opts?.solved && opts.solved !== "all") params.set("solved", opts.solved);
    const query = params.toString();
    return request<{ problems: Problem[] }>(`/problems${query ? `?${query}` : ""}`, { auth: opts?.auth ?? false });
  },
  getProblem: (id: string, auth = false) => request<{ problem: ProblemDetail }>(`/problems/${id}`, { auth }),
  listBookmarks: () => request<{ bookmarks: Array<{ problem_id: string }> }>("/problem-bookmarks", { auth: true }),
  addBookmark: (problemId: string) =>
    request<{ ok: boolean }>(`/problem-bookmarks/${encodeURIComponent(problemId)}`, { method: "POST", auth: true }),
  removeBookmark: (problemId: string) =>
    request<{ ok: boolean }>(`/problem-bookmarks/${encodeURIComponent(problemId)}`, { method: "DELETE", auth: true }),
  runCode: (problemId: string, language: string, code: string) =>
    request<{
      mode: "run";
      passed: boolean;
      results: Array<{ passed: boolean; actualOutput?: string; error?: string }>;
      testCases?: Array<{ input: string; expectedOutput: string }>;
      runtimeMs?: number;
    }>("/submissions", {
      method: "POST",
      auth: true,
      body: { problemId, language, code, mode: "run" },
    }),
  submitCode: (problemId: string, language: string, code: string) =>
    request<{
      mode: "submit";
      submissionId: string;
      status: string;
      passed: boolean;
      results: Array<{ passed: boolean; actualOutput?: string; error?: string }>;
      runtimeMs?: number;
    }>("/submissions", {
      method: "POST",
      auth: true,
      body: { problemId, language, code, mode: "submit" },
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
    request<{ transcript: string; evaluation: VoiceEvaluation }>("/interviews/speech/evaluate-explanation", {
      method: "POST",
      auth: true,
      body: { audioBase64, question, mimeType, filename },
    }),
  analyzeSystemDesign: (prompt: string, explanation: string, company?: string) =>
    request<SystemDesignAnalysis>("/interviews/system-design/analyze", {
      method: "POST",
      auth: true,
      body: { prompt, explanation, company },
    }),
  getSubmissions: (opts?: {
    problemId?: string;
    status?: "passed" | "failed";
    language?: string;
    limit?: number;
    offset?: number;
  }) => {
    const params = new URLSearchParams();
    if (opts?.problemId) params.set("problemId", opts.problemId);
    if (opts?.status) params.set("status", opts.status);
    if (opts?.language) params.set("language", opts.language);
    if (opts?.limit != null) params.set("limit", String(opts.limit));
    if (opts?.offset != null) params.set("offset", String(opts.offset));
    const query = params.toString();
    return request<{ submissions: Submission[]; total?: number; limit?: number; offset?: number }>(
      `/submissions${query ? `?${query}` : ""}`,
      { auth: true },
    );
  },
  getSubmission: (id: string) =>
    request<{ submission: SubmissionDetail }>(`/submissions/${encodeURIComponent(id)}`, { auth: true }),
  createAssessment: (opts: { timeLimitMinutes?: number; problemCount?: number; difficultyMix?: string } = {}) =>
    request<{ assessmentId: string; problemCount: number; timeLimitMinutes: number }>("/assessments", {
      method: "POST",
      auth: true,
      body: opts,
    }),
  getAssessment: (id: string) =>
    request<{ assessment: Assessment; problems: AssessmentProblem[]; remainingMs: number }>(`/assessments/${id}`, {
      auth: true,
    }),
  listAssessments: () =>
    request<{ assessments: Assessment[] }>("/assessments", { auth: true }),
  linkAssessmentSubmission: (assessmentId: string, problemId: string, submissionId: string) =>
    request<{ ok: boolean }>(`/assessments/${assessmentId}/solve`, {
      method: "POST",
      auth: true,
      body: { problemId, submissionId },
    }),
  submitAssessment: (id: string) =>
    request<{ score: number; passed: number; total: number; status: string }>(`/assessments/${id}/submit`, {
      method: "POST",
      auth: true,
    }),
  listInterviews: () =>
    request<{ sessions: InterviewSession[] }>("/interviews", { auth: true }),
  getInterviewReport: (id: string) =>
    request<InterviewReport>(`/interviews/${id}/report`, { auth: true }),
  userStats: () =>
    request<UserStats>("/users/stats", {
      auth: true,
    }),
  getPublicProfile: (username: string) =>
    request<PublicProfile>(`/users/${encodeURIComponent(username)}`),
  getLeaderboard: (page = 1, limit = 20) =>
    request<LeaderboardResponse>(`/leaderboard?page=${page}&limit=${limit}`),
  getUserActivity: () =>
    request<ActivityResponse>("/users/activity", { auth: true }),
  getUserAnalytics: () =>
    request<AnalyticsResponse>("/users/analytics", { auth: true }),
  uploadAvatar: (dataUri: string) =>
    request<{ ok: boolean; avatar_url: string }>("/users/avatar", {
      method: "POST",
      auth: true,
      body: { avatar: dataUri },
    }),
  removeAvatar: () =>
    request<{ ok: boolean }>("/users/avatar", {
      method: "DELETE",
      auth: true,
    }),
  getLearningPaths: (auth = false) =>
    request<{ paths: LearningPathSummary[] }>("/learning-paths", { auth }),
  getLearningPath: (slug: string, auth = false) =>
    request<LearningPathDetailResponse>(`/learning-paths/${encodeURIComponent(slug)}`, { auth }),
  completePathProblem: (slug: string, problemId: string) =>
    request<{ ok: boolean }>(`/learning-paths/${encodeURIComponent(slug)}/complete/${encodeURIComponent(problemId)}`, {
      method: "POST",
      auth: true,
    }),
};
