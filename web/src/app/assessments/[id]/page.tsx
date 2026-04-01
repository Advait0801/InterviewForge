"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, Assessment, AssessmentProblem, ProblemDetail } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { WorkspaceLanguage } from "@/components/code-workspace-editor";

const CodeWorkspaceEditor = dynamic(
  () =>
    import("@/components/code-workspace-editor").then((m) => m.CodeWorkspaceEditor),
  { ssr: false, loading: () => <div className="flex flex-1 items-center justify-center bg-[#0a0e17] text-xs text-text-secondary">Loading editor…</div> },
);

type Language = WorkspaceLanguage;

const RUN_CASE_LIMIT = 4;

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "python3", label: "Python 3" },
  { value: "cpp", label: "C++" },
  { value: "c", label: "C" },
  { value: "java", label: "Java" },
];

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function AssessmentWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [problems, setProblems] = useState<AssessmentProblem[]>([]);
  const [remainingMs, setRemainingMs] = useState(0);
  const [activeProblemIdx, setActiveProblemIdx] = useState(0);
  const [problemDetails, setProblemDetails] = useState<Record<string, ProblemDetail>>({});
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [language, setLanguage] = useState<Language>("python3");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittingAll, setSubmittingAll] = useState(false);
  const [runResult, setRunResult] = useState<Record<string, { passed: boolean; results: Array<{ passed: boolean; actualOutput?: string; error?: string }>; runtimeMs?: number }>>({});
  const [loadingProblems, setLoadingProblems] = useState(true);
  const [problemLoadError, setProblemLoadError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const remainingRef = useRef(0);

  useEffect(() => {
    if (!params.id || !getToken()) {
      router.push("/login");
      return;
    }
    setLoadingProblems(true);
    setProblemLoadError(null);
    api.getAssessment(params.id).then(async (res) => {
      setAssessment(res.assessment);
      setProblems(res.problems);
      setRemainingMs(res.remainingMs);
      remainingRef.current = res.remainingMs;

      if (res.problems.length === 0) {
        setProblemLoadError("No problems assigned to this assessment.");
        setLoadingProblems(false);
        return;
      }

      const detailResults = await Promise.allSettled(
        res.problems.map((p) => api.getProblem(p.problem_id, true).then((d) => ({ problemId: p.problem_id, problem: d.problem })))
      );

      const loaded: Record<string, ProblemDetail> = {};
      const starterCodes: Record<string, string> = {};
      let failed = 0;

      for (const result of detailResults) {
        if (result.status === "fulfilled") {
          loaded[result.value.problemId] = result.value.problem;
          starterCodes[result.value.problemId] = result.value.problem.starter_code?.python3 || "";
        } else {
          failed += 1;
        }
      }

      setProblemDetails((prev) => ({ ...prev, ...loaded }));
      setCodes((prev) => ({ ...starterCodes, ...prev }));

      const firstLoadedIdx = res.problems.findIndex((p) => Boolean(loaded[p.problem_id]));
      if (firstLoadedIdx >= 0) {
        setActiveProblemIdx(firstLoadedIdx);
      } else {
        setProblemLoadError("Failed to load problem details for this assessment.");
      }

      if (failed > 0 && failed < res.problems.length) {
        toast.error(`Some problems failed to load (${failed}/${res.problems.length}).`);
      }
      if (failed === res.problems.length) {
        setProblemLoadError("Failed to load problem details for this assessment.");
      }

      setLoadingProblems(false);
    }).catch((err) => {
      const message = err instanceof Error ? err.message : "Failed to load assessment";
      toast.error(message);
      setProblemLoadError(message);
      setLoadingProblems(false);
    });
  }, [params.id, router]);

  useEffect(() => {
    if (!assessment || assessment.status !== "active") return;
    timerRef.current = setInterval(() => {
      remainingRef.current = Math.max(0, remainingRef.current - 1000);
      setRemainingMs(remainingRef.current);
      if (remainingRef.current <= 0 && timerRef.current) {
        clearInterval(timerRef.current);
        handleSubmitAll();
      }
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment?.id, assessment?.status]);

  const activeProblem = problems[activeProblemIdx];
  const activeDetail = activeProblem ? problemDetails[activeProblem.problem_id] : null;
  const activeCode = activeProblem ? (codes[activeProblem.problem_id] || "") : "";
  const activeResult = activeProblem ? runResult[activeProblem.problem_id] : null;

  const setActiveCode = (code: string) => {
    if (!activeProblem) return;
    setCodes((prev) => ({ ...prev, [activeProblem.problem_id]: code }));
  };

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang);
    if (activeProblem && activeDetail) {
      const currentStarter = activeDetail.starter_code?.[language] || "";
      const current = codes[activeProblem.problem_id] || "";
      if (current === currentStarter || current === "") {
        const newStarter = activeDetail.starter_code?.[newLang] || "";
        setCodes((prev) => ({ ...prev, [activeProblem.problem_id]: newStarter }));
      }
    }
  };

  const handleRun = async () => {
    if (!activeProblem) return;
    setRunning(true);
    try {
      const res = await api.runCode(activeProblem.problem_id, language, activeCode);
      setRunResult((prev) => ({ ...prev, [activeProblem.problem_id]: res }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Run failed");
    } finally {
      setRunning(false);
    }
  };

  const handleSubmitProblem = async () => {
    if (!activeProblem || !params.id) return;
    setSubmitting(true);
    try {
      const res = await api.submitCode(activeProblem.problem_id, language, activeCode);
      setRunResult((prev) => ({ ...prev, [activeProblem.problem_id]: res }));
      if (res.submissionId) {
        await api.linkAssessmentSubmission(params.id, activeProblem.problem_id, res.submissionId);
        setProblems((prev) =>
          prev.map((p) =>
            p.problem_id === activeProblem.problem_id
              ? { ...p, submission_id: res.submissionId, submission_status: res.status }
              : p
          )
        );
      }
      toast.success(res.passed ? "Accepted!" : "Wrong Answer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAll = useCallback(async () => {
    if (!params.id) return;
    setSubmittingAll(true);
    try {
      const res = await api.submitAssessment(params.id);
      setAssessment((prev) => prev ? { ...prev, status: "completed", score: res.score } : prev);
      if (timerRef.current) clearInterval(timerRef.current);
      toast.success(`Assessment complete! Score: ${res.score}%`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Final submission failed");
    } finally {
      setSubmittingAll(false);
    }
  }, [params.id]);

  const isActive = assessment?.status === "active";
  const isCompleted = assessment?.status === "completed";
  const timerUrgent = remainingMs < 5 * 60 * 1000 && remainingMs > 0;

  if (!assessment) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background text-text-primary gap-6 p-8">
        <h1 className="text-3xl font-bold">Assessment Complete</h1>
        <div className={`text-6xl font-bold ${(assessment.score ?? 0) >= 50 ? "text-accent" : "text-error"}`}>
          {assessment.score}%
        </div>
        <div className="text-text-secondary text-center max-w-md">
          <p>{problems.filter((p) => p.submission_status === "passed").length} of {problems.length} problems solved</p>
          <p className="mt-1 text-sm">Difficulty: {assessment.difficulty_mix} &middot; Time: {assessment.time_limit_minutes}m</p>
        </div>
        <div className="space-y-2 w-full max-w-md">
          {problems.map((p, i) => (
            <div key={p.id} className={`flex items-center justify-between rounded-xl border p-3 ${
              p.submission_status === "passed" ? "border-accent/30 bg-accent/5" : "border-error/30 bg-error/5"
            }`}>
              <span className="text-sm font-medium">Q{i + 1}: {p.title}</span>
              <span className={`text-xs font-semibold ${p.submission_status === "passed" ? "text-accent" : "text-error"}`}>
                {p.submission_status === "passed" ? "Solved" : p.submission_id ? "Failed" : "Unattempted"}
              </span>
            </div>
          ))}
        </div>
        <button
          onClick={() => router.push("/assessments")}
          className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-hover transition"
        >
          Back to Assessments
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background text-text-primary">
      {/* Toolbar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border glass px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/assessments")}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back
          </button>
          <div className="h-5 w-px bg-border" />
          <span className="text-sm font-semibold">Online Assessment</span>
          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-text-secondary border border-border">
            {assessment.difficulty_mix}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className={`mono text-lg font-bold tabular-nums ${timerUrgent ? "text-error animate-pulse" : "text-text-primary"}`}>
            {formatTime(remainingMs)}
          </div>
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value as Language)}
            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-primary transition focus:border-primary focus:outline-none"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <button onClick={handleRun} disabled={running || submitting}
            className="rounded-lg border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/20 disabled:opacity-50">
            {running ? "Running..." : "Run"}
          </button>
          <button onClick={handleSubmitProblem} disabled={running || submitting}
            className="rounded-lg bg-gradient-to-r from-accent to-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-accent/20 transition-all hover:shadow-lg disabled:opacity-50">
            {submitting ? "Submitting..." : "Submit Problem"}
          </button>
          <button onClick={handleSubmitAll} disabled={submittingAll}
            className="rounded-lg bg-gradient-to-r from-error to-red-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-error/20 transition-all hover:shadow-lg disabled:opacity-50">
            {submittingAll ? "Finishing..." : "Finish All"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* Left pane — problem tabs + description */}
        <div className="flex w-full md:w-1/2 flex-col border-b md:border-b-0 md:border-r border-border">
          <div className="flex shrink-0 border-b border-border overflow-x-auto">
            {problems.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setActiveProblemIdx(i)}
                className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-xs font-medium transition-all ${
                  activeProblemIdx === i
                    ? "border-b-2 border-primary text-primary"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Q{i + 1}
                {p.submission_status === "passed" && (
                  <span className="h-2 w-2 rounded-full bg-accent" />
                )}
                {p.submission_id && p.submission_status !== "passed" && (
                  <span className="h-2 w-2 rounded-full bg-error" />
                )}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {activeDetail ? (
              <div className="prose prose-sm max-w-none text-text-primary">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-lg font-bold m-0">{activeDetail.title}</h2>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase ${
                    activeDetail.difficulty === "easy" ? "bg-accent/15 text-accent border-accent/25"
                    : activeDetail.difficulty === "medium" ? "bg-warning/15 text-warning border-warning/25"
                    : "bg-error/15 text-error border-error/25"
                  }`}>{activeDetail.difficulty}</span>
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{activeDetail.description}</div>
                {activeDetail.test_cases?.slice(0, RUN_CASE_LIMIT).map((tc, idx) => (
                  <div key={idx} className="mb-3 rounded-xl border border-border bg-surface/60 p-4 mt-4">
                    <p className="mb-1.5 text-xs font-semibold text-text-secondary">Example {idx + 1}:</p>
                    <pre className="mono whitespace-pre-wrap text-xs leading-relaxed">
                      <span className="text-text-secondary">Input: </span>{tc.input}
                    </pre>
                    <pre className="mono whitespace-pre-wrap text-xs leading-relaxed">
                      <span className="text-text-secondary">Output: </span>{tc.expectedOutput}
                    </pre>
                  </div>
                ))}
              </div>
            ) : loadingProblems ? (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Loading problem...
              </div>
            ) : problemLoadError ? (
              <div className="rounded-xl border border-error/30 bg-error/5 p-4 text-sm text-error">
                {problemLoadError}
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-surface/60 p-4 text-sm text-text-secondary">
                Problem details unavailable for this question.
              </div>
            )}
          </div>
        </div>

        {/* Right pane — editor + results */}
        <div className="flex w-full min-h-0 flex-1 flex-col md:w-1/2">
          <div className={`flex min-h-0 flex-col ${activeResult ? "h-3/5" : "flex-1"}`}>
            <div className="flex shrink-0 items-center border-b border-border px-4 py-2">
              <span className="mono text-xs font-medium text-text-secondary">Code</span>
            </div>
            <CodeWorkspaceEditor
              language={language}
              value={activeCode}
              onChange={setActiveCode}
              readOnly={!isActive}
              className="min-h-0 flex-1"
            />
          </div>

          {activeResult && (
            <div className="flex h-2/5 flex-col border-t border-border">
              <div className="flex shrink-0 items-center border-b border-border px-4 py-2">
                <span className="text-xs font-medium text-text-secondary">Result</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-bold ${activeResult.passed ? "text-accent" : "text-error"}`}>
                    {activeResult.passed ? "All Passed" : "Failed"}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {activeResult.results.filter((r) => r.passed).length}/{activeResult.results.length} passed
                    {activeResult.runtimeMs != null && ` · ${activeResult.runtimeMs}ms`}
                  </span>
                </div>
                {activeResult.results.map((r, idx) => (
                  <div key={idx} className={`rounded-xl border p-3 ${r.passed ? "border-accent/30 bg-accent/5" : "border-error/30 bg-error/5"}`}>
                    <span className={`text-xs font-semibold ${r.passed ? "text-accent" : "text-error"}`}>
                      {r.passed ? "Pass" : "Fail"} Case {idx + 1}
                    </span>
                    {r.actualOutput != null && (
                      <p className="mono mt-1 text-xs"><span className="text-text-secondary">Output: </span>{r.actualOutput}</p>
                    )}
                    {r.error && (
                      <p className="mono mt-1 text-xs text-error">{r.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
