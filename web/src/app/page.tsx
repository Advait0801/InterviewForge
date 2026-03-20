"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

const features = [
  {
    title: "AI Interview Simulation",
    description: "Company-style interviews with adaptive follow-up questions powered by LLMs.",
  },
  {
    title: "Coding Workspace",
    description: "Solve problems with a code editor, test execution, and runtime feedback.",
  },
  {
    title: "Speech Feedback",
    description: "Record your explanation and receive structured communication feedback.",
  },
];

export default function Home() {
  return (
    <PageShell>
      <div className="flex flex-1 flex-col justify-center">
        <motion.section
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={0}
          className="w-full rounded-2xl border border-border bg-surface p-8 sm:p-12"
        >
          <h1 className="mb-4 text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
            Practice real interviews.{" "}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Ship better code.
            </span>
          </h1>
          <p className="mb-8 max-w-2xl text-base text-text-secondary sm:text-lg">
            InterviewForge simulates real software engineering interviews with coding, system design, and behavioral
            rounds — all powered by AI.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/register">
              <Button>Get Started</Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
          </div>
        </motion.section>

        <motion.section
          initial="hidden"
          animate="visible"
          className="mt-8 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((f, i) => (
            <motion.div key={f.title} variants={fadeUp} custom={i + 1}>
              <Card className="h-full">
                <h2 className="mb-2 text-lg font-semibold">{f.title}</h2>
                <p className="text-sm text-text-secondary">{f.description}</p>
              </Card>
            </motion.div>
          ))}
        </motion.section>
      </div>
    </PageShell>
  );
}
