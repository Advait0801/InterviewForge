"use client";

import { ReactNode, useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Area,
  AreaChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingState, StatePanel } from "@/components/ui/state-panel";
import { api, type AnalyticsResponse } from "@/lib/api";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: Math.min(index, 4) * 0.05, duration: 0.35, ease: "easeOut" as const },
  }),
};

const chartColors = {
  primary: "var(--primary)",
  accent: "var(--accent)",
  secondary: "var(--secondary)",
  grid: "var(--border)",
  tick: "var(--text-secondary)",
};

const difficultyColors: Record<string, string> = {
  easy: "var(--accent)",
  medium: "var(--warning)",
  hard: "var(--error)",
};

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "var(--surface-raised)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    boxShadow: "0 12px 32px rgba(0,0,0,0.16)",
    fontSize: "12px",
    color: "var(--text-primary)",
  },
  labelStyle: { color: "var(--text-primary)", fontWeight: 600 },
  itemStyle: { color: "var(--text-secondary)" },
};

function dateOnly(value: string) {
  const match = value.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function shortDate(value: string) {
  const parsed = dateOnly(value);
  return parsed ? `${parsed.month}/${parsed.day}` : value;
}

function longDate(value: string) {
  const parsed = dateOnly(value);
  if (!parsed) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)));
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Analytics could not be loaded.";
}

function ChartEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-52 items-center justify-center rounded-2xl border border-dashed border-border bg-background/40 px-6 text-center text-sm leading-6 text-text-secondary">
      {children}
    </div>
  );
}

function DataTable({
  label,
  headers,
  rows,
}: {
  label: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <details className="mt-4 rounded-xl border border-border bg-background/50 px-3 py-2 text-xs">
      <summary className="cursor-pointer font-medium text-text-primary">View data table</summary>
      <div className="mt-2 max-h-52 overflow-auto">
        <table className="w-full min-w-64 border-collapse text-left">
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr>
              {headers.map((header) => <th key={header} className="border-b border-border px-2 py-2 font-semibold text-text-primary">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${row[0]}-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="border-b border-border/60 px-2 py-2 text-text-secondary last:text-right">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export default function AnalyticsPage() {
  const gradientId = useId().replace(/:/g, "");
  const reduceMotion = useReducedMotion();
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.getUserAnalytics());
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const difficultyData = useMemo(() => {
    if (!data) return [];
    const order = ["easy", "medium", "hard"];
    return Object.entries(data.difficultyDistribution)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => order.indexOf(left.name) - order.indexOf(right.name));
  }, [data]);

  const solvedTotal = difficultyData.reduce((sum, item) => sum + item.value, 0);
  const latestAcceptance = data?.acceptanceTrend.at(-1)?.rate ?? null;
  const hasData = Boolean(data && (
    data.solvedOverTime.length ||
    difficultyData.length ||
    data.topicStrengths.length ||
    data.acceptanceTrend.length
  ));
  const solvedRecords = data?.solvedOverTime.reduce((sum, point) => sum + point.count, 0) ?? 0;
  const maxTopicCount = Math.max(1, ...(data?.topicStrengths.map((topic) => topic.count) ?? [1]));

  if (loading && data === null) {
    return (
      <Protected>
        <PageShell>
          <LoadingState label="Loading analytics…" className="min-h-[55vh]" />
        </PageShell>
      </Protected>
    );
  }

  return (
    <Protected>
      <PageShell>
        <motion.div initial="hidden" animate="visible" className="space-y-7">
          <motion.header variants={fadeUp} custom={0} className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Coding progress</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Analytics you can act on</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
                See what you have solved, where you practice most, and how submission accuracy changes over time.
              </p>
            </div>
            <Link href="/problems" className={buttonStyles({ variant: "secondary" })}>Choose a problem</Link>
          </motion.header>

          {error && data === null ? (
            <motion.div variants={fadeUp} custom={1}>
              <StatePanel
                tone="error"
                title="Analytics are unavailable"
                description={`${error} Your progress has not been replaced with zero values.`}
                action={<Button type="button" variant="secondary" loading={loading} loadingLabel="Retrying…" onClick={() => void loadAnalytics()}>Retry analytics</Button>}
              />
            </motion.div>
          ) : !hasData ? (
            <motion.div variants={fadeUp} custom={1}>
              <StatePanel
                title="No coding progress yet"
                description="Complete and submit a coding problem to start building difficulty, topic, and acceptance trends."
                action={<Link href="/problems" className={buttonStyles()}>Solve your first problem</Link>}
              />
            </motion.div>
          ) : data ? (
            <>
              {error ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error/25 bg-error/5 px-4 py-3" role="alert">
                  <p className="text-sm text-error">Showing the last loaded analytics. {error}</p>
                  <Button type="button" size="sm" variant="secondary" loading={loading} loadingLabel="Retrying…" onClick={() => void loadAnalytics()}>Retry analytics</Button>
                </div>
              ) : null}

              <motion.section variants={fadeUp} custom={1} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Analytics summary">
                {[
                  ["Unique problems solved", solvedTotal, "Across all recorded submissions"],
                  ["Active solve days", data.solvedOverTime.length, "Within the past 90 days"],
                  ["Tracked topics", data.topicStrengths.length, "Top solved topic groups"],
                  ["Latest acceptance", latestAcceptance === null ? "—" : `${latestAcceptance}%`, latestAcceptance === null ? "No weekly submissions" : "Most recent recorded week"],
                ].map(([label, value, context]) => (
                  <Card key={label} className="p-5">
                    <p className="text-xs font-medium text-text-secondary">{label}</p>
                    <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
                    <p className="mt-1 text-[11px] text-text-secondary">{context}</p>
                  </Card>
                ))}
              </motion.section>

              <div className="grid gap-5 lg:grid-cols-2">
                <motion.section variants={fadeUp} custom={2} aria-labelledby="solved-title">
                  <Card className="h-full p-5 sm:p-6">
                    <h2 id="solved-title" className="text-lg font-semibold">Solved by day</h2>
                    <p className="mt-1 text-sm text-text-secondary">{solvedRecords} passed problem record{solvedRecords === 1 ? "" : "s"} across {data.solvedOverTime.length} active day{data.solvedOverTime.length === 1 ? "" : "s"} in the past 90 days.</p>
                    {data.solvedOverTime.length ? (
                      <>
                        <div className="mt-4 h-[250px]" aria-hidden>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data.solvedOverTime} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                              <XAxis dataKey="day" tick={{ fontSize: 10, fill: chartColors.tick }} tickFormatter={shortDate} interval="preserveStartEnd" />
                              <YAxis tick={{ fontSize: 10, fill: chartColors.tick }} allowDecimals={false} width={38} />
                              <Tooltip {...tooltipStyle} labelFormatter={(value) => longDate(String(value))} formatter={(value) => [value, "Solved"]} />
                              <Line type="monotone" dataKey="count" stroke={chartColors.primary} strokeWidth={2.5} dot={{ r: 3, fill: chartColors.primary }} activeDot={{ r: 5 }} isAnimationActive={!reduceMotion} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <DataTable label="Problems solved by day" headers={["Date", "Solved"]} rows={data.solvedOverTime.map((point) => [longDate(point.day), point.count])} />
                      </>
                    ) : <ChartEmpty>No passed problems are recorded in the past 90 days.</ChartEmpty>}
                  </Card>
                </motion.section>

                <motion.section variants={fadeUp} custom={2} aria-labelledby="difficulty-title">
                  <Card className="h-full p-5 sm:p-6">
                    <h2 id="difficulty-title" className="text-lg font-semibold">Solved by difficulty</h2>
                    <p className="mt-1 text-sm text-text-secondary">{solvedTotal} unique solved problem{solvedTotal === 1 ? "" : "s"}, grouped by catalogue difficulty.</p>
                    {difficultyData.length ? (
                      <>
                        <div className="mt-4 h-[250px]" aria-hidden>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={difficultyData} cx="50%" cy="46%" innerRadius={55} outerRadius={86} paddingAngle={4} dataKey="value" nameKey="name" isAnimationActive={!reduceMotion}>
                                {difficultyData.map((entry) => <Cell key={entry.name} fill={difficultyColors[entry.name] ?? chartColors.primary} />)}
                              </Pie>
                              <Tooltip {...tooltipStyle} formatter={(value) => [value, "Solved"]} />
                              <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", color: chartColors.tick }} formatter={(value) => <span className="capitalize">{value}</span>} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <DataTable
                          label="Problems solved by difficulty"
                          headers={["Difficulty", "Solved"]}
                          rows={difficultyData.map((item) => [item.name[0].toUpperCase() + item.name.slice(1), item.value])}
                        />
                      </>
                    ) : <ChartEmpty>No difficulty distribution is available yet.</ChartEmpty>}
                  </Card>
                </motion.section>

                <motion.section variants={fadeUp} custom={3} aria-labelledby="topic-title">
                  <Card className="h-full p-5 sm:p-6">
                    <h2 id="topic-title" className="text-lg font-semibold">Solved by topic</h2>
                    <p className="mt-1 text-sm text-text-secondary">Counts show solved problems tagged with each topic; one problem can contribute to several topics.</p>
                    {data.topicStrengths.length >= 3 ? (
                      <div className="mt-4 h-[280px]" aria-hidden>
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="68%" data={data.topicStrengths}>
                            <PolarGrid stroke={chartColors.grid} />
                            <PolarAngleAxis dataKey="topic" tick={{ fontSize: 10, fill: chartColors.tick }} />
                            <PolarRadiusAxis tick={{ fontSize: 9, fill: chartColors.tick }} allowDecimals={false} />
                            <Radar name="Solved" dataKey="count" stroke={chartColors.accent} fill={chartColors.accent} fillOpacity={0.22} isAnimationActive={!reduceMotion} />
                            <Tooltip {...tooltipStyle} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : data.topicStrengths.length ? (
                      <div className="mt-5 space-y-4">
                        {data.topicStrengths.map((topic) => (
                          <div key={topic.topic}>
                            <div className="mb-1.5 flex justify-between gap-3 text-sm"><span>{topic.topic}</span><span className="font-semibold">{topic.count}</span></div>
                            <div className="h-2 rounded-full bg-surface-hover"><div className="h-full rounded-full bg-accent" style={{ width: `${(topic.count / maxTopicCount) * 100}%` }} /></div>
                          </div>
                        ))}
                      </div>
                    ) : <ChartEmpty>Solve problems across topics to build this view.</ChartEmpty>}
                    {data.topicStrengths.length ? (
                      <DataTable label="Problems solved by topic" headers={["Topic", "Solved"]} rows={data.topicStrengths.map((topic) => [topic.topic, topic.count])} />
                    ) : null}
                  </Card>
                </motion.section>

                <motion.section variants={fadeUp} custom={4} aria-labelledby="acceptance-title">
                  <Card className="h-full p-5 sm:p-6">
                    <h2 id="acceptance-title" className="text-lg font-semibold">Weekly acceptance</h2>
                    <p className="mt-1 text-sm text-text-secondary">Passed submissions as a percentage of all submissions in each recorded week.</p>
                    {data.acceptanceTrend.length ? (
                      <>
                        <div className="mt-4 h-[280px]" aria-hidden>
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.acceptanceTrend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                              <defs>
                                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={chartColors.secondary} stopOpacity={0.32} />
                                  <stop offset="95%" stopColor={chartColors.secondary} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <XAxis dataKey="week" tick={{ fontSize: 10, fill: chartColors.tick }} tickFormatter={shortDate} interval="preserveStartEnd" />
                              <YAxis tick={{ fontSize: 10, fill: chartColors.tick }} domain={[0, 100]} tickFormatter={(value: number) => `${value}%`} width={44} />
                              <Tooltip {...tooltipStyle} labelFormatter={(value) => `Week of ${longDate(String(value))}`} formatter={(value) => [`${value}%`, "Acceptance"]} />
                              <Area type="monotone" dataKey="rate" stroke={chartColors.secondary} strokeWidth={2.5} fill={`url(#${gradientId})`} isAnimationActive={!reduceMotion} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                        <DataTable label="Weekly submission acceptance" headers={["Week", "Acceptance"]} rows={data.acceptanceTrend.map((point) => [longDate(point.week), `${point.rate}%`])} />
                      </>
                    ) : <ChartEmpty>Submit coding attempts across a week to start an acceptance trend.</ChartEmpty>}
                  </Card>
                </motion.section>
              </div>
            </>
          ) : null}
        </motion.div>
      </PageShell>
    </Protected>
  );
}
