"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getToken } from "@/lib/auth";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: "easeOut" as const },
  }),
};

const features = [
  {
    title: "AI Interview Simulation",
    description: "Company-style interviews with adaptive follow-up questions powered by LLMs.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
        <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10H5"/><path d="M14 22v-4a2 2 0 0 0-4 0v4"/><rect x="2" y="10" width="20" height="8" rx="2"/>
      </svg>
    ),
  },
  {
    title: "Coding Workspace",
    description: "Solve problems with a code editor, test execution, and runtime feedback.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-secondary">
        <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
      </svg>
    ),
  },
  {
    title: "Speech Feedback",
    description: "Record your explanation and receive structured communication feedback.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>
      </svg>
    ),
  },
  {
    title: "Company-Specific Interviews",
    description: "Practice interviews tailored to Amazon, Google, and Meta with multi-stage rounds.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-warning">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
  },
];

export default function Home() {
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    setIsAuthed(Boolean(getToken()));
  }, []);

  return (
    <PageShell>
      <div className="flex flex-1 flex-col justify-center relative">
        {/* Decorative background blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-primary/10 blur-[120px] animate-blob" />
          <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-secondary/10 blur-[120px] animate-blob [animation-delay:2s]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-60 w-60 rounded-full bg-accent/5 blur-[100px] animate-blob [animation-delay:4s]" />
        </div>

        {/* Hero section */}
        <motion.section
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={0}
          className="relative w-full rounded-3xl border border-border bg-surface/60 backdrop-blur-sm p-8 sm:p-12 lg:p-16"
        >
          <h1 className="mb-6 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl tracking-tight">
            Practice real interviews.{" "}
            <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent animate-gradient bg-[length:200%_200%]">
              Ship better code.
            </span>
          </h1>
          <p className="mb-8 max-w-2xl text-base text-text-secondary sm:text-lg leading-relaxed">
            InterviewForge simulates real software engineering interviews with coding, system design, and behavioral
            rounds — all powered by AI.
          </p>
          <div className="flex flex-wrap gap-4">
            {isAuthed ? (
              <>
                <Link href="/dashboard">
                  <Button>Go to Dashboard</Button>
                </Link>
                <Link href="/problems">
                  <Button variant="ghost">Start Practicing</Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/register">
                  <Button>Get Started — Free</Button>
                </Link>
                <Link href="/login">
                  <Button variant="ghost">Sign In</Button>
                </Link>
              </>
            )}
          </div>
        </motion.section>

        {/* Feature cards */}
        <motion.section
          initial="hidden"
          animate="visible"
          className="relative mt-10 grid w-full gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {features.map((f, i) => (
            <motion.div key={f.title} variants={fadeUp} custom={i + 1}>
              <Card className="h-full group hover:scale-[1.02] transition-transform duration-300">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-hover border border-border group-hover:border-primary/30 transition-colors">
                  {f.icon}
                </div>
                <h2 className="mb-2 text-lg font-semibold">{f.title}</h2>
                <p className="text-sm text-text-secondary leading-relaxed">{f.description}</p>
              </Card>
            </motion.div>
          ))}
        </motion.section>
      </div>
    </PageShell>
  );
}
