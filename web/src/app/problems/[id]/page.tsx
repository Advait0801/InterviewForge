"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ProblemDetail } from "@/lib/api";
import { getToken } from "@/lib/auth";

type Language = "python3" | "cpp" | "c" | "java";

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "python3", label: "Python 3" },
  { value: "cpp", label: "C++" },
  { value: "c", label: "C" },
  { value: "java", label: "Java" },
];

type CaseResult = {
  passed: boolean;
  actualOutput?: string;
  error?: string;
};

type RunResponse = {
  mode: "run" | "submit";
  passed: boolean;
  results: CaseResult[];
  runtimeMs?: number;
  submissionId?: string;
  status?: string;
};

function DifficultyBadge({ d }: { d: string }) {
  const styles =
    d === "easy"
      ? "bg-accent/15 text-accent border-accent/25"
      : d === "medium"
        ? "bg-warning/15 text-warning border-warning/25"
        : "bg-error/15 text-error border-error/25";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase ${styles}`}>
      {d}
    </span>
  );
}

export default function WorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [language, setLanguage] = useState<Language>("python3");
  const [code, setCode] = useState("");
  const [runResult, setRunResult] = useState<RunResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"description" | "submissions">("description");
  const [resultTab, setResultTab] = useState<"result" | "testcases">("testcases");
  const [showResults, setShowResults] = useState(false);

  const prevStarterRef = useRef<string>("");

  useEffect(() => {
    if (!params.id) return;
    if (!getToken()) {
      router.push("/login");
      return;
    }
    api
      .getProblem(params.id)
      .then((res) => {
        setProblem(res.problem);
        const starter = res.problem.starter_code?.python3 || "";
        setCode(starter);
        prevStarterRef.current = starter;
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load problem");
      });
  }, [params.id, router]);

  const handleLanguageChange = (newLang: Language) => {
    if (!problem) return;
    const currentStarter = prevStarterRef.current;
    if (code === currentStarter || code === "") {
      const newStarter = problem.starter_code?.[newLang] || "";
      setCode(newStarter);
      prevStarterRef.current = newStarter;
    }
    setLanguage(newLang);
  };

  const handleRun = async () => {
    if (!problem) return;
    setRunning(true);
    setShowResults(true);
    setResultTab("result");
    try {
      const res = await api.runCode(problem.id, language, code);
      setRunResult({ ...res, mode: "run" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Run failed");
    } finally {
      setRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!problem) return;
    setSubmitting(true);
    setShowResults(true);
    setResultTab("result");
    try {
      const res = await api.submitCode(problem.id, language, code);
      setRunResult({ ...res, mode: "submit" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const sampleCases = problem?.test_cases?.slice(0, 3) ?? [];

  if (!problem) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background text-text-primary">
      {/* Toolbar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border glass px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/problems")}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-text-secondary transition-all hover:bg-surface-hover hover:text-text-primary"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Problems
          </button>
          <div className="h-5 w-px bg-border" />
          <h1 className="text-sm font-semibold">{problem.title}</h1>
          <DifficultyBadge d={problem.difficulty} />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value as Language)}
            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-primary transition focus:border-primary focus:outline-none"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>

          <button
            onClick={handleRun}
            disabled={running || submitting}
            className="rounded-lg border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/20 hover:border-primary/50 disabled:opacity-50 active:scale-[0.97]"
          >
            {running ? "Running..." : "Run"}
          </button>
          <button
            onClick={handleSubmit}
            disabled={running || submitting}
            className="rounded-lg bg-gradient-to-r from-accent to-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-accent/20 transition-all hover:shadow-lg hover:shadow-accent/30 disabled:opacity-50 active:scale-[0.97]"
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* Left pane — description */}
        <div className="flex w-full md:w-1/2 flex-col border-b md:border-b-0 md:border-r border-border">
          <div className="flex shrink-0 border-b border-border">
            <button
              onClick={() => setActiveTab("description")}
              className={`px-4 py-2.5 text-xs font-medium transition-all ${
                activeTab === "description"
                  ? "border-b-2 border-primary text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Description
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <div className="prose prose-sm max-w-none text-text-primary">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {problem.description}
              </div>

              {sampleCases.length > 0 && (
                <div className="mt-6">
                  <h3 className="mb-3 text-sm font-semibold text-text-primary">Examples</h3>
                  {sampleCases.map((tc, idx) => (
                    <div
                      key={idx}
                      className="mb-3 rounded-xl border border-border bg-surface/60 p-4"
                    >
                      <p className="mb-1.5 text-xs font-semibold text-text-secondary">
                        Example {idx + 1}:
                      </p>
                      <pre className="mono whitespace-pre-wrap text-xs text-text-primary leading-relaxed">
                        <span className="text-text-secondary">Input: </span>
                        {tc.input}
                      </pre>
                      <pre className="mono whitespace-pre-wrap text-xs text-text-primary leading-relaxed">
                        <span className="text-text-secondary">Output: </span>
                        {tc.expectedOutput}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right pane — editor + results */}
        <div className="flex w-full md:w-1/2 flex-col">
          {/* Code editor */}
          <div className={`flex flex-col ${showResults ? "h-3/5" : "flex-1"}`}>
            <div className="flex shrink-0 items-center border-b border-border px-4 py-2">
              <span className="mono text-xs font-medium text-text-secondary">Code</span>
            </div>
            <textarea
              className="mono flex-1 resize-none border-none bg-[#0a0e17] p-4 text-sm leading-relaxed text-green-400 outline-none placeholder:text-text-secondary/30 selection:bg-primary/30"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Write your solution here..."
              spellCheck={false}
            />
          </div>

          {/* Results panel */}
          {showResults && (
            <div className="flex h-2/5 flex-col border-t border-border">
              <div className="flex shrink-0 items-center justify-between border-b border-border">
                <div className="flex">
                  <button
                    onClick={() => setResultTab("result")}
                    className={`px-4 py-2.5 text-xs font-medium transition-all ${
                      resultTab === "result"
                        ? "border-b-2 border-primary text-primary"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    Result
                  </button>
                  <button
                    onClick={() => setResultTab("testcases")}
                    className={`px-4 py-2.5 text-xs font-medium transition-all ${
                      resultTab === "testcases"
                        ? "border-b-2 border-primary text-primary"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    Test Cases
                  </button>
                </div>
                <button
                  onClick={() => setShowResults(false)}
                  className="mr-3 rounded-lg p-1.5 text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 3L11 11M3 11L11 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {resultTab === "result" && (
                  <ResultPanel
                    result={runResult}
                    loading={running || submitting}
                    sampleCases={sampleCases}
                  />
                )}
                {resultTab === "testcases" && (
                  <div className="space-y-2">
                    {sampleCases.map((tc, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-border bg-surface/60 p-3"
                      >
                        <p className="mb-1 text-xs font-semibold text-text-secondary">
                          Case {idx + 1}
                        </p>
                        <pre className="mono whitespace-pre-wrap text-xs text-text-primary">
                          {tc.input}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom bar when results hidden */}
          {!showResults && (
            <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-2.5">
              <button
                onClick={() => {
                  setShowResults(true);
                  setResultTab("testcases");
                }}
                className="text-xs font-medium text-text-secondary transition hover:text-text-primary"
              >
                Console
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultPanel({
  result,
  loading,
  sampleCases,
}: {
  result: RunResponse | null;
  loading: boolean;
  sampleCases: Array<{ input: string; expectedOutput: string }>;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Running...
      </div>
    );
  }

  if (!result) {
    return (
      <p className="text-xs text-text-secondary">Run or submit your code to see results.</p>
    );
  }

  const passedCount = result.results.filter((r) => r.passed).length;
  const totalCount = result.results.length;
  const isAccepted = result.passed;
  const cases = result.mode === "run" ? sampleCases.slice(0, 3) : sampleCases;

  return (
    <div className="space-y-3">
      {/* Status banner */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`text-lg font-bold ${isAccepted ? "text-accent" : "text-error"}`}
          >
            {result.mode === "submit"
              ? isAccepted
                ? "Accepted"
                : "Wrong Answer"
              : isAccepted
                ? "All Sample Cases Passed"
                : "Sample Case Failed"}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-secondary">
          <span>
            {passedCount}/{totalCount} passed
          </span>
          {result.runtimeMs != null && <span>{result.runtimeMs}ms</span>}
        </div>
      </div>

      {/* Per-case breakdown */}
      <div className="space-y-2">
        {result.results.map((r, idx) => (
          <div
            key={idx}
            className={`rounded-xl border p-3 ${
              r.passed ? "border-accent/30 bg-accent/5" : "border-error/30 bg-error/5"
            }`}
          >
            <div className="mb-1 flex items-center gap-2">
              <span
                className={`text-xs font-semibold ${r.passed ? "text-accent" : "text-error"}`}
              >
                {r.passed ? "✓" : "✗"} Case {idx + 1}
              </span>
            </div>
            {cases[idx] && (
              <div className="mono space-y-0.5 text-xs">
                <div>
                  <span className="text-text-secondary">Input: </span>
                  <span className="text-text-primary">{cases[idx].input}</span>
                </div>
                <div>
                  <span className="text-text-secondary">Expected: </span>
                  <span className="text-text-primary">{cases[idx].expectedOutput}</span>
                </div>
                {r.actualOutput != null && (
                  <div>
                    <span className="text-text-secondary">Output: </span>
                    <span className={r.passed ? "text-accent" : "text-error"}>
                      {r.actualOutput}
                    </span>
                  </div>
                )}
                {r.error && (
                  <div>
                    <span className="text-text-secondary">Error: </span>
                    <span className="text-error">{r.error}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
