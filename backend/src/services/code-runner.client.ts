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
  let response: Response;
  try {
    response = await fetch(`${codeRunnerUrl()}${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
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
