"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const },
  }),
};

const statCards = [
  { key: "problemsAttempted" as const, label: "Problems Attempted", icon: "💻", gradient: "from-primary/20 to-secondary/10", border: "border-primary/20", suffix: "" },
  { key: "interviewsStarted" as const, label: "Interviews Started", icon: "🎙️", gradient: "from-accent/20 to-secondary/10", border: "border-accent/20", suffix: "" },
  { key: "bestStreak" as const, label: "Best Streak", icon: "🔥", gradient: "from-warning/20 to-error/10", border: "border-warning/20", suffix: "d" },
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

const comingSoon = [
  {
    title: "Online Assessment Mode",
    description: "Timed multi-problem coding tests with scoring report.",
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
  const [stats, setStats] = useState({ problemsAttempted: 0, interviewsStarted: 0, bestStreak: 0 });

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
      .then((res) => setStats(res))
      .catch(() => {});
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
          <motion.div variants={fadeUp} custom={1} className="grid gap-4 sm:grid-cols-3">
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

          {/* Mode cards */}
          <motion.div variants={fadeUp} custom={2} className="grid gap-5 md:grid-cols-2">
            {modes.map((m) => (
              <Link href={m.href} key={m.title}>
                <Card className="h-full group hover:scale-[1.01] transition-transform duration-300 hover:border-primary/40">
                  <div className="flex items-start gap-4">
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

          {/* Coming soon */}
          <motion.div variants={fadeUp} custom={3}>
            <h2 className="mb-3 text-lg font-semibold text-text-secondary">Coming Soon</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {comingSoon.map((c) => (
                <Card key={c.title} className="relative border-dashed opacity-60 hover:opacity-80">
                  <span className="absolute top-3 right-3 rounded-full bg-warning/10 border border-warning/20 px-2 py-0.5 text-[10px] font-semibold text-warning uppercase">
                    Soon
                  </span>
                  <h3 className="mb-1 font-semibold">{c.title}</h3>
                  <p className="text-sm text-text-secondary">{c.description}</p>
                </Card>
              ))}
            </div>
          </motion.div>

          {/* Tips */}
          <motion.div variants={fadeUp} custom={4}>
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
