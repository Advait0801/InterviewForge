import type { OutputDiff } from "./diff";

export type TestCase = { input: string; expectedOutput: string };

export type SupportedLanguage = "python3" | "c" | "cpp" | "java" | "javascript" | "go" | "rust";

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ["python3", "c", "cpp", "java", "javascript", "go", "rust"];

export interface RunRequest {
  language: SupportedLanguage;
  code: string;
  testCases: TestCase[];
  slug?: string;
  /**
   * The user's own inputs (Run only). Their expected outputs come from running
   * `reference` -- the problem's verified reference solution -- on them first.
   */
  customCases?: { inputs: string[]; reference: { language: SupportedLanguage; code: string } };
}

export type CaseResult = { passed: boolean; actualOutput?: string; error?: string; diff?: OutputDiff };

export type CustomCaseResult = CaseResult & {
  input: string;
  /** False when there was nothing to judge against: the input was unusable or the reference couldn't run it. */
  judged: boolean;
  expectedOutput?: string;
  /** Why the case wasn't judged. */
  inputError?: string;
};

export interface RunResult {
  passed: boolean;
  results: CaseResult[];
  customResults?: CustomCaseResult[];
  runtimeMs?: number;
  /**
   * Approximate peak resident memory in KB, sampled during execution.
   * Absent when the platform does not expose container memory stats.
   * See samplePeakMemoryBytes in runner.ts for why this is approximate.
   */
  memoryKb?: number;
}
