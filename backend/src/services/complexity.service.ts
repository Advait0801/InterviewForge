import * as repo from "../repositories/complexity.repository";
import { complexityProblems, CodeRunnerFailedError, CodeRunnerUnreachableError } from "./code-runner.client";
import { classifyClaim, compareClaim, fitComplexity, type ComplexityFit } from "./complexity";
import { DomainError, badRequest, notFound } from "./errors";
import { RunQueueBusyError, RunQueueUnavailableError, measureQueued } from "./run-queue";

/**
 * Empirical complexity of a user's accepted submission (Phase 12): measure on growing
 * inputs, fit, store, and compare with the AI reviewer's stored claim. The comparison is
 * made when read, so a review written after the measurement is still compared.
 */

export type ComplexityAnalysis = {
  fit: ComplexityFit;
  stopped: "done" | "time_limit" | "error";
  error: string | null;
  errorAtN: number | null;
  measuredAt: string;
  claim: { text: string | null; class: ReturnType<typeof classifyClaim>; verdict: ReturnType<typeof compareClaim> };
};

const submissionNotFound = () => notFound("Submission not found");

function runnerError(err: unknown): unknown {
  if (err instanceof CodeRunnerUnreachableError || err instanceof RunQueueUnavailableError) {
    return new DomainError(503, "Code runner unavailable", { retryable: true });
  }
  if (err instanceof RunQueueBusyError) {
    return new DomainError(503, "Code runner is busy. Try again in a moment.", { retryable: true });
  }
  if (err instanceof CodeRunnerFailedError) return new DomainError(502, "Code runner unavailable");
  return err;
}

async function isSupported(slug: string): Promise<boolean> {
  try {
    return (await complexityProblems()).has(slug);
  } catch (err) {
    throw runnerError(err);
  }
}

async function present(submissionId: string, row: repo.ComplexityAnalysisRow): Promise<ComplexityAnalysis> {
  const text = await repo.findClaimedTimeComplexity(submissionId);
  const fit = row.fit as ComplexityFit;
  const cls = classifyClaim(text);
  return {
    fit,
    stopped: row.stopped,
    error: row.error,
    errorAtN: row.error_at_n,
    measuredAt: row.created_at,
    claim: { text, class: cls, verdict: compareClaim(fit, cls) },
  };
}

export async function analyzeSubmission(id: string, userId: string): Promise<ComplexityAnalysis> {
  const s = await repo.findComplexitySource(id, userId);
  if (!s) throw submissionNotFound();
  if (s.status !== "passed") throw badRequest("Only an accepted submission can be measured");
  if (!(await isSupported(s.slug))) throw badRequest("Complexity measurement isn't available for this problem");

  let measured;
  try {
    measured = await measureQueued({ language: s.language, code: s.code, slug: s.slug });
  } catch (err) {
    throw runnerError(err);
  }
  const row = await repo.saveComplexityAnalysis(s.id, {
    fit: fitComplexity(measured.points),
    stopped: measured.stopped,
    error: measured.error ?? null,
    errorAtN: measured.errorAtN ?? null,
  });
  return present(s.id, row);
}

/** `available` says whether this submission can be measured at all; `analysis` is the latest. */
export async function getSubmissionComplexity(
  id: string,
  userId: string
): Promise<{ available: boolean; analysis: ComplexityAnalysis | null }> {
  const s = await repo.findComplexitySource(id, userId);
  if (!s) throw submissionNotFound();
  const row = await repo.findComplexityAnalysis(s.id);
  // A runner that can't be reached can't measure either: not available right now, but the
  // stored analysis is still worth showing.
  const available = s.status === "passed" && (await isSupported(s.slug).catch(() => false));
  return { available, analysis: row ? await present(s.id, row) : null };
}
