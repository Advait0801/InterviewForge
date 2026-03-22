"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api, Problem } from "@/lib/api";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.4, ease: "easeOut" as const },
  }),
};

const difficultyAccent: Record<string, string> = {
  easy: "border-l-accent",
  medium: "border-l-warning",
  hard: "border-l-error",
};

export default function ProblemsPage() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<"all" | "easy" | "medium" | "hard">("all");

  useEffect(() => {
    api
      .listProblems()
      .then((res) => setProblems(res.problems))
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Could not load problems");
        setProblems([]);
      });
  }, []);

  const filtered = useMemo(() => {
    const DIFF_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
    return problems
      .filter((p) => {
        const matchDiff = difficulty === "all" || p.difficulty === difficulty;
        const q = query.trim().toLowerCase();
        const matchQuery = !q || p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
        return matchDiff && matchQuery;
      })
      .sort((a, b) => (DIFF_ORDER[a.difficulty] ?? 9) - (DIFF_ORDER[b.difficulty] ?? 9));
  }, [problems, query, difficulty]);

  return (
    <Protected>
      <PageShell>
        <motion.div initial="hidden" animate="visible">
          <motion.div variants={fadeUp} custom={0} className="mb-6">
            <h1 className="text-3xl font-bold sm:text-4xl tracking-tight">Problems</h1>
            <p className="mt-1 text-text-secondary">Sharpen your skills with algorithm challenges</p>
          </motion.div>

          <motion.div variants={fadeUp} custom={1} className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-lg">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <Input
                className="pl-9"
                placeholder="Search problems..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "easy", "medium", "hard"] as const).map((d) => {
                const isActive = difficulty === d;
                const activeColors: Record<string, string> = {
                  all: "border-primary bg-primary/10 text-primary",
                  easy: "border-accent bg-accent/10 text-accent",
                  medium: "border-warning bg-warning/10 text-warning",
                  hard: "border-error bg-error/10 text-error",
                };
                return (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? activeColors[d]
                        : "border-border text-text-secondary hover:border-border-hover hover:text-text-primary"
                    }`}
                    type="button"
                  >
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                );
              })}
            </div>
          </motion.div>

          <div className="space-y-3">
            {filtered.map((p, i) => (
              <motion.div key={p.id} variants={fadeUp} custom={i + 2}>
                <Link href={`/problems/${p.id}`}>
                  <div
                    className={`rounded-2xl border border-border ${difficultyAccent[p.difficulty] || ""} border-l-4 bg-surface/80 backdrop-blur-sm p-5 transition-all duration-300 hover:border-border-hover hover:shadow-lg hover:shadow-glow-primary hover:translate-x-1 group`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <h2 className="text-lg font-semibold group-hover:text-primary transition-colors">{p.title}</h2>
                      <Badge
                        tone={p.difficulty === "easy" ? "success" : p.difficulty === "medium" ? "warning" : "danger"}
                      >
                        {p.difficulty}
                      </Badge>
                    </div>
                    <p className="text-sm text-text-secondary line-clamp-2 leading-relaxed">{p.description}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
            {filtered.length === 0 && problems.length > 0 && (
              <motion.p variants={fadeUp} custom={2} className="py-12 text-center text-text-secondary">
                No problems match your filters.
              </motion.p>
            )}
          </div>
        </motion.div>
      </PageShell>
    </Protected>
  );
}
