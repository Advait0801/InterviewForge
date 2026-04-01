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
  const [topic, setTopic] = useState("all");
  const [solvedFilter, setSolvedFilter] = useState<"all" | "solved" | "unsolved">("all");
  const [savingBookmarkId, setSavingBookmarkId] = useState<string | null>(null);

  useEffect(() => {
    api
      .listProblems({ auth: true })
      .then((res) => setProblems(res.problems))
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Could not load problems");
        setProblems([]);
      });
  }, []);

  const topics = useMemo(() => {
    const allTopics = new Set<string>();
    for (const p of problems) {
      for (const t of p.topics ?? []) allTopics.add(t);
    }
    return ["all", ...Array.from(allTopics).sort((a, b) => a.localeCompare(b))];
  }, [problems]);

  const filtered = useMemo(() => {
    const DIFF_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
    return problems
      .filter((p) => {
        const matchDiff = difficulty === "all" || p.difficulty === difficulty;
        const matchTopic = topic === "all" || (p.topics ?? []).includes(topic);
        const isSolved = Boolean(p.is_solved);
        const matchSolved =
          solvedFilter === "all" || (solvedFilter === "solved" ? isSolved : !isSolved);
        const q = query.trim().toLowerCase();
        const matchQuery = !q || p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
        return matchDiff && matchTopic && matchSolved && matchQuery;
      })
      .sort((a, b) => (DIFF_ORDER[a.difficulty] ?? 9) - (DIFF_ORDER[b.difficulty] ?? 9));
  }, [problems, query, difficulty, topic, solvedFilter]);

  const toggleBookmark = async (problemId: string, bookmarked: boolean) => {
    if (savingBookmarkId) return;
    setSavingBookmarkId(problemId);
    try {
      if (bookmarked) {
        await api.removeBookmark(problemId);
      } else {
        await api.addBookmark(problemId);
      }
      setProblems((prev) =>
        prev.map((p) => (p.id === problemId ? { ...p, is_bookmarked: !bookmarked } : p))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update bookmark");
    } finally {
      setSavingBookmarkId(null);
    }
  };

  return (
    <Protected>
      <PageShell>
        <motion.div initial="hidden" animate="visible">
          <motion.div variants={fadeUp} custom={0} className="mb-6">
            <h1 className="text-3xl font-bold sm:text-4xl tracking-tight">Problems</h1>
            <p className="mt-1 text-text-secondary">Sharpen your skills with algorithm challenges</p>
          </motion.div>

          {/* Filters row */}
          <motion.div variants={fadeUp} custom={1} className="mb-6 flex flex-col gap-4">
            {/* Search + dropdowns */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 max-w-md">
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

              <select
                value={solvedFilter}
                onChange={(e) => setSolvedFilter(e.target.value as "all" | "solved" | "unsolved")}
                className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                <option value="all">All Status</option>
                <option value="solved">Solved</option>
                <option value="unsolved">Unsolved</option>
              </select>

              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 max-w-[200px]"
              >
                {topics.map((t) => (
                  <option key={t} value={t}>
                    {t === "all" ? "All Topics" : t}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty pills */}
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
              <motion.div key={p.id} variants={fadeUp} custom={i + 3}>
                <Link href={`/problems/${p.id}`}>
                  <div
                    className={`rounded-2xl border border-border ${difficultyAccent[p.difficulty] || ""} border-l-4 bg-surface/80 backdrop-blur-sm p-5 transition-all duration-300 hover:border-border-hover hover:shadow-lg hover:shadow-glow-primary hover:translate-x-1 group`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <h2 className="text-lg font-semibold group-hover:text-primary transition-colors">
                        {p.title}
                      </h2>
                      <div className="flex items-center gap-2">
                        {p.is_solved ? (
                          <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                            Solved
                          </span>
                        ) : null}
                        <Badge
                          tone={p.difficulty === "easy" ? "success" : p.difficulty === "medium" ? "warning" : "danger"}
                        >
                          {p.difficulty}
                        </Badge>
                        <button
                          type="button"
                          aria-label={p.is_bookmarked ? "Remove bookmark" : "Add bookmark"}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleBookmark(p.id, Boolean(p.is_bookmarked));
                          }}
                          disabled={savingBookmarkId === p.id}
                          className="rounded-md p-1 text-text-secondary transition hover:bg-surface-hover hover:text-warning disabled:opacity-50"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill={p.is_bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-text-secondary line-clamp-2 leading-relaxed">{p.description}</p>
                    {(p.topics ?? []).length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(p.topics ?? []).slice(0, 3).map((t) => (
                          <span key={t} className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-text-secondary">
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Link>
              </motion.div>
            ))}
            {filtered.length === 0 && problems.length > 0 && (
              <motion.p variants={fadeUp} custom={3} className="py-12 text-center text-text-secondary">
                No problems match your filters.
              </motion.p>
            )}
          </div>
        </motion.div>
      </PageShell>
    </Protected>
  );
}
