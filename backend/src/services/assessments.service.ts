import { withTransaction } from "../db";
import * as assessments from "../repositories/assessments.repository";
import { pickRandomProblemIds } from "../repositories/problems.repository";
import { findOwnSubmissionProblemId } from "../repositories/submissions.repository";
import { DomainError, badRequest, notFound } from "./errors";
import { EVENT_TYPES, summarize, type EventType, type IntegrityEvent } from "./integrity";

/** Slack for a solution submitted in the last second that lands just after the deadline. */
const DEADLINE_GRACE_SECONDS = 30;

const assessmentNotFound = () => notFound("Assessment not found");

export function listAssessments(userId: string) {
  return assessments.listAssessments(userId);
}

export async function createAssessment(input: {
  userId: string;
  problemCount: number;
  timeLimitMinutes: number;
  difficultyMix: string;
}) {
  const problemIds = await pickRandomProblemIds(
    input.problemCount,
    input.difficultyMix !== "mixed" ? input.difficultyMix : null
  );
  if (problemIds.length === 0) throw badRequest("No problems available for the selected criteria");

  // One transaction (D-057): a partial insert left an assessment whose problem rows
  // didn't match problem_count, which GET /:id reports as a 500 forever after.
  const assessmentId = await withTransaction(async (tx) => {
    const newId = await assessments.insertAssessment(tx, {
      userId: input.userId,
      timeLimitMinutes: input.timeLimitMinutes,
      difficultyMix: input.difficultyMix,
      problemCount: problemIds.length,
    });
    for (let i = 0; i < problemIds.length; i++) {
      await assessments.insertAssessmentProblem(tx, newId, problemIds[i], i);
    }
    return newId;
  });

  return { assessmentId, problemCount: problemIds.length, timeLimitMinutes: input.timeLimitMinutes };
}

export async function getAssessment(id: string, userId: string) {
  const assessment = await assessments.findAssessment(id, userId);
  if (!assessment) throw assessmentNotFound();

  const problems = await assessments.listAssessmentProblems(id);
  if (problems.length === 0) {
    throw new DomainError(500, "Assessment has no assigned problems. Please create a new assessment.");
  }
  if (problems.length !== assessment.problem_count) {
    throw new DomainError(
      500,
      `Assessment problem mismatch: expected ${assessment.problem_count}, found ${problems.length}`
    );
  }
  const elapsed = Date.now() - new Date(assessment.started_at).getTime();
  const remainingMs = Math.max(0, assessment.time_limit_minutes * 60 * 1000 - elapsed);

  return {
    assessment,
    problems,
    remainingMs: assessment.status === "active" ? remainingMs : 0,
    integrity: await integrityOf(assessment),
  };
}

/** Per batch, and in total per assessment: generous for a real session, bounded for a script. */
export const MAX_EVENTS_PER_BATCH = 50;
export const MAX_EVENTS_PER_ASSESSMENT = 2000;
/** Client clocks drift; an event may be stamped this far outside the assessment's window. */
const CLOCK_SKEW_MS = 60_000;

async function integrityOf(assessment: assessments.AssessmentRow) {
  const events = await assessments.listEvents(assessment.id);
  const deadline = new Date(assessment.started_at).getTime() + assessment.time_limit_minutes * 60_000;
  const end = assessment.finished_at ? new Date(assessment.finished_at) : new Date(Math.min(Date.now(), deadline));
  return summarize(events as IntegrityEvent[], end);
}

export type ProctoringEvent = { type: EventType; at: string; chars: number | null };

/**
 * Record what the browser saw. Only while the assessment is active, and only the event's type,
 * time and -- for a paste or copy -- length; the route rejects anything else, including pasted
 * text.
 */
export async function recordEvents(id: string, userId: string, events: ProctoringEvent[]) {
  const assessment = await assessments.findAssessment(id, userId);
  if (!assessment) throw assessmentNotFound();
  if (assessment.status !== "active") {
    throw new DomainError(409, "Assessment is no longer active", { code: "assessment_closed" });
  }
  const from = new Date(assessment.started_at).getTime() - CLOCK_SKEW_MS;
  const to = Date.now() + CLOCK_SKEW_MS;
  if (events.some((e) => Date.parse(e.at) < from || Date.parse(e.at) > to)) {
    throw badRequest("An event's time is outside this assessment");
  }
  if ((await assessments.countEvents(id)) + events.length > MAX_EVENTS_PER_ASSESSMENT) {
    throw new DomainError(409, `At most ${MAX_EVENTS_PER_ASSESSMENT} events per assessment`, { code: "event_limit" });
  }
  await assessments.insertEvents(id, events);
  return { recorded: events.length, integrity: await integrityOf(assessment) };
}

export { EVENT_TYPES };

/** Link one of the user's submissions as the answer to an assessment problem. */
export async function linkSolution(id: string, userId: string, problemId: string, submissionId: string): Promise<void> {
  const state = await assessments.findDeadlineState(id, userId, DEADLINE_GRACE_SECONDS);
  if (!state) throw assessmentNotFound();
  if (state.status !== "active") throw badRequest("Assessment is no longer active");
  // The timer used to be advisory: the page stopped you, but the API still accepted
  // a solution linked after time ran out. Submitting the assessment itself stays
  // allowed afterwards; it just can't count work done late.
  if (state.expired) throw badRequest("Time is up for this assessment");

  // The linked submission decides the score, so it must be the caller's own and for
  // this problem (D-056). Before, any id was accepted: another user's passed
  // submission, or the caller's own solution to a different, easier problem.
  const submissionProblemId = await findOwnSubmissionProblemId(submissionId, userId);
  if (!submissionProblemId) throw notFound("Submission not found");
  if (submissionProblemId !== problemId) throw badRequest("Submission is for a different problem");

  if (!(await assessments.linkSubmission(id, problemId, submissionId))) {
    throw notFound("Problem is not part of this assessment");
  }
}

/** Finish the assessment; the score is the percentage of problems with a passed linked submission. */
export async function submitAssessment(id: string, userId: string) {
  const status = await assessments.findStatus(id, userId);
  if (status === null) throw assessmentNotFound();
  if (status !== "active") throw badRequest("Assessment already submitted");

  const statuses = await assessments.linkedSubmissionStatuses(id);
  const total = statuses.length;
  const passed = statuses.filter((s) => s === "passed").length;
  const score = total > 0 ? Math.round((passed / total) * 100 * 100) / 100 : 0;

  await assessments.complete(id, score);
  const finished = await assessments.findAssessment(id, userId);
  return { score, passed, total, status: "completed", integrity: await integrityOf(finished!) };
}
