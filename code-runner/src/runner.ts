import Docker from "dockerode";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

export type TestCase = { input: string; expectedOutput: string };

export type SupportedLanguage = "python" | "c" | "cpp" | "java";

export interface RunRequest {
  language: SupportedLanguage;
  code: string;
  testCases: TestCase[];
}

export interface RunResult {
  passed: boolean;
  results: Array<{ passed: boolean; actualOutput?: string; error?: string }>;
  runtimeMs?: number;
}

const LANGUAGE_IMAGES: Record<SupportedLanguage, string> = {
  python: "interviewforge-python-sandbox:latest",
  c: "interviewforge-c-sandbox:latest",
  cpp: "interviewforge-cpp-sandbox:latest",
  java: "interviewforge-java-sandbox:latest",
};

export async function runCode(req: RunRequest): Promise<RunResult> {
  const image = LANGUAGE_IMAGES[req.language];

  // For now, stub implementation that just returns “not implemented”
  const results = req.testCases.map(() => ({
    passed: false,
    error: "Sandbox execution not implemented yet",
  }));

  // Later (Day 7): use docker.createContainer, container.start, docker.exec etc.

  return {
    passed: false,
    results,
    runtimeMs: undefined,
  };
}