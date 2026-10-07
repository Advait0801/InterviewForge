import * as submissions from "../repositories/submissions.repository";
import { findProblemForExecution } from "../repositories/problems.repository";
import { markCompletedInEveryPath } from "../repositories/learning-paths.repository";
import { reviewCode } from "./ai.service";
import { CodeRunnerFailedError, CodeRunnerUnreachableError } from "./code-runner.client";
import { RunQueueBusyError, RunQueueUnavailableError, runQueued } from "./run-queue";
import { bumpCacheVersion } from "./cache";
import { DomainError, notFound } from "./errors";
import { clientSubmitResults, exampleCases } from "./test-cases";

export type { SubmissionFilters } from "../repositories/submissions.repository";

const submissionNotFound = () => notFound("Submission not found");

export async function listSubmissions(
  userId: string,
  filters: submissions.SubmissionFilters,
  limit: number,
  offset: number
) {
  const { rows, total } = await submissions.listSubmissions(userId, filters, limit, offset);
  return { submissions: rows, total, limit, offset };
}

export async function getSubmission(id: string, userId: string) {
  const row = await submissions.findSubmission(id, userId);
  if (!row) throw submissionNotFound();
  return row;
}

/** An AI review of the user's own submission. An AIServiceError propagates. */
export async function reviewSubmission(id: string, userId: string) {
  const s = await submissions.findReviewSource(id, userId);
  if (!s) throw submissionNotFound();
  return reviewCode({
    code: s.code,
    language: s.language,
    problem_title: s.title,
    problem_description: s.description,
    problem_difficulty: s.difficulty,
  });
}

/**
 * Run code against a problem. "run" uses the public examples and records nothing;
 * "submit" runs the full suite, hidden cases included, records the submission and, on
 * a pass, completes the problem in every learning path that contains it.
 */
export async function executeSubmission(input: {
  userId: string;
  problemId: string;
  language: string;
  code: string;
  mode: "run" | "submit";
}) {
  const problem = await findProblemForExecution(input.problemId);
  if (!problem) throw notFound("Problem not found");

  const allTestCases = problem.test_cases || [];
  const testCases = input.mode === "run" ? exampleCases(allTestCases) : allTestCases;

  let runResult;
  try {
    // Through the bounded queue (D-063): at most CODE_RUN_CONCURRENCY sandboxes at once.
    runResult = await runQueued({ language: input.language, code: input.code, testCases, slug: problem.slug });
  } catch (err) {
    // A dependency being down is a retryable 503, not a 500 that implies a bug here --
    // the same shape as the ai-service's Chroma-down response.
    if (err instanceof CodeRunnerUnreachableError || err instanceof RunQueueUnavailableError) {
      throw new DomainError(503, "Code runner unavailable", { retryable: true });
    }
    if (err instanceof RunQueueBusyError) {
      throw new DomainError(503, "Code runner is busy. Try again in a moment.", { retryable: true });
    }
    if (err instanceof CodeRunnerFailedError) throw new DomainError(502, "Code runner unavailable");
    throw err;
  }

  if (input.mode === "run") {
    return {
      status: 200,
      body: {
        mode: "run",
        passed: runResult.passed,
        results: runResult.results,
        testCases,
        runtimeMs: runResult.runtimeMs,
      },
    };
  }

  const status = runResult.passed ? "passed" : "failed";
  const submissionId = await submissions.insertSubmission({
    userId: input.userId,
    problemId: input.problemId,
    language: input.language,
    code: input.code,
    status,
    runtimeMs: runResult.runtimeMs ?? null,
    memoryKb: runResult.memoryKb ?? null,
  });

  if (status === "passed") {
    await markCompletedInEveryPath(input.userId, input.problemId);
  }
  // Any new submission can change rankings and acceptance rates.
  await bumpCacheVersion("leaderboard");

  return {
    status: 201,
    body: {
      mode: "submit",
      submissionId,
      status,
      passed: runResult.passed,
      // Hidden cases are reduced to pass/fail, except the first failing one (D-057).
      results: clientSubmitResults(testCases, runResult.results),
      runtimeMs: runResult.runtimeMs,
    },
  };
}
