import { withTransaction } from "../db";
import * as assessments from "../repositories/assessments.repository";
import { pickRandomProblemIds } from "../repositories/problems.repository";
import { findOwnSubmissionProblemId } from "../repositories/submissions.repository";
import { DomainError, badRequest, notFound } from "./errors";

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
  };
}

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
  return { score, passed, total, status: "completed" };
}
