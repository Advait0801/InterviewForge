import type { CaseResult, TestCase } from "./test-cases";

export type CustomCaseResult = CaseResult & {
  input: string;
  judged: boolean;
  expectedOutput?: string;
  inputError?: string;
};

export type RunResult = {
  passed: boolean;
  results: CaseResult[];
  customResults?: CustomCaseResult[];
  runtimeMs?: number;
  memoryKb?: number;
};

/** code-runner couldn't be reached at all (connection refused, DNS failure, timeout). */
export class CodeRunnerUnreachableError extends Error {}

/** code-runner answered, but not with a result. */
export class CodeRunnerFailedError extends Error {}

/** Read per call, not at load: tests point it at a stand-in after import. */
const codeRunnerUrl = () => process.env.CODE_RUNNER_URL || "http://code-runner:5000";

export type RunRequest = {
  language: string;
  code: string;
  testCases: TestCase[];
  slug: string;
  /** Run only: the user's inputs, judged against the reference solution's output on them. */
  customCases?: { inputs: string[]; reference: { language: string; code: string } };
};

async function post<T>(route: string, body: unknown): Promise<T> {
  return send<T>(route, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

async function send<T>(route: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${codeRunnerUrl()}${route}`, init);
  } catch (err) {
    console.error("Code runner unreachable", err);
    throw new CodeRunnerUnreachableError("Code runner unreachable");
  }

  if (!response.ok) {
    const text = await response.text();
    console.error("Code runner error", text);
    throw new CodeRunnerFailedError(`Code runner returned ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function runCode(request: RunRequest): Promise<RunResult> {
  return post<RunResult>("/run", request);
}

/**
 * Check custom inputs against the problem's signature: one message per input, null when
 * it's usable. No sandbox runs, so this is called directly rather than through the queue.
 */
export async function validateCustomInputs(slug: string, inputs: string[]): Promise<(string | null)[]> {
  const { errors } = await post<{ errors: (string | null)[] }>("/validate", { slug, inputs });
  return errors;
}

/** A size and its timed repeats, in nanoseconds (code-runner/src/complexity.ts). */
export type ComplexityMeasurement = {
  points: Array<{ n: number; ns: number[] }>;
  stopped: "done" | "time_limit" | "error";
  error?: string;
  errorAtN?: number;
  elapsedMs: number;
};

export type ComplexityRequest = { language: string; code: string; slug: string };

/** One timed sandbox run on inputs doubling in size. Queue it (run-queue.ts), don't call it directly. */
export async function measureComplexity(request: ComplexityRequest): Promise<ComplexityMeasurement> {
  return post<ComplexityMeasurement>("/complexity", request);
}

const SUPPORTED_TTL_MS = 5 * 60 * 1000;
let supported: { slugs: Set<string>; at: number } | null = null;

/**
 * The problems the code-runner has growing inputs for. Cached: the list only changes with a
 * code-runner deploy. Throws like any call when the runner is down.
 */
export async function complexityProblems(now = Date.now()): Promise<Set<string>> {
  if (supported && now - supported.at < SUPPORTED_TTL_MS) return supported.slugs;
  const { slugs } = await send<{ slugs: string[] }>("/complexity/problems", { method: "GET" });
  supported = { slugs: new Set(slugs), at: now };
  return supported.slugs;
}

/** Tests only. */
export function resetComplexityProblemsCache(): void {
  supported = null;
}
