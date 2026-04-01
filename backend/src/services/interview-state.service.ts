export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const COMPANIES = ["amazon", "google", "meta", "apple"] as const;
export type Company = (typeof COMPANIES)[number];

export const INTERVIEW_STAGES = ["behavioral", "coding", "system_design", "core_cs"] as const;
export type InterviewStage = (typeof INTERVIEW_STAGES)[number];

export function isValidCompany(value: string): value is Company {
  return (COMPANIES as readonly string[]).includes(value);
}

export function isValidInterviewStage(value: string): value is InterviewStage {
  return (INTERVIEW_STAGES as readonly string[]).includes(value);
}

export function normalizeCompany(value: string): Company | null {
  const normalized = value.trim().toLowerCase();
  return isValidCompany(normalized) ? normalized : null;
}

export function getNextStage(currentStage: InterviewStage): InterviewStage | "report" {
  const index = INTERVIEW_STAGES.indexOf(currentStage);
  if (index === -1 || index === INTERVIEW_STAGES.length - 1) {
    return "report";
  }
  return INTERVIEW_STAGES[index + 1];
}

export function getDefaultDifficulty(stage: InterviewStage): "easy" | "medium" | "hard" {
  if (stage === "behavioral") return "medium";
  if (stage === "coding") return "medium";
  if (stage === "system_design") return "medium";
  return "medium";
}

export function shouldAskFollowup(stageTurnCount: number): boolean {
  return stageTurnCount < 1;
}

export function buildEvaluationSummary(evaluation: {
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  shouldAskFollowup: boolean;
  followupFocus: string;
}): string {
  return [
    `Score: ${evaluation.score}/10`,
    `Strengths: ${evaluation.strengths.join("; ") || "None"}`,
    `Weaknesses: ${evaluation.weaknesses.join("; ") || "None"}`,
    `Suggestions: ${evaluation.suggestions.join("; ") || "None"}`,
    `Follow-up focus: ${evaluation.followupFocus || "General clarification"}`,
    `Should ask follow-up: ${evaluation.shouldAskFollowup ? "yes" : "no"}`,
  ].join("\n");
}
