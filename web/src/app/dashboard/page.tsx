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
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: "easeOut" as const },
  }),
};

const stats = [
  { label: "Problems Attempted", value: "—", icon: "💻" },
  { label: "Interviews Started", value: "—", icon: "🎙️" },
  { label: "Best Streak", value: "—", icon: "🔥" },
];

const modes = [
  {
    title: "Practice Coding",
    description: "Solve coding problems with run/submit workflow and instant feedback.",
    href: "/problems",
  },
  {
    title: "AI Interview",
    description: "Run behavioral, coding, and system-design interview turns with feedback.",
    href: "/interview",
  },
];

const comingSoon = [
  {
    title: "System Design Canvas",
    description: "Draw architecture diagrams and get AI feedback on your design choices.",
  },
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
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    api
      .me()
      .then((res) => setEmail(res.user.email))
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Could not load profile";
        toast.error(msg);
      });
  }, []);

  return (
    <Protected>
      <PageShell>
        <motion.div initial="hidden" animate="visible" className="space-y-8">
          {/* Welcome */}
          <motion.div variants={fadeUp} custom={0}>
            <h1 className="text-3xl font-semibold sm:text-4xl">
              Good to see you{email ? `, ${email.split("@")[0]}` : ""}.
            </h1>
            <p className="mt-1 text-text-secondary">Pick up where you left off or start something new.</p>
          </motion.div>

          {/* Quick stats */}
          <motion.div variants={fadeUp} custom={1} className="grid gap-4 sm:grid-cols-3">
            {stats.map((s) => (
              <Card key={s.label} className="flex items-center gap-3">
                <span className="text-2xl">{s.icon}</span>
                <div>
                  <p className="text-xl font-semibold">{s.value}</p>
                  <p className="text-xs text-text-secondary">{s.label}</p>
                </div>
              </Card>
            ))}
          </motion.div>

          {/* Mode cards */}
          <motion.div variants={fadeUp} custom={2} className="grid gap-4 md:grid-cols-2">
            {modes.map((m) => (
              <Link href={m.href} key={m.title}>
                <Card className="h-full transition hover:border-primary">
                  <h2 className="mb-2 text-xl font-semibold">{m.title}</h2>
                  <p className="text-sm text-text-secondary">{m.description}</p>
                </Card>
              </Link>
            ))}
          </motion.div>

          {/* Coming soon */}
          <motion.div variants={fadeUp} custom={3}>
            <h2 className="mb-3 text-lg font-semibold text-text-secondary">Coming Soon</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {comingSoon.map((c) => (
                <Card key={c.title} className="border-dashed opacity-70">
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
              <ul className="space-y-2">
                {tips.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="mt-0.5 text-primary">▸</span>
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
