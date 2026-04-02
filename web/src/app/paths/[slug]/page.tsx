"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { api, LearningPathDetailResponse } from "@/lib/api";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

function diffClass(d: string) {
  if (d === "easy") return "bg-accent/15 text-accent border-accent/25";
  if (d === "medium") return "bg-warning/15 text-warning border-warning/25";
  return "bg-error/15 text-error border-error/25";
}

export default function LearningPathDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [data, setData] = useState<LearningPathDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setNotFound(false);
    api
      .getLearningPath(slug, true)
      .then(setData)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to load path";
        if (msg.toLowerCase().includes("not found")) setNotFound(true);
        else toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <Protected>
        <PageShell>
          <div className="flex items-center gap-2 text-text-secondary">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Loading path…
          </div>
        </PageShell>
      </Protected>
    );
  }

  if (notFound || !data) {
    return (
      <Protected>
        <PageShell>
          <p className="text-text-secondary">Path not found.</p>
          <Link href="/paths" className="mt-4 inline-block text-primary hover:underline">
            Back to paths
          </Link>
        </PageShell>
      </Protected>
    );
  }

  const { path, problems } = data;
  const pct = path.problemCount > 0 ? Math.round((path.completedCount / path.problemCount) * 100) : 0;

  return (
    <Protected>
      <PageShell>
        <motion.div initial="hidden" animate="visible" variants={fadeUp} className="space-y-8">
          <div>
            <Link href="/paths" className="text-sm text-primary hover:underline">
              ← All paths
            </Link>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{path.title}</h1>
                <p className="mt-2 max-w-2xl text-text-secondary">{path.description}</p>
                <p className="mt-2 text-sm text-text-secondary">
                  Topic: <span className="font-medium text-text-primary">{path.topic}</span>
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface/60 px-4 py-3 text-right">
                <p className="text-xs text-text-secondary">Progress</p>
                <p className="text-2xl font-bold text-primary">
                  {path.completedCount}/{path.problemCount}
                </p>
                <p className="text-xs text-text-secondary">{pct}%</p>
              </div>
            </div>
            <div className="mt-4 h-2 max-w-md overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="divide-y divide-border">
              {problems.map((p, idx) => (
                <div
                  key={p.problemId}
                  className="relative flex gap-4 p-4 pl-6 sm:pl-8"
                >
                  {/* timeline */}
                  <div className="absolute left-3 top-0 bottom-0 w-px bg-border sm:left-4" aria-hidden />
                  <div
                    className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                      p.isCompleted
                        ? "border-accent bg-accent/20 text-accent"
                        : "border-border bg-background text-text-secondary"
                    }`}
                  >
                    {p.isCompleted ? "✓" : idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/problems/${p.problemId}`}
                      className="group flex flex-wrap items-center gap-2"
                    >
                      <span className="font-semibold text-text-primary group-hover:text-primary">{p.title}</span>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${diffClass(p.difficulty)}`}
                      >
                        {p.difficulty}
                      </span>
                    </Link>
                    <p className="mt-1 text-xs text-text-secondary">Step {idx + 1} of {problems.length}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </PageShell>
    </Protected>
  );
}
