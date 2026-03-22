"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api, Problem } from "@/lib/api";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.35, ease: "easeOut" as const },
  }),
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
          <motion.h1 variants={fadeUp} custom={0} className="mb-4 text-3xl font-semibold">
            Problems
          </motion.h1>
          <motion.div variants={fadeUp} custom={1} className="mb-4 flex flex-wrap items-center gap-2">
            <Input
              className="max-w-sm"
              placeholder="Search problems..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {(["all", "easy", "medium", "hard"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`rounded-full border px-3 py-1 text-sm transition ${difficulty === d ? "border-primary text-primary" : "border-border text-text-secondary hover:border-primary/50"}`}
                type="button"
              >
                {d}
              </button>
            ))}
          </motion.div>
          <div className="space-y-3">
            {filtered.map((p, i) => (
              <motion.div key={p.id} variants={fadeUp} custom={i + 2}>
                <Link href={`/problems/${p.id}`}>
                  <Card className="transition hover:border-primary">
                    <div className="mb-2 flex items-center justify-between">
                      <h2 className="text-lg font-semibold">{p.title}</h2>
                      <Badge
                        tone={p.difficulty === "easy" ? "success" : p.difficulty === "medium" ? "warning" : "danger"}
                      >
                        {p.difficulty}
                      </Badge>
                    </div>
                    <p className="text-sm text-text-secondary">{p.description}</p>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </PageShell>
    </Protected>
  );
}
