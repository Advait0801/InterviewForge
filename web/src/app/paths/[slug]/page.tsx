"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, LearningPathDetailResponse } from "@/lib/api";

function difficultyClass(difficulty: string) {
  if (difficulty === "easy") return "border-accent/25 bg-accent/15 text-accent";
  if (difficulty === "medium") return "border-warning/25 bg-warning/15 text-warning";
  return "border-error/25 bg-error/15 text-error";
}

function levelClass(level: string) {
  if (level === "beginner") return "border-accent/25 bg-accent/15 text-accent";
  if (level === "intermediate") return "border-warning/25 bg-warning/15 text-warning";
  return "border-error/25 bg-error/15 text-error";
}

function PathDetailSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading learning path">
      <span className="sr-only">Loading learning path…</span>
      <div className="animate-pulse rounded-3xl border border-border bg-surface/60 p-6" aria-hidden>
        <div className="h-4 w-24 rounded bg-border" />
        <div className="mt-5 h-8 w-2/3 rounded bg-border" />
        <div className="mt-3 h-4 w-full max-w-xl rounded bg-border/80" />
        <div className="mt-2 h-4 w-4/5 max-w-lg rounded bg-border/80" />
      </div>
      <div className="space-y-2" aria-hidden>
        {[0, 1, 2, 3].map((index) => <div key={index} className="h-20 animate-pulse rounded-2xl border border-border bg-surface/60" />)}
      </div>
    </div>
  );
}

export default function LearningPathDetailPage() {
  const reduceMotion = useReducedMotion();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const requestVersion = useRef(0);
  const [data, setData] = useState<LearningPathDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPath = useCallback(async () => {
    if (!slug) return;
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setLoading(true);
    setData(null);
    setNotFound(false);
    setLoadError(null);
    try {
      const result = await api.getLearningPath(slug, true);
      if (requestVersion.current === version) setData(result);
    } catch (error) {
      if (requestVersion.current !== version) return;
      const message = error instanceof Error ? error.message : "Failed to load learning path";
      if (message.toLowerCase().includes("not found")) setNotFound(true);
      else setLoadError(message);
    } finally {
      if (requestVersion.current === version) setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadPath();
    return () => {
      requestVersion.current += 1;
    };
  }, [loadPath]);

  return (
    <Protected>
      <PageShell>
        {loading ? <PathDetailSkeleton /> : notFound ? (
          <section className="rounded-2xl border border-border bg-surface/70 p-8 text-center">
            <h1 className="text-2xl font-bold text-text-primary">Learning path not found</h1>
            <p className="mt-2 text-sm text-text-secondary">This path may have moved or is no longer available.</p>
            <Link href="/paths" className={buttonStyles({ variant: "secondary", className: "mt-5 min-h-11 touch-manipulation" })}>
              Back to learning paths
            </Link>
          </section>
        ) : loadError ? (
          <section className="rounded-2xl border border-error/30 bg-error/5 p-8 text-center" role="alert">
            <h1 className="text-2xl font-bold text-text-primary">This learning path is unavailable</h1>
            <p className="mx-auto mt-2 max-w-lg text-sm text-text-secondary">{loadError}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Button type="button" className="min-h-11 touch-manipulation" onClick={() => void loadPath()}>
                Retry path
              </Button>
              <Link href="/paths" className={buttonStyles({ variant: "ghost", className: "min-h-11 touch-manipulation" })}>
                View all paths
              </Link>
            </div>
          </section>
        ) : data ? <PathContent data={data} reduceMotion={Boolean(reduceMotion)} /> : null}
      </PageShell>
    </Protected>
  );
}

function PathContent({ data, reduceMotion }: { data: LearningPathDetailResponse; reduceMotion: boolean }) {
  const { path, problems } = data;
  const problemCount = Math.max(path.problemCount, 0);
  const completed = Math.min(Math.max(path.completedCount, 0), problemCount);
  const percentage = problemCount > 0 ? Math.round((completed / problemCount) * 100) : 0;
  const nextProblem = problems.find((problem) => !problem.isCompleted);
  const firstProblem = problems[0];
  const primaryProblem = nextProblem ?? firstProblem;
  const primaryLabel = nextProblem ? `Continue with ${nextProblem.title}` : firstProblem ? "Review this path" : "Browse problem catalogue";
  const primaryHref = primaryProblem ? `/problems/${encodeURIComponent(primaryProblem.problemId)}` : "/problems";

  return (
    <motion.div initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">
      <Link href="/paths" className="inline-flex min-h-10 items-center text-sm font-medium text-primary hover:underline">
        ← All learning paths
      </Link>

      <header className="relative overflow-hidden rounded-3xl border border-border bg-surface/75 p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-secondary/12 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs text-text-secondary">{path.topic}</span>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase ${levelClass(path.difficultyLevel)}`}>{path.difficultyLevel}</span>
            </div>
            <h1 className="mt-4 break-words text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">{path.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary sm:text-base">{path.description}</p>
          </div>
          <Link href={primaryHref} className={buttonStyles({ className: "min-h-11 shrink-0 touch-manipulation text-center" })}>
            {primaryLabel}
          </Link>
        </div>

        <div className="relative mt-6 max-w-2xl">
          <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm text-text-secondary">
            <span><strong className="text-text-primary">{completed}</strong> of {problemCount} steps completed</span>
            <span className="font-semibold text-text-primary">{percentage}%</span>
          </div>
          {problemCount > 0 ? (
            <div
              className="h-2.5 overflow-hidden rounded-full bg-background"
              role="progressbar"
              aria-label={`${path.title} progress`}
              aria-valuemin={0}
              aria-valuemax={problemCount}
              aria-valuenow={completed}
            >
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-300" style={{ width: `${percentage}%` }} />
            </div>
          ) : <p className="text-xs text-text-secondary">This sequence is being prepared.</p>}
        </div>
      </header>

      <section aria-labelledby="path-steps-title">
        <div className="mb-3">
          <h2 id="path-steps-title" className="text-xl font-semibold text-text-primary">Path steps</h2>
          <p className="mt-1 text-sm text-text-secondary">Work in order when you want a guided progression, or open any step for review.</p>
        </div>

        {problems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <h3 className="font-semibold text-text-primary">This path has no steps yet</h3>
            <p className="mt-2 text-sm text-text-secondary">Use the full catalogue while this sequence is being prepared.</p>
            <Link href="/problems" className={buttonStyles({ variant: "secondary", className: "mt-4 min-h-11 touch-manipulation" })}>Browse problems</Link>
          </div>
        ) : (
          <Card className="overflow-hidden p-0">
            <ol className="divide-y divide-border">
              {problems.map((problem, index) => {
                const isNext = nextProblem?.problemId === problem.problemId;
                return (
                  <li key={problem.problemId} className="relative">
                    <Link
                      href={`/problems/${encodeURIComponent(problem.problemId)}`}
                      className="group flex min-h-20 items-center gap-3 p-4 outline-none transition-colors hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:gap-4 sm:px-6"
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                          problem.isCompleted
                            ? "border-accent bg-accent/15 text-accent"
                            : isNext
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background text-text-secondary"
                        }`}
                        aria-hidden
                      >
                        {problem.isCompleted ? "✓" : index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="break-words font-semibold text-text-primary transition-colors group-hover:text-primary">{problem.title}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${difficultyClass(problem.difficulty)}`}>{problem.difficulty}</span>
                          {isNext ? <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">Up next</span> : null}
                          {problem.isCompleted ? <span className="text-[11px] font-medium text-accent">Completed</span> : null}
                        </span>
                        <span className="mt-1 block text-xs text-text-secondary">Step {index + 1} of {problems.length}</span>
                      </span>
                      <span className="shrink-0 text-primary" aria-hidden>→</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </Card>
        )}
      </section>
    </motion.div>
  );
}
