/**
 * Which test cases a client may see (D-057).
 *
 * The first EXAMPLE_CASE_LIMIT cases are public examples: shown on the problem page and
 * used by Run. The rest are hidden: Submit runs them, but a client never receives their
 * contents, or the suite could be read off the API and hard-coded. As on LeetCode, the
 * one exception is the first hidden case a submission fails, which is revealed so the
 * user can debug it.
 */
export type TestCase = { input: string; expectedOutput: string };

/**
 * Where a failing output departs from the expected one (code-runner/src/diff.ts). It's part
 * of its case's result, so it reaches a client exactly when the case's contents do.
 */
export type OutputDiff =
  | { kind: "format" }
  | { kind: "type"; path: number[]; expectedType: string; actualType: string }
  | { kind: "value"; path: number[]; expected: string | number | boolean | null; actual: string | number | boolean | null; charIndex?: number }
  | { kind: "length"; path: number[]; expectedLength: number; actualLength: number }
  | { kind: "items"; missing: unknown[]; unexpected: unknown[]; expectedLength: number; actualLength: number };

export type CaseResult = { passed: boolean; actualOutput?: string; error?: string; diff?: OutputDiff };
export type ClientCaseResult =
  | (CaseResult & { input: string; expectedOutput: string; hidden: false })
  | { passed: boolean; hidden: true };

export const EXAMPLE_CASE_LIMIT = 4;

export function exampleCases(all: TestCase[] | null | undefined): TestCase[] {
  return (all ?? []).slice(0, EXAMPLE_CASE_LIMIT);
}

/**
 * Attach each case's input and expected output to its result where the client may see
 * them, and reduce the rest to pass/fail. A hidden case's actual output is dropped even
 * when it passed: a passing output *is* the expected output.
 */
export function clientSubmitResults(cases: TestCase[], results: CaseResult[]): ClientCaseResult[] {
  const firstFailedHidden = results.findIndex((r, i) => i >= EXAMPLE_CASE_LIMIT && !r.passed);
  return results.map((r, i) => {
    const visible = i < EXAMPLE_CASE_LIMIT || i === firstFailedHidden;
    if (!visible || !cases[i]) return { passed: r.passed, hidden: true };
    return { ...r, input: cases[i].input, expectedOutput: cases[i].expectedOutput, hidden: false };
  });
}
