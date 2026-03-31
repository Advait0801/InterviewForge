"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ProblemDetail, Submission, SubmissionDetail } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { WorkspaceLanguage } from "@/components/code-workspace-editor";

const CodeWorkspaceEditor = dynamic(
  () =>
    import("@/components/code-workspace-editor").then((m) => m.CodeWorkspaceEditor),
  { ssr: false, loading: () => <div className="flex flex-1 items-center justify-center bg-[#0a0e17] text-xs text-text-secondary">Loading editor…</div> },
);

type Language = WorkspaceLanguage;

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "python3", label: "Python 3" },
  { value: "cpp", label: "C++" },
  { value: "c", label: "C" },
  { value: "java", label: "Java" },
];

const LANG_KEY = "if-preferred-lang";
const VALID_LANGS = new Set<string>(["python3", "cpp", "c", "java"]);

/** Matches backend RUN_CASE_LIMIT */
const RUN_CASE_LIMIT = 4;

/** Show at most this many passed rows expanded on submit (rest collapsed). */
const SUBMIT_EXPAND_PASSED_CAP = 8;

function getSavedLanguage(): Language {
  if (typeof window === "undefined") return "python3";
  const saved = localStorage.getItem(LANG_KEY);
  return saved && VALID_LANGS.has(saved) ? (saved as Language) : "python3";
}

function saveLanguage(lang: Language) {
  localStorage.setItem(LANG_KEY, lang);
}

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
  const [language, setLanguage] = useState<Language>(getSavedLanguage);
  const [code, setCode] = useState("");
  const [runResult, setRunResult] = useState<RunResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"description" | "submissions">("description");
  const [resultTab, setResultTab] = useState<"result" | "testcases">("testcases");
  const [showResults, setShowResults] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [submissionDetail, setSubmissionDetail] = useState<SubmissionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const prevStarterRef = useRef<string>("");

  useEffect(() => {
    if (!params.id) return;
    if (!getToken()) {
      router.push("/login");
      return;
    }
    const preferredLang = getSavedLanguage();
    setLanguage(preferredLang);

    api
      .getProblem(params.id)
      .then(async (res) => {
        setProblem(res.problem);
        const starter = res.problem.starter_code?.[preferredLang] || "";
        prevStarterRef.current = starter;

        try {
          const subRes = await api.getSubmissions(params.id);
          const forLang = subRes.submissions.filter((s) => s.language === preferredLang);
          if (forLang.length > 0) {
            const detail = await api.getSubmission(forLang[0].id);
            setCode(detail.submission.code);
            return;
          }
        } catch {
          /* use starter */
        }
        setCode(starter);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load problem");
      });
  }, [params.id, router]);

  const fetchSubmissions = async () => {
    if (!params.id) return;
    setLoadingSubmissions(true);
    try {
      const res = await api.getSubmissions(params.id);
      setSubmissions(res.submissions);
    } catch {
      /* silent — non-critical */
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const openSubmissionDetail = useCallback(async (id: string) => {
    setDetailId(id);
    setSubmissionDetail(null);
    setLoadingDetail(true);
    try {
      const res = await api.getSubmission(id);
      setSubmissionDetail(res.submission);
    } catch {
      toast.error("Could not load submission");
      setDetailId(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const handleLanguageChange = (newLang: Language) => {
    if (!problem) return;
    const oldStarter = problem.starter_code?.[language] || "";
    const newStarter = problem.starter_code?.[newLang] || "";

    if (code === oldStarter || code === "") {
      api
        .getSubmissions(problem.id)
        .then(async (res) => {
          setSubmissions(res.submissions);
          const forLang = res.submissions.filter((s) => s.language === newLang);
          if (forLang.length > 0) {
            try {
              const d = await api.getSubmission(forLang[0].id);
              setCode(d.submission.code);
            } catch {
              setCode(newStarter);
            }
          } else {
            setCode(newStarter);
          }
          prevStarterRef.current = newStarter;
        })
        .catch(() => {
          setCode(newStarter);
          prevStarterRef.current = newStarter;
        });
    }
    setLanguage(newLang);
    saveLanguage(newLang);
  };

  const handleRun = async () => {
    if (!problem) return;
    setRunning(true);
    setShowResults(true);
    setResultTab("result");
    try {
      const res = await api.runCode(problem.id, language, code);
      setRunResult({ ...res, mode: "run" });
      saveLanguage(language);
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
      saveLanguage(language);
      fetchSubmissions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const exampleCases = problem?.test_cases?.slice(0, RUN_CASE_LIMIT) ?? [];
  const runCaseInputs = problem?.test_cases?.slice(0, RUN_CASE_LIMIT) ?? [];
  const fullTestCases = problem?.test_cases ?? [];

  if (!problem) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background text-text-primary">
      {detailId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-background shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Submission</p>
                {submissionDetail && (
                  <p className="text-[11px] text-text-secondary">
                    {submissionDetail.status === "passed" ? "Accepted" : "Wrong Answer"} · {submissionDetail.language} ·{" "}
                    {new Date(submissionDetail.created_at).toLocaleString()}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetailId(null);
                  setSubmissionDetail(null);
                }}
                className="rounded-lg p-2 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              >
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                  <path d="M3 3L11 11M3 11L11 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="flex shrink-0 gap-2 border-b border-border px-4 py-2">
              <button
                type="button"
                disabled={!submissionDetail}
                onClick={() => {
                  if (!submissionDetail) return;
                  setCode(submissionDetail.code);
                  setLanguage(submissionDetail.language as Language);
                  saveLanguage(submissionDetail.language as Language);
                  setDetailId(null);
                  setSubmissionDetail(null);
                  toast.success("Loaded into editor");
                }}
                className="rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/25 disabled:opacity-50"
              >
                Load into editor
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden p-2" style={{ height: "min(60vh, 480px)" }}>
              {loadingDetail || !submissionDetail ? (
                <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-text-secondary">Loading…</div>
              ) : (
                <CodeWorkspaceEditor
                  language={submissionDetail.language as Language}
                  value={submissionDetail.code}
                  onChange={() => {}}
                  readOnly
                  className="h-full min-h-[280px]"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border glass px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/problems")}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-text-secondary transition-all hover:bg-surface-hover hover:text-text-primary"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
            className="rounded-lg border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary transition-all hover:border-primary/50 hover:bg-primary/20 disabled:opacity-50 active:scale-[0.97]"
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
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        {/* Left pane — description */}
        <div className="flex w-full min-h-0 flex-col border-b md:w-1/2 md:border-b-0 md:border-r md:border-border">
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
            <button
              onClick={() => {
                setActiveTab("submissions");
                fetchSubmissions();
              }}
              className={`px-4 py-2.5 text-xs font-medium transition-all ${
                activeTab === "submissions"
                  ? "border-b-2 border-primary text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Submissions
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {activeTab === "description" && (
              <div className="prose prose-sm max-w-none text-text-primary">
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{problem.description}</div>

                {exampleCases.length > 0 && (
                  <div className="mt-6">
                    <h3 className="mb-3 text-sm font-semibold text-text-primary">Examples</h3>
                    {exampleCases.map((tc, idx) => (
                      <div key={idx} className="mb-3 rounded-xl border border-border bg-surface/60 p-4">
                        <p className="mb-1.5 text-xs font-semibold text-text-secondary">Example {idx + 1}:</p>
                        <pre className="mono whitespace-pre-wrap text-xs leading-relaxed text-text-primary">
                          <span className="text-text-secondary">Input: </span>
                          {tc.input}
                        </pre>
                        <pre className="mono whitespace-pre-wrap text-xs leading-relaxed text-text-primary">
                          <span className="text-text-secondary">Output: </span>
                          {tc.expectedOutput}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeTab === "submissions" && (
              <SubmissionsPanel
                submissions={submissions}
                loading={loadingSubmissions}
                onOpenDetail={openSubmissionDetail}
              />
            )}
          </div>
        </div>

        {/* Right pane — editor + results */}
        <div className="flex w-full min-h-0 flex-1 flex-col md:w-1/2">
          <div className={`flex min-h-0 flex-col ${showResults ? "h-3/5" : "flex-1"}`}>
            <div className="flex shrink-0 items-center border-b border-border px-4 py-2">
              <span className="mono text-xs font-medium text-text-secondary">Code</span>
            </div>
            <CodeWorkspaceEditor
              language={language}
              value={code}
              onChange={setCode}
              className="min-h-0 flex-1"
            />
          </div>

          {showResults && (
            <div className="flex h-2/5 min-h-0 flex-col border-t border-border">
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
                    <path d="M3 3L11 11M3 11L11 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {resultTab === "result" && (
                  <ResultPanel
                    result={runResult}
                    loading={running || submitting}
                    runCaseInputs={runCaseInputs}
                    submitCaseInputs={fullTestCases}
                    expandPassedCap={SUBMIT_EXPAND_PASSED_CAP}
                  />
                )}
                {resultTab === "testcases" && (
                  <div className="space-y-2">
                    {exampleCases.map((tc, idx) => (
                      <div key={idx} className="rounded-xl border border-border bg-surface/60 p-3">
                        <p className="mb-1 text-xs font-semibold text-text-secondary">Case {idx + 1}</p>
                        <pre className="mono whitespace-pre-wrap text-xs text-text-primary">{tc.input}</pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

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

function SubmissionsPanel({
  submissions,
  loading,
  onOpenDetail,
}: {
  submissions: Submission[];
  loading: boolean;
  onOpenDetail: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Loading submissions...
      </div>
    );
  }

  if (submissions.length === 0) {
    return <p className="text-xs text-text-secondary">No submissions yet. Submit your code to see results here.</p>;
  }

  return (
    <div className="space-y-2">
      {submissions.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onOpenDetail(s.id)}
          className={`w-full rounded-xl border p-3 text-left transition hover:opacity-90 ${
            s.status === "passed" ? "border-accent/30 bg-accent/5" : "border-error/30 bg-error/5"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${s.status === "passed" ? "text-accent" : "text-error"}`}>
                {s.status === "passed" ? "Accepted" : "Wrong Answer"}
              </span>
              <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                {s.language}
              </span>
            </div>
            <span className="text-[10px] text-text-secondary">{new Date(s.created_at).toLocaleString()}</span>
          </div>
          <div className="mt-1.5 flex gap-3 text-[11px] text-text-secondary">
            {s.runtime_ms != null && <span>Runtime: {s.runtime_ms}ms</span>}
            {s.memory_kb != null && <span>Memory: {s.memory_kb}KB</span>}
          </div>
          <p className="mt-2 text-[10px] text-text-secondary">Click to view code</p>
        </button>
      ))}
    </div>
  );
}

function ResultPanel({
  result,
  loading,
  runCaseInputs,
  submitCaseInputs,
  expandPassedCap,
}: {
  result: RunResponse | null;
  loading: boolean;
  runCaseInputs: Array<{ input: string; expectedOutput: string }>;
  submitCaseInputs: Array<{ input: string; expectedOutput: string }>;
  expandPassedCap: number;
}) {
  const [showAllPassed, setShowAllPassed] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Running...
      </div>
    );
  }

  if (!result) {
    return <p className="text-xs text-text-secondary">Run or submit your code to see results.</p>;
  }

  const passedCount = result.results.filter((r) => r.passed).length;
  const totalCount = result.results.length;
  const isAccepted = result.passed;
  const cases = result.mode === "run" ? runCaseInputs : submitCaseInputs;

  const failedIndices: number[] = [];
  const passedIndices: number[] = [];
  result.results.forEach((r, i) => {
    if (r.passed) passedIndices.push(i);
    else failedIndices.push(i);
  });

  const isSubmitBulk = result.mode === "submit" && totalCount > expandPassedCap;
  const passedToShow =
    isSubmitBulk && !showAllPassed ? passedIndices.slice(0, expandPassedCap) : passedIndices;
  const passedHidden = isSubmitBulk && !showAllPassed ? Math.max(0, passedIndices.length - expandPassedCap) : 0;
  const indicesOrder = [...failedIndices, ...passedToShow];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${isAccepted ? "text-accent" : "text-error"}`}>
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

      {isSubmitBulk && (
        <p className="text-[11px] text-text-secondary">
          Showing all failed cases first; then up to {expandPassedCap} passed cases
          {passedHidden > 0 ? ` (${passedHidden} more passed hidden)` : ""}.
        </p>
      )}

      {isSubmitBulk && passedIndices.length > expandPassedCap && (
        <button
          type="button"
          onClick={() => setShowAllPassed((v) => !v)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {showAllPassed ? "Collapse passed cases" : `Show all ${passedIndices.length} passed cases`}
        </button>
      )}

      <div className="space-y-2">
        {(isSubmitBulk ? indicesOrder : result.results.map((_, i) => i)).map((idx) => {
          const r = result.results[idx];
          return (
            <div
              key={idx}
              className={`rounded-xl border p-3 ${r.passed ? "border-accent/30 bg-accent/5" : "border-error/30 bg-error/5"}`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span className={`text-xs font-semibold ${r.passed ? "text-accent" : "text-error"}`}>
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
                      <span className={r.passed ? "text-accent" : "text-error"}>{r.actualOutput}</span>
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
          );
        })}
      </div>
    </div>
  );
}
