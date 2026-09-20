"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
import { InterviewWorkspacePreview } from "@/components/landing/interview-workspace-preview";
import { getToken } from "@/lib/auth";

const noopSubscribe = () => () => {};

const features = [
  {
    title: "Real interview flow",
    description: "Practice coding, communication, and design in a guided multi-stage session.",
    accent: "bg-primary/10 text-primary",
    icon: "01",
  },
  {
    title: "150 coding problems",
    description: "Build fluency across curated problems, four languages, and company tags.",
    accent: "bg-secondary/10 text-secondary",
    icon: "02",
  },
  {
    title: "Actionable feedback",
    description: "Review code quality, explanations, and system-design tradeoffs after practice.",
    accent: "bg-accent/10 text-accent",
    icon: "03",
  },
];

const stages = [
  ["Solve", "Work through a focused coding problem."],
  ["Explain", "Talk through choices and complexity."],
  ["Design", "Connect components and tradeoffs."],
  ["Improve", "Turn feedback into the next practice step."],
];

export default function Home() {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const isAuthed = mounted && Boolean(getToken());

  return (
    <PageShell>
      <div className="relative isolate flex flex-1 flex-col py-4 sm:py-8">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <div className="absolute -left-32 -top-24 h-96 w-96 rounded-full bg-primary/10 blur-[130px] animate-blob" />
          <div className="absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-secondary/10 blur-[130px] animate-blob [animation-delay:2s]" />
        </div>

        <section className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16" aria-labelledby="hero-title">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
              Practice the complete interview
            </span>
            <h1 id="hero-title" className="mt-6 text-4xl font-bold leading-[1.05] tracking-[-0.04em] sm:text-5xl lg:text-6xl xl:text-7xl">
              Build the skills to{" "}
              <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent animate-gradient bg-[length:200%_200%]">
                interview with confidence.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-text-secondary sm:text-lg">
              Practice coding, communication, and system design in one focused workspace, then use clear feedback to improve the next attempt.
            </p>

            <div className="mt-8 flex min-h-12 flex-wrap gap-3" aria-live="polite">
              {!mounted ? (
                <>
                  <span className="h-12 w-44 animate-pulse rounded-xl bg-surface-hover" />
                  <span className="h-12 w-32 animate-pulse rounded-xl bg-surface-hover" />
                </>
              ) : isAuthed ? (
                <>
                  <Link href="/dashboard" className={buttonStyles({ size: "lg" })}>Open dashboard</Link>
                  <Link href="/problems" className={buttonStyles({ variant: "ghost", size: "lg" })}>Start a problem</Link>
                </>
              ) : (
                <>
                  <Link href="/register" className={buttonStyles({ size: "lg" })}>Start practicing free</Link>
                  <Link href="/login" className={buttonStyles({ variant: "ghost", size: "lg" })}>Sign in</Link>
                </>
              )}
            </div>

            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-text-secondary" aria-label="Platform highlights">
              {["150 curated problems", "Four coding languages", "No credit card required"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path d="m3 7 2.5 2.5L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          <InterviewWorkspacePreview />
        </section>

        <section className="mt-20" aria-labelledby="features-title">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">One practice loop</p>
            <h2 id="features-title" className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Everything connects to the next attempt.</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="p-6">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl font-mono text-xs font-bold ${feature.accent}`}>{feature.icon}</span>
                <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{feature.description}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-3xl border border-border bg-surface/60 p-6 sm:p-8 lg:p-10" aria-labelledby="stages-title">
          <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">Four clear stages</p>
              <h2 id="stages-title" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Practice more than the final answer.</h2>
              <p className="mt-3 text-sm leading-6 text-text-secondary">Strong interviews combine problem solving, communication, and sound tradeoffs. InterviewForge keeps those skills in one flow.</p>
            </div>
            <ol className="grid gap-3 sm:grid-cols-2">
              {stages.map(([title, description], index) => (
                <li key={title} className="rounded-2xl border border-border bg-background/70 p-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-primary">0{index + 1}</span>
                    <h3 className="font-semibold">{title}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-text-secondary">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
