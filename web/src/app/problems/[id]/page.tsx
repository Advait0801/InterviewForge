"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, CodeReview, ProblemDetail, Submission, SubmissionDetail } from "@/lib/api";
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

/** Number of example cases shown in the problem description. */
const EXAMPLE_CASE_COUNT = 4;

/** Show at most this many passed rows expanded on submit (rest collapsed). */
const SUBMIT_EXPAND_PASSED_CAP = 8;

const CONSOLE_SPLIT_STORAGE_KEY = "if-console-split-ratio";

/** Parse hints from DB: JSON array string or legacy newline-separated blocks. */
function parseProblemHints(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const t = raw.trim();
  if (t.startsWith("[")) {
    try {
      const j = JSON.parse(t) as unknown;
      if (Array.isArray(j)) return j.map(String).filter(Boolean);
    } catch {
      /* fall through */
    }
  }
  return t
    .split(/\n---\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function ProgressiveHints({ hints }: { hints: string[] }) {
  const [revealed, setRevealed] = useState(0);
  const hintKey = hints.length ? hints.map((h) => h.slice(0, 24)).join("|") : "";
  useEffect(() => {
    setRevealed(0);
  }, [hintKey]);

  if (hints.length === 0) {
    return <p className="text-sm text-text-secondary">No hints available for this problem yet.</p>;
  }

  return (
    <div className="space-y-4">
      {hints.slice(0, revealed).map((h, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface/60 p-4">
          <p className="mb-1 text-[11px] font-semibold text-text-secondary">Hint {i + 1}</p>
          <p className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap">{h}</p>
        </div>
      ))}
      {revealed < hints.length && (
        <button
          type="button"
          onClick={() => setRevealed((r) => r + 1)}
          className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary/20"
        >
          {revealed === 0 ? "Show hint 1" : `Show hint ${revealed + 1}`}
        </button>
      )}
      {revealed === hints.length && hints.length > 1 && (
        <button
          type="button"
          onClick={() => setRevealed(0)}
          className="text-xs font-medium text-text-secondary hover:text-primary"
        >
          Reset hints
        </button>
      )}
    </div>
  );
}

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
  testCases?: Array<{ input: string; expectedOutput: string }>;
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

function CodeReviewPanel({ review }: { review: CodeReview }) {
  const score = Math.min(10, Math.max(1, review.qualityScore ?? 5));
  return (
    <div className="space-y-3 text-sm">
      <p className="text-text-secondary leading-relaxed">{review.summary}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
          Time: {review.timeComplexity}
        </span>
        <span className="rounded-full border border-secondary/30 bg-secondary/10 px-2.5 py-0.5 text-[11px] font-semibold text-secondary">
          Space: {review.spaceComplexity}
        </span>
        <span className="text-[11px] font-medium text-text-secondary">Quality</span>
        <div className="h-2 w-24 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-gradient-to-r from-accent to-primary" style={{ width: `${score * 10}%` }} />
        </div>
        <span className="text-xs font-bold text-text-primary">{score}/10</span>
      </div>
      {review.strengths?.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-accent">Strengths</p>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-text-secondary">
            {review.strengths.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      {review.issues?.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-error">Issues</p>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-text-secondary">
            {review.issues.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      {review.optimizations?.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-primary">Optimizations</p>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-text-secondary">
            {review.optimizations.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
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
  const [activeTab, setActiveTab] = useState<
    "description" | "submissions" | "hints" | "editorial" | "aireview"
  >("description");
  const [resultTab, setResultTab] = useState<"result" | "testcases">("testcases");
  const [showResults, setShowResults] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [submissionDetail, setSubmissionDetail] = useState<SubmissionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [lastSubmissionId, setLastSubmissionId] = useState<string | null>(null);
  const [aiReview, setAiReview] = useState<CodeReview | null>(null);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [aiReviewOpen, setAiReviewOpen] = useState(false);
  const [modalAiReview, setModalAiReview] = useState<CodeReview | null>(null);
  const [modalAiReviewLoading, setModalAiReviewLoading] = useState(false);
  const [modalAiReviewOpen, setModalAiReviewOpen] = useState(false);

  const prevStarterRef = useRef<string>("");
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const [bottomPanelRatio, setBottomPanelRatio] = useState(0.38);

  const submissionIdForReview = useMemo(
    () => lastSubmissionId ?? submissions[0]?.id ?? null,
    [lastSubmissionId, submissions],
  );
  const canAiReview = Boolean(submissionIdForReview);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const s = localStorage.getItem(CONSOLE_SPLIT_STORAGE_KEY);
      if (s) {
        const n = parseFloat(s);
        if (!Number.isNaN(n) && n >= 0.15 && n <= 0.88) setBottomPanelRatio(n);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!params.id) return;
    if (!getToken()) {
      router.push("/login");
      return;
    }
    const preferredLang = getSavedLanguage();
    setLanguage(preferredLang);

    api
      .getProblem(params.id, true)
      .then(async (res) => {
        setProblem(res.problem);
        const starter = res.problem.starter_code?.[preferredLang] || "";
        prevStarterRef.current = starter;

        try {
          const subRes = await api.getSubmissions({ problemId: params.id });
          setSubmissions(subRes.submissions);
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
      const res = await api.getSubmissions({ problemId: params.id });
      setSubmissions(res.submissions);
    } catch {
      /* silent — non-critical */
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleConsoleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const pane = rightPaneRef.current;
      if (!pane) return;
      const rect = pane.getBoundingClientRect();
      const startY = e.clientY;
      const startRatio = bottomPanelRatio;
      const H = rect.height;
      let last = startRatio;
      const onMove = (ev: MouseEvent) => {
        const dy = ev.clientY - startY;
        // Invert so dragging the handle up grows the editor / shrinks console (matches LeetCode-style expectation).
        const next = Math.min(0.88, Math.max(0.15, startRatio - dy / H));
        last = next;
        setBottomPanelRatio(next);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        try {
          localStorage.setItem(CONSOLE_SPLIT_STORAGE_KEY, String(last));
        } catch {
          /* ignore */
        }
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [bottomPanelRatio],
  );

  const openSubmissionDetail = useCallback(async (id: string) => {
    setDetailId(id);
    setSubmissionDetail(null);
    setModalAiReview(null);
    setModalAiReviewOpen(false);
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
        .getSubmissions({ problemId: problem.id })
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
      setLastSubmissionId(res.submissionId);
      setAiReview(null);
      setAiReviewOpen(false);
      if (res.passed) {
        setProblem((prev) => (prev ? { ...prev, is_solved: true } : prev));
        toast.success("All tests passed");
      } else {
        toast.success("Submission recorded");
      }
      saveLanguage(language);
      fetchSubmissions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const exampleCases = problem?.test_cases?.slice(0, EXAMPLE_CASE_COUNT) ?? [];
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
                  setModalAiReview(null);
                  setModalAiReviewOpen(false);
                }}
                className="rounded-lg p-2 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              >
                <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                  <path d="M3 3L11 11M3 11L11 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 border-b border-border px-4 py-2">
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
              <button
                type="button"
                disabled={!submissionDetail || modalAiReviewLoading}
                onClick={async () => {
                  if (!submissionDetail) return;
                  setModalAiReview(null);
                  setModalAiReviewOpen(true);
                  setModalAiReviewLoading(true);
                  try {
                    const r = await api.reviewSubmission(submissionDetail.id);
                    setModalAiReview(r.review);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "AI review failed");
                    setModalAiReviewOpen(false);
                  } finally {
                    setModalAiReviewLoading(false);
                  }
                }}
                className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20 disabled:opacity-50"
              >
                {modalAiReviewLoading ? "Reviewing…" : "AI Review"}
              </button>
            </div>
            {modalAiReviewOpen && (
              <div className="max-h-[40vh] shrink-0 overflow-y-auto border-b border-border px-4 py-3">
                {modalAiReviewLoading && (
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Generating review…
                  </div>
                )}
                {!modalAiReviewLoading && modalAiReview && <CodeReviewPanel review={modalAiReview} />}
              </div>
            )}
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
          {problem.is_solved ? (
            <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
              Solved
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              if (savingBookmark) return;
              setSavingBookmark(true);
              try {
                if (problem.is_bookmarked) {
                  await api.removeBookmark(problem.id);
                } else {
                  await api.addBookmark(problem.id);
                }
                setProblem((prev) => (prev ? { ...prev, is_bookmarked: !prev.is_bookmarked } : prev));
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not update bookmark");
              } finally {
                setSavingBookmark(false);
              }
            }}
            disabled={savingBookmark}
            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-secondary transition hover:border-warning/50 hover:text-warning disabled:opacity-50"
          >
            {problem.is_bookmarked ? "Bookmarked" : "Bookmark"}
          </button>
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
            <button
              onClick={() => setActiveTab("hints")}
              className={`px-4 py-2.5 text-xs font-medium transition-all ${
                activeTab === "hints"
                  ? "border-b-2 border-primary text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Hints
            </button>
            <button
              onClick={() => setActiveTab("editorial")}
              className={`px-4 py-2.5 text-xs font-medium transition-all ${
                activeTab === "editorial"
                  ? "border-b-2 border-primary text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Editorial
            </button>
            <button
              type="button"
              disabled={!canAiReview}
              onClick={() => {
                if (canAiReview) setActiveTab("aireview");
              }}
              title={!canAiReview ? "Submit your solution to unlock AI Review" : undefined}
              className={`px-4 py-2.5 text-xs font-medium transition-all ${
                activeTab === "aireview"
                  ? "border-b-2 border-primary text-primary"
                  : canAiReview
                    ? "text-text-secondary hover:text-text-primary"
                    : "cursor-not-allowed text-text-secondary/50"
              }`}
            >
              AI Review
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
            {activeTab === "hints" && (
              <ProgressiveHints key={problem.id} hints={parseProblemHints(problem.hints)} />
            )}
            {activeTab === "aireview" && (
              <div className="space-y-4">
                {!canAiReview ? (
                  <p className="text-sm text-text-secondary">
                    Submit your solution at least once (accepted or not) to unlock AI Review for your latest submission.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-text-secondary">
                      Reviews your most recent submission for this problem. Generate a fresh analysis below.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={aiReviewLoading}
                        onClick={async () => {
                          if (!submissionIdForReview) return;
                          setAiReviewOpen(true);
                          setAiReviewLoading(true);
                          setAiReview(null);
                          try {
                            const r = await api.reviewSubmission(submissionIdForReview);
                            setAiReview(r.review);
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "AI review failed");
                          } finally {
                            setAiReviewLoading(false);
                          }
                        }}
                        className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20 disabled:opacity-50"
                      >
                        {aiReviewLoading ? "Generating…" : "Generate AI Review"}
                      </button>
                      {aiReview && (
                        <button
                          type="button"
                          onClick={() => setAiReviewOpen((o) => !o)}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          {aiReviewOpen ? "Hide feedback" : "Show feedback"}
                        </button>
                      )}
                    </div>
                    {aiReviewOpen && aiReviewLoading && (
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        Analyzing your code…
                      </div>
                    )}
                    {aiReviewOpen && !aiReviewLoading && aiReview && <CodeReviewPanel review={aiReview} />}
                  </>
                )}
              </div>
            )}
            {activeTab === "editorial" && (
              <div className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap">
                {problem.editorial?.trim() ? problem.editorial : "No editorial available for this problem yet."}
              </div>
            )}
          </div>
        </div>

        {/* Right pane — editor + results (resizable when console open) */}
        <div ref={rightPaneRef} className="flex w-full min-h-0 flex-1 flex-col md:w-1/2">
          {!showResults ? (
            <>
              <div className="flex min-h-0 flex-1 flex-col">
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
              <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowResults(true);
                    setResultTab("testcases");
                  }}
                  className="text-xs font-medium text-text-secondary transition hover:text-text-primary"
                >
                  Console
                </button>
              </div>
            </>
          ) : (
            <>
              <div
                className="flex min-h-0 flex-col overflow-hidden"
                style={{ flex: `${1 - bottomPanelRatio} 1 0px`, minHeight: 100 }}
              >
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
              <div
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize editor and console panels"
                onMouseDown={handleConsoleResizeStart}
                className="h-1.5 shrink-0 cursor-row-resize border-y border-border bg-border/50 hover:bg-primary/25"
              />
              <div
                className="flex min-h-0 flex-col border-t border-border"
                style={{ flex: `${bottomPanelRatio} 1 0px`, minHeight: 80 }}
              >
                <div className="flex shrink-0 items-center justify-between border-b border-border">
                  <div className="flex">
                    <button
                      type="button"
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
                      type="button"
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
                    type="button"
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
            </>
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
  submitCaseInputs,
  expandPassedCap,
}: {
  result: RunResponse | null;
  loading: boolean;
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
  const cases = result.mode === "run" ? (result.testCases ?? []) : submitCaseInputs;

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
