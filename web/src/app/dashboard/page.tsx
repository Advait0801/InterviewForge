"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { ActivityHeatmap } from "@/components/ui/activity-heatmap";
import { api, type RecommendedProblemCard, type RevisitProblemCard } from "@/lib/api";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const },
  }),
};

type StatKey = "problemsAttempted" | "interviewsStarted" | "bestStreak" | "currentStreak";

const statCards: Array<{ key: StatKey; label: string; icon: string; gradient: string; border: string; suffix: string }> = [
  { key: "problemsAttempted", label: "Problems Attempted", icon: "💻", gradient: "from-primary/20 to-secondary/10", border: "border-primary/20", suffix: "" },
  { key: "interviewsStarted", label: "Interviews Started", icon: "🎙️", gradient: "from-accent/20 to-secondary/10", border: "border-accent/20", suffix: "" },
  { key: "currentStreak", label: "Current Streak", icon: "⚡", gradient: "from-secondary/20 to-primary/10", border: "border-secondary/20", suffix: "d" },
  { key: "bestStreak", label: "Best Streak", icon: "🔥", gradient: "from-warning/20 to-error/10", border: "border-warning/20", suffix: "d" },
];

const modes = [
  {
    title: "Practice Coding",
    description: "Solve coding problems with run/submit workflow and instant feedback.",
    href: "/problems",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
        <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
      </svg>
    ),
  },
  {
    title: "AI Interview",
    description: "Run behavioral, coding, and system-design interview turns with feedback.",
    href: "/interview",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    title: "System Design",
    description: "Describe architecture, get AI-generated diagrams, and scored feedback.",
    href: "/system-design",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-secondary">
        <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 8h2m2 0h2m2 0h2"/>
      </svg>
    ),
  },
];

const actionModes = [
  ...modes,
  {
    title: "Online Assessment",
    description: "Timed multi-problem coding tests with scoring report.",
    href: "/assessments",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-warning">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    title: "Learning Paths",
    description: "Curated topic sequences — solve in order and track your progress.",
    href: "/paths",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-secondary">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8"/><path d="M8 11h8"/>
      </svg>
    ),
  },
  {
    title: "Leaderboard",
    description: "See how you rank against other users globally.",
    href: "/leaderboard",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-warning">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
      </svg>
    ),
  },
  {
    title: "Analytics",
    description: "Track your progress with charts and insights.",
    href: "/analytics",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
        <path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
      </svg>
    ),
  },
];

const tips = [
  "Explain your thought process out loud — interviewers value communication.",
  "Start with a brute-force approach, then optimize.",
  "Ask clarifying questions before diving into code.",
  "Practice system design by breaking problems into components.",
];

export default function DashboardPage() {
  const [userName, setUserName] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<StatKey, number>>({
    problemsAttempted: 0,
    interviewsStarted: 0,
    bestStreak: 0,
    currentStreak: 0,
  });
  const [activityMap, setActivityMap] = useState<Record<string, number>>({});
  const [recs, setRecs] = useState<{
    recommended: RecommendedProblemCard[];
    revisit: RevisitProblemCard[];
    focusAreas: string[];
    reasoning: string;
    difficultySuggestion: string;
  } | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);

  useEffect(() => {
    api
      .me()
      .then((res) => setUserName(res.user.name || res.user.username || res.user.email.split("@")[0]))
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Could not load profile";
        toast.error(msg);
      });
    api
      .userStats()
      .then((res) =>
        setStats((prev) => ({ ...prev, problemsAttempted: res.problemsAttempted, interviewsStarted: res.interviewsStarted, bestStreak: res.bestStreak })),
      )
      .catch(() => {});
    api
      .getUserActivity()
      .then((res) => {
        setStats((prev) => ({ ...prev, currentStreak: res.currentStreak, bestStreak: res.bestStreak }));
        setActivityMap(res.activityMap);
      })
      .catch(() => {});
    setRecsLoading(true);
    api
      .getRecommendations()
      .then(setRecs)
      .catch(() => {
        /* optional feature */
      })
      .finally(() => setRecsLoading(false));
  }, []);

  return (
    <Protected>
      <PageShell>
        <motion.div initial="hidden" animate="visible" className="space-y-8">
          {/* Welcome */}
          <motion.div variants={fadeUp} custom={0}>
            <h1 className="text-3xl font-bold sm:text-4xl lg:text-5xl tracking-tight">
              Good to see you{userName ? `, ${userName}` : ""}.
            </h1>
            <p className="mt-2 text-text-secondary text-lg">Pick up where you left off or start something new.</p>
          </motion.div>

          {/* Quick stats */}
          <motion.div variants={fadeUp} custom={1} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((s) => (
              <div
                key={s.label}
                className={`rounded-2xl border ${s.border} bg-gradient-to-br ${s.gradient} backdrop-blur-sm p-5 transition-all duration-300 hover:scale-[1.02]`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{s.icon}</span>
                  <div>
                    <p className="text-2xl font-bold">{stats[s.key]}{s.suffix}</p>
                    <p className="text-xs text-text-secondary font-medium">{s.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Activity heatmap */}
          <motion.div variants={fadeUp} custom={2}>
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-text-secondary">Activity</h2>
              <ActivityHeatmap activityMap={activityMap} />
            </Card>
          </motion.div>

          {/* Recommended + revisit */}
          <motion.div variants={fadeUp} custom={3} className="space-y-8">
            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-text-secondary">Recommended for you</h2>
                {recs?.reasoning ? (
                  <span
                    className="inline-flex cursor-help items-center gap-1 rounded-full border border-border bg-surface-hover px-2 py-0.5 text-[11px] text-text-secondary"
                    title={recs.reasoning}
                  >
                    Why?
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </span>
                ) : null}
              </div>
              {recsLoading && (
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Loading recommendations…
                </div>
              )}
              {!recsLoading && recs && (!recs.recommended.length && !recs.revisit.length) && (
                <p className="text-sm text-text-secondary">Solve a few problems to unlock personalized recommendations.</p>
              )}
              {!recsLoading && recs && recs.recommended.length > 0 && (
                <div className="-mx-1 flex gap-3 overflow-x-auto pb-2 px-1">
                  {recs.recommended.map((p) => (
                    <Link
                      key={p.id}
                      href={`/problems/${p.id}`}
                      className="min-w-[220px] flex-shrink-0 rounded-xl border border-border bg-surface/60 p-4 transition hover:border-primary/40 hover:bg-surface-hover"
                    >
                      <p className="line-clamp-2 text-sm font-semibold text-text-primary">{p.title}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            p.difficulty === "easy"
                              ? "border-accent/30 bg-accent/10 text-accent"
                              : p.difficulty === "medium"
                                ? "border-warning/30 bg-warning/10 text-warning"
                                : "border-error/30 bg-error/10 text-error"
                          }`}
                        >
                          {p.difficulty}
                        </span>
                        {(p.topics ?? []).slice(0, 2).map((t) => (
                          <span key={t} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-text-secondary">
                            {t}
                          </span>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              {recs?.reasoning ? (
                <p className="mt-3 text-xs leading-relaxed text-text-secondary md:hidden">{recs.reasoning}</p>
              ) : null}
              {recs?.difficultySuggestion ? (
                <p className="mt-2 text-xs text-text-secondary">
                  <span className="font-semibold text-text-primary">Difficulty hint:</span> {recs.difficultySuggestion}
                </p>
              ) : null}
              {recs?.focusAreas?.length ? (
                <div className="mt-3">
                  <p className="mb-1 text-[11px] font-semibold text-text-secondary">Focus areas</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {recs.focusAreas.map((f) => (
                      <li key={f} className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>

            <Card>
              <h2 className="mb-4 text-sm font-semibold text-text-secondary">Problems to revisit</h2>
              <p className="mb-3 text-xs text-text-secondary">
                Spaced repetition: problems you struggled with and haven&apos;t touched in 3+ days.
              </p>
              {recsLoading && (
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Loading…
                </div>
              )}
              {!recsLoading && recs && recs.revisit.length === 0 && (
                <p className="text-sm text-text-secondary">Nothing to revisit yet — keep practicing.</p>
              )}
              {!recsLoading && recs && recs.revisit.length > 0 && (
                <div className="-mx-1 flex gap-3 overflow-x-auto pb-2 px-1">
                  {recs.revisit.map((p) => {
                    const last = new Date(p.lastAttemptedAt);
                    const days = Math.floor((Date.now() - last.getTime()) / (86400 * 1000));
                    return (
                      <Link
                        key={p.id}
                        href={`/problems/${p.id}`}
                        className="min-w-[220px] flex-shrink-0 rounded-xl border border-border bg-surface/60 p-4 transition hover:border-warning/40 hover:bg-surface-hover"
                      >
                        <p className="line-clamp-2 text-sm font-semibold text-text-primary">{p.title}</p>
                        <p className="mt-2 text-[11px] text-text-secondary">
                          Last attempt {days} day{days === 1 ? "" : "s"} ago
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              p.difficulty === "easy"
                                ? "border-accent/30 bg-accent/10 text-accent"
                                : p.difficulty === "medium"
                                  ? "border-warning/30 bg-warning/10 text-warning"
                                  : "border-error/30 bg-error/10 text-error"
                            }`}
                          >
                            {p.difficulty}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </Card>
          </motion.div>

          {/* Action cards (balanced 2x2 on desktop) + quick links */}
          <motion.div variants={fadeUp} custom={4} className="grid gap-5 md:grid-cols-2">
            {actionModes.map((m) => (
              <Link href={m.href} key={m.title} className="h-full">
                <Card className="h-full group hover:scale-[1.01] transition-transform duration-300 hover:border-primary/40">
                  <div className="flex min-h-[92px] items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-hover border border-border group-hover:border-primary/30 transition-colors">
                      {m.icon}
                    </div>
                    <div>
                      <h2 className="mb-1.5 text-xl font-semibold group-hover:text-primary transition-colors">{m.title}</h2>
                      <p className="text-sm text-text-secondary leading-relaxed">{m.description}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </motion.div>

          {/* Tips */}
          <motion.div variants={fadeUp} custom={5}>
            <h2 className="mb-3 text-lg font-semibold text-text-secondary">Interview Tips</h2>
            <Card>
              <ul className="space-y-2.5">
                {tips.map((t, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-text-secondary">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {i + 1}
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </Card>
          </motion.div>
        </motion.div>
      </PageShell>
    </Protected>
  );
}
