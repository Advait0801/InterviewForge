export type TestCase = { input: string; expectedOutput: string };

export type SupportedLanguage = "python3" | "c" | "cpp" | "java";

export interface RunRequest {
  language: SupportedLanguage;
  code: string;
  testCases: TestCase[];
  slug?: string;
}

export interface RunResult {
  passed: boolean;
  results: Array<{ passed: boolean; actualOutput?: string; error?: string }>;
  runtimeMs?: number;
  /**
   * Approximate peak resident memory in KB, sampled during execution.
   * Absent when the platform does not expose container memory stats.
   * See samplePeakMemoryBytes in runner.ts for why this is approximate.
   */
  memoryKb?: number;
}
