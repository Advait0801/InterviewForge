"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, Assessment, AssessmentProblem, ProblemDetail, SubmissionDetail } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { WorkspaceLanguage } from "@/components/code-workspace-editor";
import { WorkspacePaneSwitcher, type WorkspacePane } from "@/components/workspace-pane-switcher";
import { Button } from "@/components/ui/button";
import { LoadingState, StatePanel } from "@/components/ui/state-panel";

const CodeWorkspaceEditor = dynamic(
  () => import("@/components/code-workspace-editor").then((module) => module.CodeWorkspaceEditor),
  {
    ssr: false,
    loading: () => <LoadingState label="Loading editor" className="h-full min-h-64 bg-surface" />,
  },
);

type Language = WorkspaceLanguage;
type ConsoleTab = "result" | "testcases";
type ExecutionResult = {
  passed: boolean;
  results: Array<{ passed: boolean; actualOutput?: string; error?: string; hidden?: boolean }>;
  runtimeMs?: number;
};

const RUN_CASE_LIMIT = 4;
const LANG_KEY = "if-preferred-lang";
const LANGUAGES: { value: Language; label: string }[] = [
  { value: "python3", label: "Python 3" },
  { value: "cpp", label: "C++" },
  { value: "c", label: "C" },
  { value: "java", label: "Java" },
];

function getSavedLanguage(): Language {
  if (typeof window === "undefined") return "python3";
  const saved = localStorage.getItem(LANG_KEY);
  return LANGUAGES.some((language) => language.value === saved) ? (saved as Language) : "python3";
}

function codeKey(problemId: string, language: Language) {
  return `${problemId}:${language}`;
}

export function formatAssessmentTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function difficultyClasses(difficulty: string) {
  if (difficulty === "easy") return "border-accent/25 bg-accent/10 text-accent";
  if (difficulty === "medium") return "border-warning/25 bg-warning/10 text-warning";
  return "border-error/25 bg-error/10 text-error";
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
  const [language, setLanguage] = useState<Language>(getSavedLanguage);
  const [runResults, setRunResults] = useState<Record<string, ExecutionResult>>({});
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>("testcases");
  const [mobilePane, setMobilePane] = useState<WorkspacePane>("problem");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [partialLoadError, setPartialLoadError] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittingAll, setSubmittingAll] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const deadlineRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadSequenceRef = useRef(0);
  const loadedAssessmentIdRef = useRef<string | null>(null);
  const finishingRef = useRef(false);
  const automaticFinishAttemptedRef = useRef(false);
  const submissionPromiseRef = useRef<Promise<void> | null>(null);

  const activeProblem = problems[activeProblemIdx];
  const activeDetail = activeProblem ? problemDetails[activeProblem.problem_id] : null;
  const activeCode = activeProblem ? (codes[codeKey(activeProblem.problem_id, language)] ?? "") : "";
  const activeResult = activeProblem ? runResults[activeProblem.problem_id] : null;
  const isCompleted = assessment?.status === "completed";
  const isActive = assessment?.status === "active";
  const canWork = Boolean(isActive && remainingMs > 0 && !timedOut && activeDetail);
  const timerUrgent = remainingMs > 0 && remainingMs <= 5 * 60 * 1000;
  const attemptedCount = problems.filter((problem) => Boolean(problem.submission_id)).length;
  const progressLabel = `${attemptedCount} of ${problems.length} problems attempted`;
  const assessmentId = assessment?.id;
  const assessmentStatus = assessment?.status;

  const loadWorkspace = useCallback(async () => {
    if (!params.id || !getToken()) {
      router.push("/login");
      return;
    }
    const sequence = ++loadSequenceRef.current;
    if (loadedAssessmentIdRef.current !== params.id) {
      setAssessment(null);
      setProblems([]);
      setProblemDetails({});
      setCodes({});
      setRunResults({});
      setActiveProblemIdx(0);
    }
    setLoading(true);
    setLoadError(null);
    setPartialLoadError(null);
    setFinishError(null);
    try {
      const response = await api.getAssessment(params.id);
      if (sequence !== loadSequenceRef.current) return;
      loadedAssessmentIdRef.current = params.id;
      setAssessment(response.assessment);
      setProblems(response.problems);
      setRemainingMs(response.remainingMs);
      setTimedOut(response.assessment.status === "active" && response.remainingMs <= 0);
      deadlineRef.current = Date.now() + response.remainingMs;
      automaticFinishAttemptedRef.current = false;

      const detailResults = await Promise.allSettled(
        response.problems.map(async (problem) => {
          const detail = await api.getProblem(problem.problem_id, true);
          let restored: SubmissionDetail | null = null;
          if (problem.submission_id) {
            try {
              restored = (await api.getSubmission(problem.submission_id)).submission;
            } catch {
              restored = null;
            }
          }
          return { problemId: problem.problem_id, detail: detail.problem, restored };
        }),
      );
      if (sequence !== loadSequenceRef.current) return;

      const details: Record<string, ProblemDetail> = {};
      const initialCodes: Record<string, string> = {};
      let failed = 0;
      for (const result of detailResults) {
        if (result.status === "rejected") {
          failed += 1;
          continue;
        }
        const { problemId, detail, restored } = result.value;
        details[problemId] = detail;
        for (const option of LANGUAGES) {
          initialCodes[codeKey(problemId, option.value)] = detail.starter_code?.[option.value] ?? "";
        }
        if (restored && LANGUAGES.some((option) => option.value === restored.language)) {
          initialCodes[codeKey(problemId, restored.language as Language)] = restored.code;
        }
      }
      setProblemDetails(details);
      setCodes((previous) => ({ ...initialCodes, ...previous }));
      const firstLoadedIndex = response.problems.findIndex((problem) => Boolean(details[problem.problem_id]));
      setActiveProblemIdx(firstLoadedIndex >= 0 ? firstLoadedIndex : 0);
      if (failed === response.problems.length) {
        setPartialLoadError("Problem details could not be loaded for this assessment.");
      } else if (failed > 0) {
        setPartialLoadError(`${failed} problem${failed === 1 ? "" : "s"} could not be loaded. You can continue with the others.`);
      }
    } catch (error) {
      if (sequence !== loadSequenceRef.current) return;
      setLoadError(error instanceof Error ? error.message : "The assessment could not be loaded.");
    } finally {
      if (sequence === loadSequenceRef.current) setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    void loadWorkspace();
    return () => {
      loadSequenceRef.current += 1;
    };
  }, [loadWorkspace]);

  const finishAssessment = useCallback(async (automatic = false) => {
    if (!params.id || finishingRef.current) return;
    finishingRef.current = true;
    setSubmittingAll(true);
    setFinishError(null);
    try {
      if (submissionPromiseRef.current) await submissionPromiseRef.current;
      const response = await api.submitAssessment(params.id);
      setAssessment((previous) => previous ? { ...previous, status: "completed", score: response.score } : previous);
      setRemainingMs(0);
      if (timerRef.current) clearInterval(timerRef.current);
      toast.success(automatic ? `Time is up. Final score: ${response.score}%` : `Assessment complete. Score: ${response.score}%`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Final submission failed";
      setFinishError(message);
      toast.error(message);
    } finally {
      finishingRef.current = false;
      setSubmittingAll(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (!assessmentId || assessmentStatus !== "active") return;
    const tick = () => {
      const next = Math.max(0, deadlineRef.current - Date.now());
      setRemainingMs(next);
      if (next <= 0) {
        setTimedOut(true);
        if (timerRef.current) clearInterval(timerRef.current);
        if (!automaticFinishAttemptedRef.current) {
          automaticFinishAttemptedRef.current = true;
          void finishAssessment(true);
        }
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [assessmentId, assessmentStatus, finishAssessment]);

  const setActiveCode = (value: string) => {
    if (!activeProblem) return;
    setCodes((previous) => ({ ...previous, [codeKey(activeProblem.problem_id, language)]: value }));
  };

  const handleLanguageChange = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    localStorage.setItem(LANG_KEY, nextLanguage);
  };

  const handleRun = async () => {
    if (!activeProblem || !canWork) return;
    setRunning(true);
    setExecutionError(null);
    setConsoleTab("result");
    try {
      const response = await api.runCode(activeProblem.problem_id, language, activeCode);
      setRunResults((previous) => ({ ...previous, [activeProblem.problem_id]: response }));
    } catch (error) {
      setExecutionError(error instanceof Error ? error.message : "Code execution failed.");
    } finally {
      setRunning(false);
    }
  };

  const handleSubmitProblem = async () => {
    if (!activeProblem || !params.id || !canWork || submissionPromiseRef.current) return;
    const problemId = activeProblem.problem_id;
    setSubmitting(true);
    setExecutionError(null);
    setConsoleTab("result");
    const submissionTask = (async () => {
      try {
        const response = await api.submitCode(problemId, language, activeCode);
        setRunResults((previous) => ({ ...previous, [problemId]: response }));
        await api.linkAssessmentSubmission(params.id, problemId, response.submissionId);
        setProblems((previous) => previous.map((problem) => problem.problem_id === problemId
          ? { ...problem, submission_id: response.submissionId, submission_status: response.status }
          : problem));
        toast.success(response.passed ? "Problem accepted" : "Submission recorded");
      } catch (error) {
        setExecutionError(error instanceof Error ? error.message : "Submission failed.");
      }
    })();
    submissionPromiseRef.current = submissionTask;
    try {
      await submissionTask;
    } finally {
      if (submissionPromiseRef.current === submissionTask) submissionPromiseRef.current = null;
      setSubmitting(false);
    }
  };

  if (loading && !assessment) {
    return <LoadingState label="Loading assessment workspace" className="min-h-dvh bg-background" />;
  }

  if (loadError || !assessment) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-4 text-text-primary">
        <StatePanel
          tone="error"
          title="Assessment unavailable"
          description={loadError ?? "The assessment could not be found."}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="ghost" onClick={() => router.push("/assessments")}>Back to assessments</Button>
              <Button onClick={loadWorkspace}>Retry</Button>
            </div>
          }
        />
      </main>
    );
  }

  if (isCompleted) {
    return (
      <AssessmentResults
        assessment={assessment}
        problems={problems}
        onBack={() => router.push("/assessments")}
      />
    );
  }

  return (
    <main className="flex h-dvh min-h-[560px] flex-col overflow-hidden bg-background text-text-primary">
      <header className="shrink-0 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex min-h-14 items-center justify-between gap-3 px-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/assessments")}
              className="min-h-10 shrink-0 rounded-lg px-2 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              aria-label="Back to assessments"
            >
              <span aria-hidden>&larr;</span> <span className="hidden sm:inline">Assessments</span>
            </button>
            <div className="hidden h-6 w-px bg-border sm:block" />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold sm:text-base">Coding assessment</h1>
              <p className="truncate text-xs text-text-secondary">{progressLabel}</p>
            </div>
          </div>
          <div
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-right ${timerUrgent || timedOut ? "border-error/30 bg-error/5 text-error" : "border-border bg-surface"}`}
            role="timer"
            aria-label={timedOut ? "Time expired" : `${formatAssessmentTime(remainingMs)} remaining`}
          >
            <span className="block text-[10px] font-semibold uppercase text-text-secondary">{timedOut ? "Time expired" : "Time left"}</span>
            <span className="mono block text-base font-bold tabular-nums sm:text-lg">{formatAssessmentTime(remainingMs)}</span>
          </div>
        </div>

        <div className="flex min-h-12 flex-wrap items-center gap-2 border-t border-border px-2 py-2 sm:px-4 md:flex-nowrap">
          <label className="sr-only" htmlFor="assessment-language">Language</label>
          <select
            id="assessment-language"
            value={language}
            onChange={(event) => handleLanguageChange(event.target.value as Language)}
            disabled={!canWork}
            className="min-h-9 shrink-0 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-text-primary"
          >
            {LANGUAGES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <Button size="sm" variant="secondary" onClick={handleRun} loading={running} loadingLabel="Running" disabled={!canWork || submitting}>
            Run code
          </Button>
          <Button size="sm" onClick={handleSubmitProblem} loading={submitting} loadingLabel="Submitting" disabled={!canWork || running}>
            Submit problem
          </Button>
          <div className="h-6 w-px shrink-0 bg-border" />
          <Button size="sm" variant="danger" onClick={() => void finishAssessment(false)} loading={submittingAll} loadingLabel="Finishing" disabled={submitting}>
            Finish assessment
          </Button>
        </div>
      </header>

      {timedOut || finishError ? (
        <div className={`flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-sm ${finishError ? "border-error/30 bg-error/5 text-error" : "border-warning/30 bg-warning/5 text-warning"}`} role={finishError ? "alert" : "status"}>
          <span>{finishError ? `Time has expired, but completion failed: ${finishError}` : "Time is up. Your assessment is being completed."}</span>
          {finishError ? <Button size="sm" variant="ghost" onClick={() => void finishAssessment(true)} loading={submittingAll}>Retry completion</Button> : null}
        </div>
      ) : null}

      {partialLoadError ? (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-warning/30 bg-warning/5 px-4 py-2 text-sm text-warning" role="status">
          <span>{partialLoadError}</span>
          <button type="button" onClick={loadWorkspace} className="font-semibold underline underline-offset-2">Retry</button>
        </div>
      ) : null}

      <WorkspacePaneSwitcher value={mobilePane} onChange={setMobilePane} />

      <div className="flex min-h-0 flex-1 md:flex-row">
        <section className={`${mobilePane === "problem" ? "flex" : "hidden"} min-h-0 w-full flex-col border-border md:flex md:w-1/2 md:border-r`} aria-label="Assessment problems">
          <div className="flex shrink-0 items-center overflow-x-auto border-b border-border" role="tablist" aria-label="Assessment questions">
            {problems.map((problem, index) => (
              <button
                key={problem.id}
                type="button"
                role="tab"
                aria-selected={activeProblemIdx === index}
                onClick={() => setActiveProblemIdx(index)}
                className={`flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${
                  activeProblemIdx === index ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
                }`}
              >
                Problem {index + 1}
                <span className={`size-2 rounded-full ${problem.submission_status === "passed" ? "bg-accent" : problem.submission_id ? "bg-error" : "bg-border-hover"}`} aria-hidden />
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {activeDetail ? (
              <ProblemStatement problem={activeDetail} />
            ) : (
              <StatePanel
                tone="error"
                title="Problem details unavailable"
                description="Retry the assessment to load this problem. Your code for other questions is preserved."
                action={<Button variant="ghost" onClick={loadWorkspace}>Retry assessment</Button>}
              />
            )}
          </div>
        </section>

        <section className={`${mobilePane === "editor" ? "flex" : "hidden"} min-h-0 w-full flex-col md:flex md:w-1/2`} aria-label="Code editor and console">
          <div className="flex min-h-0 flex-[3] flex-col">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
              <span className="mono text-xs font-semibold text-text-secondary">Editor</span>
              {activeProblem?.submission_id ? <span className="text-xs font-medium text-text-secondary">Submitted</span> : null}
            </div>
            <CodeWorkspaceEditor
              language={language}
              value={activeCode}
              onChange={setActiveCode}
              readOnly={!canWork}
              className="min-h-0 flex-1"
            />
          </div>

          <div className="flex min-h-[170px] flex-[2] flex-col border-t border-border">
            <div className="flex h-11 shrink-0 items-center border-b border-border bg-surface" role="tablist" aria-label="Console panels">
              <button
                type="button"
                role="tab"
                aria-selected={consoleTab === "result"}
                onClick={() => setConsoleTab("result")}
                className={`h-full border-b-2 px-4 text-xs font-semibold ${consoleTab === "result" ? "border-primary text-primary" : "border-transparent text-text-secondary"}`}
              >
                Result{activeResult ? ` (${activeResult.results.filter((result) => result.passed).length}/${activeResult.results.length})` : ""}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={consoleTab === "testcases"}
                onClick={() => setConsoleTab("testcases")}
                className={`h-full border-b-2 px-4 text-xs font-semibold ${consoleTab === "testcases" ? "border-primary text-primary" : "border-transparent text-text-secondary"}`}
              >
                Test cases
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {consoleTab === "result" ? (
                <ExecutionPanel result={activeResult} error={executionError} loading={running || submitting} />
              ) : (
                <TestCases problem={activeDetail} />
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function ProblemStatement({ problem }: { problem: ProblemDetail }) {
  return (
    <article className="max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold">{problem.title}</h2>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase ${difficultyClasses(problem.difficulty)}`}>
          {problem.difficulty}
        </span>
      </div>
      <div className="whitespace-pre-wrap text-sm leading-7 text-text-primary">{problem.description}</div>
      <div className="mt-6 space-y-3">
        {problem.test_cases?.slice(0, RUN_CASE_LIMIT).map((testCase, index) => (
          <div key={index} className="rounded-lg border border-border bg-surface/70 p-4">
            <p className="mb-2 text-xs font-semibold text-text-secondary">Example {index + 1}</p>
            <pre className="mono whitespace-pre-wrap break-words text-xs leading-6"><span className="text-text-secondary">Input: </span>{testCase.input}</pre>
            <pre className="mono whitespace-pre-wrap break-words text-xs leading-6"><span className="text-text-secondary">Output: </span>{testCase.expectedOutput}</pre>
          </div>
        ))}
      </div>
    </article>
  );
}

function TestCases({ problem }: { problem: ProblemDetail | null | undefined }) {
  if (!problem) return <p className="text-sm text-text-secondary">Test cases are unavailable for this problem.</p>;
  const examples = problem.test_cases?.slice(0, RUN_CASE_LIMIT) ?? [];
  if (examples.length === 0) return <p className="text-sm text-text-secondary">No sample cases are available.</p>;
  return (
    <div className="space-y-2">
      {examples.map((testCase, index) => (
        <div key={index} className="rounded-lg border border-border bg-surface/70 p-3">
          <p className="mb-1 text-xs font-semibold text-text-secondary">Case {index + 1}</p>
          <pre className="mono whitespace-pre-wrap break-words text-xs">{testCase.input}</pre>
        </div>
      ))}
    </div>
  );
}

function ExecutionPanel({ result, error, loading }: { result: ExecutionResult | null | undefined; error: string | null; loading: boolean }) {
  if (loading) return <LoadingState label="Running code" className="min-h-24" />;
  if (error) return <StatePanel tone="error" title="Execution failed" description={error} className="p-4" />;
  if (!result) return <p className="text-sm text-text-secondary">Run or submit this problem to see its result.</p>;
  const passed = result.results.filter((caseResult) => caseResult.passed).length;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`font-bold ${result.passed ? "text-accent" : "text-error"}`}>{result.passed ? "All cases passed" : "Some cases failed"}</p>
        <p className="text-xs text-text-secondary">{passed}/{result.results.length} passed{result.runtimeMs != null ? ` · ${result.runtimeMs}ms` : ""}</p>
      </div>
      {result.results.map((caseResult, index) => (
        <div key={index} className={`rounded-lg border p-3 ${caseResult.passed ? "border-accent/30 bg-accent/5" : "border-error/30 bg-error/5"}`}>
          <p className={`text-xs font-semibold ${caseResult.passed ? "text-accent" : "text-error"}`}>{caseResult.passed ? "Passed" : "Failed"} case {index + 1}{caseResult.hidden ? " (hidden)" : ""}</p>
          {caseResult.actualOutput != null ? <pre className="mono mt-2 whitespace-pre-wrap break-all text-xs">{caseResult.actualOutput}</pre> : null}
          {caseResult.error ? <pre className="mono mt-2 whitespace-pre-wrap break-all text-xs text-error">{caseResult.error}</pre> : null}
        </div>
      ))}
    </div>
  );
}

function AssessmentResults({ assessment, problems, onBack }: { assessment: Assessment; problems: AssessmentProblem[]; onBack: () => void }) {
  const solved = problems.filter((problem) => problem.submission_status === "passed").length;
  const attempted = problems.filter((problem) => Boolean(problem.submission_id)).length;
  const score = Number(assessment.score ?? 0);
  return (
    <main className="min-h-dvh bg-background px-4 py-10 text-text-primary sm:px-6">
      <div className="mx-auto max-w-3xl">
        <button type="button" onClick={onBack} className="mb-8 min-h-10 rounded-lg px-2 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary">
          <span aria-hidden>&larr;</span> Assessments
        </button>
        <header className="border-b border-border pb-8">
          <p className="text-sm font-semibold text-primary">Assessment results</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{score}% score</h1>
          <p className="mt-3 text-text-secondary">{solved} solved <span aria-hidden>&middot;</span> {attempted} attempted <span aria-hidden>&middot;</span> {problems.length} total</p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-label="Assessment score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}>
            <div className={`h-full ${score >= 50 ? "bg-accent" : "bg-error"}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
          </div>
        </header>

        <section className="py-8" aria-labelledby="question-results-heading">
          <h2 id="question-results-heading" className="mb-4 text-lg font-semibold">Problem results</h2>
          <div className="divide-y divide-border border-y border-border">
            {problems.map((problem, index) => {
              const status = problem.submission_status === "passed" ? "Solved" : problem.submission_id ? "Attempted" : "Unattempted";
              return (
                <div key={problem.id} className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-secondary">Problem {index + 1}</p>
                    <p className="mt-1 truncate font-medium">{problem.title}</p>
                  </div>
                  <span className={`shrink-0 text-sm font-semibold ${status === "Solved" ? "text-accent" : status === "Attempted" ? "text-error" : "text-text-secondary"}`}>{status}</span>
                </div>
              );
            })}
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <Button onClick={onBack}>Start another assessment</Button>
          <p className="self-center text-sm text-text-secondary">{assessment.difficulty_mix} difficulty <span aria-hidden>&middot;</span> {assessment.time_limit_minutes} minutes</p>
        </div>
      </div>
    </main>
  );
}
