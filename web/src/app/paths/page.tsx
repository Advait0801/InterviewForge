"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { api, LearningPathSummary } from "@/lib/api";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: "easeOut" as const },
  }),
};

function levelColor(level: string) {
  if (level === "beginner") return "bg-accent/15 text-accent border-accent/25";
  if (level === "intermediate") return "bg-warning/15 text-warning border-warning/25";
  return "bg-error/15 text-error border-error/25";
}

export default function LearningPathsPage() {
  const [paths, setPaths] = useState<LearningPathSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getLearningPaths(true)
      .then((r) => setPaths(r.paths))
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load paths");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Protected>
      <PageShell>
        <motion.div initial="hidden" animate="visible" className="space-y-8">
          <motion.div variants={fadeUp} custom={0}>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Learning Paths</h1>
            <p className="mt-2 max-w-2xl text-text-secondary">
              Curated problem sequences by topic. Work through them in order to build skills progressively.
            </p>
          </motion.div>

          {loading ? (
            <div className="flex items-center gap-2 text-text-secondary">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Loading paths…
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {paths.map((p, i) => {
                const pct = p.problemCount > 0 ? Math.round((p.completedCount / p.problemCount) * 100) : 0;
                return (
                  <motion.div key={p.slug} variants={fadeUp} custom={i + 1}>
                    <Link href={`/paths/${encodeURIComponent(p.slug)}`}>
                      <Card className="h-full p-5 transition hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                            {p.topic}
                          </span>
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${levelColor(p.difficultyLevel)}`}
                          >
                            {p.difficultyLevel}
                          </span>
                        </div>
                        <h2 className="text-lg font-semibold text-text-primary">{p.title}</h2>
                        <p className="mt-2 line-clamp-2 text-sm text-text-secondary">{p.description}</p>
                        <div className="mt-4">
                          <div className="mb-1 flex justify-between text-xs text-text-secondary">
                            <span>
                              Progress {p.completedCount}/{p.problemCount}
                            </span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-surface">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </Card>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}

          {!loading && paths.length === 0 && (
            <p className="text-sm text-text-secondary">No learning paths available yet. Run the seed script after migrations.</p>
          )}
        </motion.div>
      </PageShell>
    </Protected>
  );
}
