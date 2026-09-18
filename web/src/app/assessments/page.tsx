"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { LoadingState, StatePanel } from "@/components/ui/state-panel";
import { StatusPill } from "@/components/ui/status-pill";
import { api, Assessment } from "@/lib/api";

const DIFFICULTY_OPTIONS = [
  { value: "mixed", label: "Mixed" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const PROBLEM_OPTIONS = [2, 3, 4, 5];
const TIME_OPTIONS = [30, 45, 60, 90, 120];

function formatAssessmentDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AssessmentsPage() {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState("mixed");
  const [problemCount, setProblemCount] = useState(3);
  const [timeLimit, setTimeLimit] = useState(60);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const loadAssessments = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const response = await api.listAssessments();
      setAssessments(response.assessments);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Assessments are unavailable right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssessments();
  }, [loadAssessments]);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const response = await api.createAssessment({
        timeLimitMinutes: timeLimit,
        problemCount,
        difficultyMix: difficulty,
      });
      router.push(`/assessments/${response.assessmentId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create assessment";
      setCreateError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Protected>
      <PageShell>
        <div className="space-y-10">
          <header className="max-w-3xl">
            <p className="mb-2 text-sm font-semibold text-primary">Timed practice</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Coding assessments</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-text-secondary">
              Build a focused problem set, work against a visible deadline, and review every result when time is up.
            </p>
          </header>

          <section aria-labelledby="assessment-setup-heading" className="border-y border-border bg-surface/50 py-6">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="assessment-setup-heading" className="text-lg font-semibold">Set up an assessment</h2>
                <p className="mt-1 text-sm text-text-secondary">The timer starts as soon as the workspace opens.</p>
              </div>
              <p className="text-sm font-medium text-text-secondary" aria-live="polite">
                {problemCount} problems <span aria-hidden>&middot;</span> {timeLimit} minutes <span aria-hidden>&middot;</span> {difficulty}
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Difficulty</legend>
                <div className="flex flex-wrap gap-2">
                  {DIFFICULTY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={difficulty === option.value}
                      onClick={() => setDifficulty(option.value)}
                      className={`min-h-10 rounded-lg border px-4 text-sm font-medium transition-colors ${
                        difficulty === option.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-text-secondary hover:border-border-hover hover:text-text-primary"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Problems</legend>
                <div className="flex flex-wrap gap-2">
                  {PROBLEM_OPTIONS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      aria-pressed={problemCount === count}
                      aria-label={`${count} problems`}
                      onClick={() => setProblemCount(count)}
                      className={`flex size-10 items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${
                        problemCount === count
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-text-secondary hover:border-border-hover hover:text-text-primary"
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Time limit</legend>
                <div className="flex flex-wrap gap-2">
                  {TIME_OPTIONS.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      aria-pressed={timeLimit === minutes}
                      onClick={() => setTimeLimit(minutes)}
                      className={`min-h-10 rounded-lg border px-4 text-sm font-medium transition-colors ${
                        timeLimit === minutes
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-text-secondary hover:border-border-hover hover:text-text-primary"
                      }`}
                    >
                      {minutes} min
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Button onClick={handleCreate} loading={creating} loadingLabel="Creating assessment">
                Start assessment
              </Button>
              {createError ? <p className="text-sm text-error" role="alert">{createError}</p> : null}
            </div>
          </section>

          <section aria-labelledby="assessment-history-heading">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 id="assessment-history-heading" className="text-xl font-semibold">Your assessments</h2>
                {!loading && !listError && assessments.length > 0 ? (
                  <p className="mt-1 text-sm text-text-secondary">{assessments.length} recent attempt{assessments.length === 1 ? "" : "s"}</p>
                ) : null}
              </div>
            </div>

            {loading ? (
              <LoadingState label="Loading assessments" className="min-h-40 border-y border-border" />
            ) : listError ? (
              <StatePanel
                tone="error"
                title="Assessments could not be loaded"
                description={listError}
                action={<Button variant="ghost" onClick={loadAssessments}>Retry assessments</Button>}
              />
            ) : assessments.length === 0 ? (
              <StatePanel
                title="No assessments yet"
                description="Choose your settings above to start your first timed attempt."
              />
            ) : (
              <div className="divide-y divide-border border-y border-border">
                {assessments.map((assessment) => {
                  const complete = assessment.status === "completed";
                  return (
                    <button
                      key={assessment.id}
                      type="button"
                      onClick={() => router.push(`/assessments/${assessment.id}`)}
                      className="grid w-full gap-3 px-1 py-4 text-left transition-colors hover:bg-surface-hover sm:grid-cols-[1fr_auto] sm:items-center sm:px-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{assessment.problem_count} problem{assessment.problem_count === 1 ? "" : "s"}</p>
                          <StatusPill label={complete ? "Completed" : "In progress"} tone={complete ? "success" : "warning"} />
                        </div>
                        <p className="mt-1 text-sm text-text-secondary">
                          {assessment.difficulty_mix} <span aria-hidden>&middot;</span> {assessment.time_limit_minutes} minutes <span aria-hidden>&middot;</span> {formatAssessmentDate(assessment.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        {assessment.score != null ? (
                          <span className={`text-lg font-bold tabular-nums ${Number(assessment.score) >= 50 ? "text-accent" : "text-error"}`}>
                            {assessment.score}%
                          </span>
                        ) : null}
                        <span className="text-sm font-semibold text-primary">{complete ? "View results" : "Continue"} <span aria-hidden>&rarr;</span></span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </PageShell>
    </Protected>
  );
}
