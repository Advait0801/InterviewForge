"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api, Problem } from "@/lib/api";

export default function ProblemsPage() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<"all" | "easy" | "medium" | "hard">("all");

  useEffect(() => {
    api.listProblems().then((res) => setProblems(res.problems)).catch(() => setProblems([]));
  }, []);

  const filtered = useMemo(
    () =>
      problems.filter((p) => {
        const matchDiff = difficulty === "all" || p.difficulty === difficulty;
        const q = query.trim().toLowerCase();
        const matchQuery = !q || p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
        return matchDiff && matchQuery;
      }),
    [problems, query, difficulty],
  );

  return (
    <Protected>
      <PageShell>
        <h1 className="mb-4 text-3xl font-semibold">Problems</h1>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Input className="max-w-sm" placeholder="Search problems..." value={query} onChange={(e) => setQuery(e.target.value)} />
          {(["all", "easy", "medium", "hard"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`rounded-full border px-3 py-1 text-sm ${difficulty === d ? "border-primary text-primary" : "border-border text-text-secondary"}`}
              type="button"
            >
              {d}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {filtered.map((p) => (
            <Link href={`/problems/${p.id}`} key={p.id}>
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
          ))}
        </div>
      </PageShell>
    </Protected>
  );
}
