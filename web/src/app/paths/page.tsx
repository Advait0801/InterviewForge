"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, LearningPathSummary } from "@/lib/api";

function levelColor(level: string) {
  if (level === "beginner") return "border-accent/25 bg-accent/15 text-accent";
  if (level === "intermediate") return "border-warning/25 bg-warning/15 text-warning";
  return "border-error/25 bg-error/15 text-error";
}

function PathListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading learning paths">
      <span className="sr-only">Loading learning paths…</span>
      {[0, 1, 2].map((index) => (
        <div key={index} className="animate-pulse rounded-2xl border border-border bg-surface/60 p-5" aria-hidden>
          <div className="h-4 w-2/5 rounded bg-border" />
          <div className="mt-5 h-6 w-4/5 rounded bg-border" />
          <div className="mt-3 h-3 w-full rounded bg-border/80" />
          <div className="mt-2 h-3 w-3/4 rounded bg-border/80" />
          <div className="mt-6 h-2 w-full rounded bg-border" />
        </div>
      ))}
    </div>
  );
}

export default function LearningPathsPage() {
  const reduceMotion = useReducedMotion();
  const [paths, setPaths] = useState<LearningPathSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPaths = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await api.getLearningPaths(true);
      setPaths(response.paths);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load learning paths");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPaths();
  }, [loadPaths]);

  const totals = useMemo(() => paths.reduce(
    (summary, path) => {
      const problemCount = Math.max(path.problemCount, 0);
      return {
        problems: summary.problems + problemCount,
        completed: summary.completed + Math.min(Math.max(path.completedCount, 0), problemCount),
      };
    },
    { problems: 0, completed: 0 },
  ), [paths]);

  return (
    <Protected>
      <PageShell>
        <div className="space-y-7">
          <motion.header
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="relative flex flex-col gap-5 overflow-hidden rounded-3xl border border-border bg-surface/75 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-7"
          >
            <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-secondary/12 blur-3xl" aria-hidden />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">Guided practice</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Learning paths</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary sm:text-base">
                Follow focused problem sequences in order, see what you have completed, and continue from the next useful step.
              </p>
            </div>
            <Link href="/problems" className={buttonStyles({ variant: "secondary", className: "relative min-h-11 shrink-0 touch-manipulation" })}>
              Browse all problems
            </Link>
          </motion.header>

          {!loading && !loadError && paths.length > 0 ? (
            <section className="grid grid-cols-3 gap-2 sm:max-w-xl sm:gap-3" aria-label="Learning path summary">
              {[
                [paths.length, "Paths"],
                [totals.problems, "Steps"],
                [totals.completed, "Completed"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-border bg-surface/70 px-3 py-3 sm:px-4">
                  <p className="text-xl font-bold text-text-primary sm:text-2xl">{value}</p>
                  <p className="text-[11px] text-text-secondary sm:text-xs">{label}</p>
                </div>
              ))}
            </section>
          ) : null}

          {loading ? <PathListSkeleton /> : loadError ? (
            <section className="rounded-2xl border border-error/30 bg-error/5 p-6 text-center" role="alert">
              <h2 className="text-lg font-semibold text-text-primary">Learning paths are unavailable</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-text-secondary">{loadError}</p>
              <Button type="button" className="mt-4 min-h-11 touch-manipulation" onClick={() => void loadPaths()}>
                Retry learning paths
              </Button>
            </section>
          ) : paths.length === 0 ? (
            <section className="rounded-2xl border border-dashed border-border p-8 text-center">
              <h2 className="text-lg font-semibold text-text-primary">No learning paths are available yet</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-text-secondary">You can still practice from the complete problem catalogue.</p>
              <Link href="/problems" className={buttonStyles({ variant: "secondary", className: "mt-4 min-h-11 touch-manipulation" })}>
                Browse problems
              </Link>
            </section>
          ) : (
            <section aria-labelledby="available-paths-title">
              <div className="mb-3">
                <h2 id="available-paths-title" className="text-lg font-semibold text-text-primary">Choose a path</h2>
                <p className="text-sm text-text-secondary">Progress comes from completed problems already recorded for your account.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {paths.map((path, index) => {
                  const problemCount = Math.max(path.problemCount, 0);
                  const completed = Math.min(Math.max(path.completedCount, 0), problemCount);
                  const percentage = problemCount > 0 ? Math.round((completed / problemCount) * 100) : 0;
                  const action = problemCount === 0 ? "View path" : percentage === 100 ? "Review path" : completed > 0 ? "Continue path" : "Start path";
                  return (
                    <motion.div
                      key={path.slug}
                      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: reduceMotion ? 0 : Math.min(index, 5) * 0.04 }}
                    >
                      <Link href={`/paths/${encodeURIComponent(path.slug)}`} className="group block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background">
                        <Card variant="interactive" className="flex h-full flex-col p-5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex rounded-full border border-border bg-background/70 px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                              {path.topic}
                            </span>
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${levelColor(path.difficultyLevel)}`}>
                              {path.difficultyLevel}
                            </span>
                          </div>
                          <h3 className="mt-4 break-words text-lg font-semibold text-text-primary transition-colors group-hover:text-primary">{path.title}</h3>
                          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-text-secondary">{path.description}</p>
                          <div className="mt-auto pt-5">
                            <div className="mb-2 flex justify-between gap-3 text-xs text-text-secondary">
                              <span>{completed} of {problemCount} completed</span>
                              <span className="font-semibold text-text-primary">{percentage}%</span>
                            </div>
                            {problemCount > 0 ? (
                              <div
                                className="h-2 overflow-hidden rounded-full bg-background"
                                role="progressbar"
                                aria-label={`${path.title} progress`}
                                aria-valuemin={0}
                                aria-valuemax={problemCount}
                                aria-valuenow={completed}
                              >
                                <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-300" style={{ width: `${percentage}%` }} />
                              </div>
                            ) : <p className="text-xs text-text-secondary">Sequence being prepared</p>}
                            <p className="mt-4 text-sm font-semibold text-primary">{action} →</p>
                          </div>
                        </Card>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </PageShell>
    </Protected>
  );
}
