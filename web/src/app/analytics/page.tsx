"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { api, AnalyticsResponse } from "@/lib/api";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: "easeOut" as const },
  }),
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "#22c55e",
  medium: "#f59e0b",
  hard: "#ef4444",
};

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "rgba(15, 20, 30, 0.95)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    fontSize: "12px",
    color: "#e2e8f0",
  },
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getUserAnalytics()
      .then(setData)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load analytics"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Protected>
        <PageShell>
          <div className="flex h-[60vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </PageShell>
      </Protected>
    );
  }

  const pieData = data
    ? Object.entries(data.difficultyDistribution).map(([name, value]) => ({ name, value }))
    : [];

  const radarData = data
    ? data.topicStrengths.map((t) => ({ topic: t.topic, count: t.count }))
    : [];

  const hasData = data && (
    data.solvedOverTime.length > 0 ||
    pieData.length > 0 ||
    radarData.length > 0 ||
    data.acceptanceTrend.length > 0
  );

  return (
    <Protected>
      <PageShell>
        <motion.div initial="hidden" animate="visible" className="space-y-6">
          <motion.div variants={fadeUp} custom={0}>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Analytics</h1>
            <p className="mt-1 text-text-secondary">Your coding progress at a glance.</p>
          </motion.div>

          {!hasData ? (
            <motion.div variants={fadeUp} custom={1}>
              <Card>
                <p className="py-8 text-center text-text-secondary">
                  No data yet. Solve some problems to see your analytics!
                </p>
              </Card>
            </motion.div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {/* Solved over time */}
              <motion.div variants={fadeUp} custom={1}>
                <Card>
                  <h2 className="mb-4 text-sm font-semibold text-text-secondary">Problems Solved Over Time</h2>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data!.solvedOverTime}>
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                          tickFormatter={(v: string) => {
                            const d = new Date(v);
                            return `${d.getMonth() + 1}/${d.getDate()}`;
                          }}
                          interval="preserveStartEnd"
                        />
                        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                        <Tooltip {...tooltipStyle} />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="#6366f1"
                          strokeWidth={2}
                          dot={{ r: 3, fill: "#6366f1" }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </motion.div>

              {/* Difficulty distribution */}
              <motion.div variants={fadeUp} custom={2}>
                <Card>
                  <h2 className="mb-4 text-sm font-semibold text-text-secondary">Difficulty Distribution</h2>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={4}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                          }
                        >
                          {pieData.map((entry) => (
                            <Cell key={entry.name} fill={DIFFICULTY_COLORS[entry.name] ?? "#6366f1"} />
                          ))}
                        </Pie>
                        <Tooltip {...tooltipStyle} />
                        <Legend
                          iconType="circle"
                          wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </motion.div>

              {/* Topic strengths */}
              <motion.div variants={fadeUp} custom={3}>
                <Card>
                  <h2 className="mb-4 text-sm font-semibold text-text-secondary">Topic Strengths</h2>
                  <div className="h-[280px]">
                    {radarData.length >= 3 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                          <PolarGrid stroke="rgba(255,255,255,0.08)" />
                          <PolarAngleAxis
                            dataKey="topic"
                            tick={{ fontSize: 10, fill: "#94a3b8" }}
                          />
                          <PolarRadiusAxis tick={{ fontSize: 9, fill: "#64748b" }} />
                          <Radar
                            name="Solved"
                            dataKey="count"
                            stroke="#22c55e"
                            fill="#22c55e"
                            fillOpacity={0.25}
                          />
                          <Tooltip {...tooltipStyle} />
                        </RadarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-text-secondary">
                        Solve problems in at least 3 topics to see the radar chart.
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>

              {/* Acceptance rate trend */}
              <motion.div variants={fadeUp} custom={4}>
                <Card>
                  <h2 className="mb-4 text-sm font-semibold text-text-secondary">Weekly Acceptance Rate</h2>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data!.acceptanceTrend}>
                        <defs>
                          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="week"
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                          tickFormatter={(v: string) => {
                            const d = new Date(v);
                            return `${d.getMonth() + 1}/${d.getDate()}`;
                          }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "#94a3b8" }}
                          domain={[0, 100]}
                          tickFormatter={(v: number) => `${v}%`}
                        />
                        <Tooltip
                          {...tooltipStyle}
                          formatter={(v) => [`${v}%`, "Acceptance"]}
                        />
                        <Area
                          type="monotone"
                          dataKey="rate"
                          stroke="#6366f1"
                          strokeWidth={2}
                          fill="url(#areaGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </motion.div>
            </div>
          )}
        </motion.div>
      </PageShell>
    </Protected>
  );
}
