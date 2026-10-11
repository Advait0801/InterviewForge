/**
 * An interview as a replayable timeline, safe to show anyone (D-071). The owner's replay and
 * a public share link both use this, so the owner previews exactly what a link reveals.
 *
 * Built by allowlist, field by field: a session row and its messages carry the user's id,
 * résumé excerpts, the retrieved context (which can include résumé chunks), live-fetch URLs,
 * the interviewer agent's rationale, model cost, and challenge evidence quoted from the
 * context. Evaluations and the report are model output that "may carry extra keys". None of
 * that may leave through here, and a field added to any of them later stays private until it
 * is added below on purpose.
 *
 * What's shown: the company, persona and mode; the interview date (not times); each question,
 * follow-up, answer and hint as text, with its offset in seconds from the start; each
 * evaluation's score and feedback lists; and the report. A pushback follow-up is marked as one,
 * without the evidence it quoted. The questions' text is shown as asked -- in a résumé-grounded
 * interview they can mention the résumé, which the owner sees before sharing.
 */

/** pg returns timestamptz as a Date; a string works too. */
type Timestamp = string | Date;

export type ReplaySession = {
  company: string;
  persona: string;
  mode: string;
  status: string;
  report_json: unknown;
  created_at: Timestamp;
};

export type ReplayMessage = {
  role: string;
  stage: string;
  content: string;
  metadata_json: unknown;
  created_at: Timestamp;
};

type Evaluation = {
  score: number;
  rawScore?: number;
  hintsUsed?: number;
  hintPenalty?: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
};

export type ReplayEvent =
  | { offsetSeconds: number; stage: string; type: "question" | "followup"; text: string; pushback: boolean }
  | { offsetSeconds: number; stage: string; type: "answer"; text: string }
  | { offsetSeconds: number; stage: string; type: "hint"; text: string; level: number }
  | { offsetSeconds: number; stage: string; type: "evaluation"; evaluation: Evaluation };

export type ReplayReport = {
  overallScore: number;
  stageScores: Record<string, { score: number | string; feedback: string }>;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
};

export type Replay = {
  company: string;
  persona: string;
  mode: string;
  status: string;
  date: string;
  durationSeconds: number;
  stages: string[];
  events: ReplayEvent[];
  report: ReplayReport | null;
};

const STAGES = new Set(["behavioral", "coding", "system_design", "core_cs"]);
const MAX_LIST = 20;
const MAX_TEXT = 20_000;

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown, max = MAX_TEXT): string => (typeof v === "string" ? v.slice(0, max) : "");
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, MAX_LIST).map((x) => x.slice(0, 2_000)) : [];
const int = (v: unknown, lo: number, hi: number): number | undefined =>
  typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : undefined;
const stage = (v: unknown): string => (typeof v === "string" && STAGES.has(v) ? v : "unknown");

function evaluation(meta: Record<string, unknown>): Evaluation | null {
  const score = int(meta.score, 0, 10);
  if (score === undefined) return null;
  const out: Evaluation = {
    score,
    strengths: strings(meta.strengths),
    weaknesses: strings(meta.weaknesses),
    suggestions: strings(meta.suggestions),
  };
  const rawScore = int(meta.rawScore, 0, 10);
  const hintsUsed = int(meta.hintsUsed, 1, 3);
  const hintPenalty = int(meta.hintPenalty, 0, 10);
  if (rawScore !== undefined) out.rawScore = rawScore;
  if (hintsUsed !== undefined) out.hintsUsed = hintsUsed;
  if (hintPenalty !== undefined) out.hintPenalty = hintPenalty;
  return out;
}

export function replayReport(raw: unknown): ReplayReport | null {
  const r = obj(raw);
  const overallScore = int(r.overallScore, 0, 10);
  if (overallScore === undefined) return null;
  const stageScores: ReplayReport["stageScores"] = {};
  for (const [key, value] of Object.entries(obj(r.stageScores))) {
    if (!STAGES.has(key)) continue;
    const v = obj(value);
    const score = typeof v.score === "number" && Number.isFinite(v.score) ? v.score : typeof v.score === "string" ? v.score.slice(0, 20) : null;
    if (score === null) continue;
    stageScores[key] = { score, feedback: str(v.feedback, 4_000) };
  }
  return {
    overallScore,
    stageScores,
    strengths: strings(r.strengths),
    weaknesses: strings(r.weaknesses),
    recommendations: strings(r.recommendations),
  };
}

export function buildReplay(session: ReplaySession, messages: ReplayMessage[]): Replay {
  const start = new Date(session.created_at).getTime();
  const offset = (at: Timestamp) => Math.max(0, Math.round((new Date(at).getTime() - start) / 1000));

  const events: ReplayEvent[] = [];
  for (const m of messages) {
    const meta = obj(m.metadata_json);
    const at = offset(m.created_at);
    const s = stage(m.stage);
    if (m.role === "assistant" && (meta.kind === "question" || meta.kind === "followup")) {
      events.push({ offsetSeconds: at, stage: s, type: meta.kind, text: str(m.content), pushback: meta.challenge !== undefined && meta.challenge !== null });
    } else if (m.role === "assistant" && meta.kind === "hint") {
      events.push({ offsetSeconds: at, stage: s, type: "hint", text: str(m.content), level: int(meta.level, 1, 3) ?? 1 });
    } else if (m.role === "candidate") {
      events.push({ offsetSeconds: at, stage: s, type: "answer", text: str(m.content) });
    } else if (m.role === "system" && meta.kind === "evaluation") {
      const e = evaluation(meta);
      if (e) events.push({ offsetSeconds: at, stage: s, type: "evaluation", evaluation: e });
    }
    // Anything else is skipped: an unknown kind is private until it's added here.
  }

  const stages: string[] = [];
  for (const e of events) if (e.stage !== "unknown" && !stages.includes(e.stage)) stages.push(e.stage);

  return {
    company: str(session.company, 40),
    persona: str(session.persona, 40),
    mode: str(session.mode, 20),
    status: session.status === "completed" ? "completed" : "active",
    date: new Date(start).toISOString().slice(0, 10),
    durationSeconds: events.length ? events[events.length - 1].offsetSeconds : 0,
    stages,
    events,
    report: replayReport(session.report_json),
  };
}
