"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { api, Submission } from "@/lib/api";

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "passed" | "failed">("all");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getSubmissions({ limit: 200 });
      setSubmissions(res.submissions);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load submission history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const languages = useMemo(() => {
    return ["all", ...Array.from(new Set(submissions.map((s) => s.language))).sort()];
  }, [submissions]);

  const filtered = useMemo(() => {
    return submissions.filter((s) => {
      const statusMatch = statusFilter === "all" || s.status === statusFilter;
      const languageMatch = languageFilter === "all" || s.language === languageFilter;
      return statusMatch && languageMatch;
    });
  }, [submissions, statusFilter, languageFilter]);

  return (
    <Protected>
      <PageShell>
        <div className="space-y-5">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Submission History</h1>
            <p className="mt-1 text-sm text-text-secondary">Review all past submissions by status, runtime, and language.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["all", "passed", "failed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
                  statusFilter === s
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-text-secondary hover:text-text-primary"
                }`}
                type="button"
              >
                {s === "all" ? "All Statuses" : s === "passed" ? "Accepted" : "Failed"}
              </button>
            ))}
            {languages.map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguageFilter(lang)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
                  languageFilter === lang
                    ? "border-secondary bg-secondary/10 text-secondary"
                    : "border-border text-text-secondary hover:text-text-primary"
                }`}
                type="button"
              >
                {lang === "all" ? "All Languages" : lang}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-text-secondary">Loading submissions...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-text-secondary">No submissions found for current filters.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((s) => (
                <Link key={s.id} href={`/problems/${s.problem_id}`} className="block">
                  <div
                    className={`rounded-xl border p-4 transition hover:border-border-hover ${
                      s.status === "passed" ? "border-accent/30 bg-accent/5" : "border-error/30 bg-error/5"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{s.problem_title}</p>
                      <span className={`text-xs font-semibold ${s.status === "passed" ? "text-accent" : "text-error"}`}>
                        {s.status === "passed" ? "Accepted" : "Failed"}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-text-secondary">
                      <span>{s.language}</span>
                      <span>{s.runtime_ms != null ? `${s.runtime_ms}ms` : "runtime -"} </span>
                      <span>{s.memory_kb != null ? `${s.memory_kb}KB` : "memory -"}</span>
                      <span>{new Date(s.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </PageShell>
    </Protected>
  );
}
