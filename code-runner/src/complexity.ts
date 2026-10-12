/**
 * Measure how a solution's running time grows with n (Phase 12).
 *
 * One sandbox: warm-ups, then generated inputs doubling in size, each timed inside the
 * program around the user's call alone (see GenerateOptions in harness-gen.ts). The run
 * stops at its time limit, and every size that finished is kept, so a quadratic solution
 * simply contributes fewer sizes. This module only measures; the fit and its verdict are
 * the backend's (services/complexity.ts).
 */
import { PROBLEM_META, type ProblemMeta } from "./problem-meta";
import { COMPLEXITY_SPECS, planCases, type PlannedCase } from "./complexity-inputs";
import { timingSupported, TIMING_PREFIX } from "./harness-gen";
import { runTimedSandbox, type TimedSandboxResult } from "./runner";
import type { SupportedLanguage, TestCase } from "./types";

export const COMPLEXITY_TIMEOUT_MS = Number(process.env.COMPLEXITY_TIMEOUT_MS || 20_000);
/** A size counts only with at least this many timed repeats. */
const MIN_SAMPLES = 2;

export type ComplexityPoint = { n: number; ns: number[] };

export type Measurement = {
  points: ComplexityPoint[];
  /** done: every size ran. time_limit: the largest sizes didn't fit. error: see `error`. */
  stopped: "done" | "time_limit" | "error";
  error?: string;
  /** The size whose case failed, when one did. */
  errorAtN?: number;
  elapsedMs: number;
};

type TimedRun = (
  language: SupportedLanguage,
  code: string,
  testCases: TestCase[],
  meta: ProblemMeta,
  timeoutMs: number
) => Promise<TimedSandboxResult>;

export function complexitySupported(slug: string): boolean {
  const meta = PROBLEM_META[slug];
  return Boolean(meta && COMPLEXITY_SPECS[slug] && timingSupported(meta));
}

export function supportedSlugs(): string[] {
  return Object.keys(COMPLEXITY_SPECS).filter(complexitySupported).sort();
}

function errorOf(line: string): string | null {
  try {
    const parsed = JSON.parse(line);
    if (parsed && typeof parsed === "object" && "__error" in parsed) return String(parsed.__error);
  } catch {
    /* a plain result */
  }
  return null;
}

/**
 * Pair the program's output with the planned cases. Each finished case wrote one result
 * line and one timing line (in either order, by language); a case that threw wrote an
 * error result and no timing, and nothing after it is used.
 */
export function parseTimedOutput(output: string, cases: PlannedCase[]): Omit<Measurement, "elapsedMs" | "stopped"> & { failed: boolean } {
  const results: string[] = [];
  const timings: number[] = [];
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.trim();
    // Results are JSON, so never empty: an empty line is only a trailing newline.
    if (line.startsWith(TIMING_PREFIX)) timings.push(Number(line.slice(TIMING_PREFIX.length).trim()));
    else if (line !== "") results.push(line);
  }

  let finished = Math.min(results.length, timings.length, cases.length);
  let error: string | undefined;
  let errorAtN: number | undefined;
  for (let i = 0; i < Math.min(results.length, cases.length); i++) {
    const e = errorOf(results[i]);
    if (e !== null) {
      finished = Math.min(finished, i);
      error = e;
      errorAtN = cases[i].n;
      break;
    }
  }
  if (results.length > cases.length) {
    // Extra lines mean the program printed something of its own: the pairing can't be trusted.
    return { points: [], failed: true, error: "The program printed output of its own; remove print statements and try again." };
  }

  const byN = new Map<number, number[]>();
  for (let i = 0; i < finished; i++) {
    if (cases[i].warmup || !Number.isFinite(timings[i]) || timings[i] < 0) continue;
    byN.set(cases[i].n, [...(byN.get(cases[i].n) ?? []), timings[i]]);
  }
  const points = [...byN.entries()]
    .filter(([, ns]) => ns.length >= MIN_SAMPLES)
    .sort(([a], [b]) => a - b)
    .map(([n, ns]) => ({ n, ns }));
  return { points, failed: error !== undefined, error, errorAtN };
}

export async function measureComplexity(
  req: { language: SupportedLanguage; code: string; slug: string },
  run: TimedRun = runTimedSandbox
): Promise<Measurement> {
  const meta = PROBLEM_META[req.slug];
  if (!meta || !complexitySupported(req.slug)) throw new Error(`Complexity isn't available for "${req.slug}"`);
  const cases = planCases(req.slug);
  const result = await run(
    req.language,
    req.code,
    cases.map((c) => ({ input: c.input, expectedOutput: "" })),
    meta,
    COMPLEXITY_TIMEOUT_MS
  );
  const parsed = parseTimedOutput(result.output, cases);

  // Nothing ran at all: a compile error, or a crash before the first case.
  if (!parsed.failed && parsed.points.length === 0 && !result.timedOut && result.statusCode !== 0) {
    return { points: [], stopped: "error", error: result.output.slice(0, 500) || "The program exited with an error", elapsedMs: result.elapsedMs };
  }
  if (parsed.failed) {
    return { points: parsed.points, stopped: "error", error: parsed.error, errorAtN: parsed.errorAtN, elapsedMs: result.elapsedMs };
  }
  return { points: parsed.points, stopped: result.timedOut ? "time_limit" : "done", elapsedMs: result.elapsedMs };
}
