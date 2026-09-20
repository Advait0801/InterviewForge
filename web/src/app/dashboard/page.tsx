"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useNow } from "@/lib/useNow";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { ActivityHeatmap } from "@/components/ui/activity-heatmap";
import { Button, buttonStyles } from "@/components/ui/button";
import { LoadingState, StatePanel } from "@/components/ui/state-panel";
import {
  api,
  type RecommendedProblemCard,
  type RecommendationsResponse,
  type RevisitProblemCard,
} from "@/lib/api";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: Math.min(index, 4) * 0.05, duration: 0.35, ease: "easeOut" as const },
  }),
};

type StatKey = "problemsAttempted" | "interviewsStarted" | "bestStreak" | "currentStreak";
type DashboardStats = Record<StatKey, number | null>;

const statCards: Array<{
  key: StatKey;
  label: string;
  context: string;
  icon: string;
  accent: string;
  unit?: string;
}> = [
  { key: "problemsAttempted", label: "Problems attempted", context: "Unique coding problems", icon: "⌘", accent: "border-primary/25 bg-primary/8" },
  { key: "interviewsStarted", label: "Interviews started", context: "Practice sessions", icon: "◇", accent: "border-accent/25 bg-accent/8" },
  { key: "currentStreak", label: "Current streak", context: "Consecutive active days", icon: "↗", accent: "border-secondary/25 bg-secondary/8", unit: "days" },
  { key: "bestStreak", label: "Best streak", context: "Longest active run", icon: "✦", accent: "border-warning/25 bg-warning/8", unit: "days" },
];

const practiceModes: Array<{ title: string; description: string; href: string; icon: ReactNode }> = [
  {
    title: "Practice coding",
    description: "Choose from 150 problems and get immediate run and submission feedback.",
    href: "/problems",
    icon: <path d="m8 9-4 3 4 3m8-6 4 3-4 3m-2-9-4 12" />,
  },
  {
    title: "Run a mock interview",
    description: "Move through coding, behavioral, and design questions in one guided session.",
    href: "/interview",
    icon: <path d="M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3Z" />,
  },
  {
    title: "Practice system design",
    description: "Map an architecture, explain tradeoffs, and review structured feedback.",
    href: "/system-design",
    icon: <><rect x="3" y="4" width="7" height="6" rx="1" /><rect x="14" y="14" width="7" height="6" rx="1" /><path d="M10 7h4a3 3 0 0 1 3 3v4" /></>,
  },
];

const quickLinks = [
  ["Assessments", "Timed coding sets", "/assessments"],
  ["Learning paths", "Structured topic practice", "/paths"],
  ["Analytics", "Detailed coding trends", "/analytics"],
  ["Leaderboard", "Community rankings", "/leaderboard"],
];

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function ProblemCard({ problem, meta }: { problem: RecommendedProblemCard; meta?: string }) {
  const difficultyClass = problem.difficulty === "easy"
    ? "border-accent/30 bg-accent/10 text-accent"
    : problem.difficulty === "medium"
      ? "border-warning/30 bg-warning/10 text-warning"
      : "border-error/30 bg-error/10 text-error";

  return (
    <Link
      href={`/problems/${problem.id}`}
      className="rounded-2xl border border-border bg-background/55 p-4 transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-primary/40 hover:bg-surface-hover"
    >
      <p className="line-clamp-2 text-sm font-semibold text-text-primary">{problem.title}</p>
      {meta ? <p className="mt-1.5 text-xs text-text-secondary">{meta}</p> : null}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${difficultyClass}`}>
          {problem.difficulty}
        </span>
        {(problem.topics ?? []).slice(0, 2).map((topic) => (
          <span key={topic} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-text-secondary">
            {topic}
          </span>
        ))}
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const now = useNow();
  const [userName, setUserName] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    problemsAttempted: null,
    interviewsStarted: null,
    bestStreak: null,
    currentStreak: null,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [activityMap, setActivityMap] = useState<Record<string, number> | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationsResponse | null>(null);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setProfileError(null);
    try {
      const response = await api.me();
      setUserName(response.user.name || response.user.username || response.user.email.split("@")[0]);
    } catch (error) {
      setProfileError(errorMessage(error, "Profile details are unavailable."));
    }
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const response = await api.userStats();
      setStats((current) => ({
        ...current,
        problemsAttempted: response.problemsAttempted,
        interviewsStarted: response.interviewsStarted,
        bestStreak: response.bestStreak,
      }));
    } catch (error) {
      setStatsError(errorMessage(error, "Practice statistics are unavailable."));
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    setActivityError(null);
    try {
      const response = await api.getUserActivity();
      setStats((current) => ({ ...current, currentStreak: response.currentStreak, bestStreak: response.bestStreak }));
      setActivityMap(response.activityMap);
    } catch (error) {
      setActivityError(errorMessage(error, "Activity history is unavailable."));
    } finally {
      setActivityLoading(false);
    }
  }, []);

  const loadRecommendations = useCallback(async () => {
    setRecommendationsLoading(true);
    setRecommendationsError(null);
    try {
      setRecommendations(await api.getRecommendations());
    } catch (error) {
      setRecommendationsError(errorMessage(error, "Your practice plan is unavailable."));
    } finally {
      setRecommendationsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
    void loadStats();
    void loadActivity();
    void loadRecommendations();
  }, [loadActivity, loadProfile, loadRecommendations, loadStats]);

  return (
    <Protected>
      <PageShell>
        <motion.div initial="hidden" animate="visible" className="space-y-8">
          <motion.section variants={fadeUp} custom={0} className="relative overflow-hidden rounded-3xl border border-border bg-surface/75 p-6 sm:p-8" aria-labelledby="dashboard-title">
            <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary/12 blur-3xl" aria-hidden />
            <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Your practice hub</p>
                <h1 id="dashboard-title" className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                  Good to see you{userName ? `, ${userName}` : ""}.
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-text-secondary">
                  Build momentum with one focused problem, then use your progress to choose what comes next.
                </p>
                {profileError ? (
                  <p className="mt-3 text-xs text-text-secondary">
                    Your name could not be loaded. <button className="font-semibold text-primary underline" type="button" onClick={() => void loadProfile()}>Try again</button>
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/problems" className={buttonStyles({ size: "lg" })}>
                  {stats.problemsAttempted === null
                    ? "Choose a coding problem"
                    : stats.problemsAttempted > 0
                      ? "Continue coding"
                      : "Solve your first problem"}
                </Link>
                <Link href="/interview" className={buttonStyles({ variant: "ghost", size: "lg" })}>Start an interview</Link>
              </div>
            </div>
          </motion.section>

          <motion.section variants={fadeUp} custom={1} aria-labelledby="overview-title">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">Progress snapshot</p>
                <h2 id="overview-title" className="mt-1 text-xl font-semibold">Your practice at a glance</h2>
              </div>
              <Link href="/analytics" className="text-sm font-semibold text-primary hover:underline">View detailed analytics</Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {statCards.map((stat) => {
                const value = stats[stat.key];
                const loading = value === null && (stat.key === "currentStreak" ? activityLoading : statsLoading);
                const unavailable = value === null && !loading;
                return (
                  <Card key={stat.key} className={`p-5 ${stat.accent}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-medium text-text-secondary">{stat.label}</p>
                        {loading ? (
                          <div className="mt-3 h-8 w-16 animate-pulse rounded-lg bg-surface-hover" role="status" aria-label={`Loading ${stat.label}`} />
                        ) : (
                          <p className="mt-2 text-3xl font-bold tracking-tight">
                            {unavailable ? "—" : value}
                            {!unavailable && stat.unit ? <span className="ml-1 text-xs font-medium text-text-secondary">{stat.unit}</span> : null}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-text-secondary">{unavailable ? "Unavailable" : stat.context}</p>
                      </div>
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-current/10 bg-background/55 text-lg text-primary" aria-hidden>{stat.icon}</span>
                    </div>
                  </Card>
                );
              })}
            </div>
            {statsError ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error/25 bg-error/5 px-4 py-3" role="alert">
                <p className="text-sm text-error">{statsError} Existing activity data remains separate.</p>
                <Button type="button" size="sm" variant="secondary" loading={statsLoading} loadingLabel="Retrying…" onClick={() => void loadStats()}>Retry statistics</Button>
              </div>
            ) : null}
          </motion.section>

          <motion.section variants={fadeUp} custom={2} aria-labelledby="activity-title">
            <Card className="p-5 sm:p-6">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Consistency</p>
                <h2 id="activity-title" className="mt-1 text-xl font-semibold">Practice activity</h2>
                <p className="mt-1 text-sm text-text-secondary">Submissions and interview sessions recorded by day.</p>
              </div>
              {activityLoading && activityMap === null ? (
                <LoadingState label="Loading activity…" className="min-h-40" />
              ) : activityError && activityMap === null ? (
                <StatePanel
                  tone="error"
                  title="Activity is unavailable"
                  description={activityError}
                  action={<Button type="button" variant="secondary" loading={activityLoading} loadingLabel="Retrying…" onClick={() => void loadActivity()}>Retry activity</Button>}
                />
              ) : (
                <>
                  {activityError ? (
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error/25 bg-error/5 px-3 py-2 text-xs text-error" role="alert">
                      <span>Showing the last loaded activity. {activityError}</span>
                      <Button type="button" size="sm" variant="secondary" onClick={() => void loadActivity()}>Retry activity</Button>
                    </div>
                  ) : null}
                  <ActivityHeatmap activityMap={activityMap ?? {}} />
                </>
              )}
            </Card>
          </motion.section>

          <motion.section variants={fadeUp} custom={3} aria-labelledby="plan-title">
            <Card className="p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Practice plan</p>
                  <h2 id="plan-title" className="mt-1 text-xl font-semibold">Recommended next steps</h2>
                  <p className="mt-1 text-sm text-text-secondary">Suggestions based on your coding history.</p>
                </div>
                <Link href="/problems" className="text-sm font-semibold text-primary hover:underline">Browse all problems</Link>
              </div>

              {recommendationsLoading && recommendations === null ? (
                <LoadingState label="Building your practice plan…" className="min-h-40" />
              ) : recommendationsError && recommendations === null ? (
                <StatePanel
                  tone="error"
                  title="Practice suggestions are unavailable"
                  description={recommendationsError}
                  action={<Button type="button" variant="secondary" loading={recommendationsLoading} loadingLabel="Retrying…" onClick={() => void loadRecommendations()}>Retry suggestions</Button>}
                />
              ) : recommendations ? (
                <div className="space-y-6">
                  {recommendations.reasoning ? (
                    <details className="rounded-xl border border-border bg-background/50 px-4 py-3 text-sm">
                      <summary className="cursor-pointer font-semibold text-text-primary">Why these suggestions?</summary>
                      <p className="mt-2 leading-6 text-text-secondary">{recommendations.reasoning}</p>
                    </details>
                  ) : null}

                  <div>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">Try next</h3>
                      {recommendations.difficultySuggestion ? <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-primary">Suggested: {recommendations.difficultySuggestion}</span> : null}
                    </div>
                    {recommendations.recommended.length ? (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {recommendations.recommended.map((problem) => <ProblemCard key={problem.id} problem={problem} />)}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-text-secondary">
                        No personalized problems are ready yet. <Link className="font-semibold text-primary hover:underline" href="/problems">Choose from the full catalogue.</Link>
                      </div>
                    )}
                  </div>

                  {recommendations.focusAreas.length ? (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold">Focus areas</h3>
                      <ul className="flex flex-wrap gap-2">
                        {recommendations.focusAreas.map((area) => <li key={area} className="rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs text-primary">{area}</li>)}
                      </ul>
                    </div>
                  ) : null}

                  <div>
                    <h3 className="mb-1 font-semibold">Worth revisiting</h3>
                    <p className="mb-3 text-xs text-text-secondary">Problems with earlier friction and no attempt in the past three days.</p>
                    {recommendations.revisit.length ? (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {recommendations.revisit.map((problem: RevisitProblemCard) => {
                          const attemptedAt = Date.parse(problem.lastAttemptedAt);
                          const days = now && Number.isFinite(attemptedAt) ? Math.max(0, Math.floor((now - attemptedAt) / 86_400_000)) : null;
                          const meta = days === null ? "Previously attempted" : `Last attempted ${days} day${days === 1 ? "" : "s"} ago`;
                          return <ProblemCard key={problem.id} problem={problem} meta={meta} />;
                        })}
                      </div>
                    ) : (
                      <p className="rounded-xl border border-dashed border-border p-4 text-sm text-text-secondary">Nothing needs a revisit right now.</p>
                    )}
                  </div>
                </div>
              ) : null}
            </Card>
          </motion.section>

          <motion.section variants={fadeUp} custom={4} aria-labelledby="practice-title">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">Practice modes</p>
              <h2 id="practice-title" className="mt-1 text-xl font-semibold">Choose how you want to improve</h2>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {practiceModes.map((mode) => (
                <Link href={mode.href} key={mode.title} className="group h-full">
                  <Card variant="interactive" className="h-full p-5">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-primary" aria-hidden>{mode.icon}</svg>
                    <h3 className="mt-5 text-lg font-semibold group-hover:text-primary">{mode.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">{mode.description}</p>
                    <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-primary">Open practice <span aria-hidden>→</span></span>
                  </Card>
                </Link>
              ))}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {quickLinks.map(([title, description, href]) => (
                <Link key={href} href={href} className="rounded-xl border border-border bg-surface/55 px-4 py-3 transition hover:border-primary/35 hover:bg-surface-hover">
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="mt-0.5 block text-xs text-text-secondary">{description}</span>
                </Link>
              ))}
            </div>
          </motion.section>
        </motion.div>
      </PageShell>
    </Protected>
  );
}
