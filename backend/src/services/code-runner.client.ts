import type { TestCase } from "./test-cases";

export type RunResult = {
  passed: boolean;
  results: Array<{ passed: boolean; actualOutput?: string; error?: string }>;
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
};

export async function runCode(request: RunRequest): Promise<RunResult> {
  let response: Response;
  try {
    response = await fetch(`${codeRunnerUrl()}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
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

  return (await response.json()) as RunResult;
}
