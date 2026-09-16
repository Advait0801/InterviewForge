"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { api, Problem } from "@/lib/api";

type DifficultyFilter = "all" | "easy" | "medium" | "hard";
type SolvedFilter = "all" | "solved" | "unsolved";

const difficultyAccent: Record<string, string> = {
  easy: "border-l-accent",
  medium: "border-l-warning",
  hard: "border-l-error",
};

const selectClass =
  "min-h-11 w-full rounded-xl border border-border bg-background/80 px-3.5 py-2.5 text-sm text-text-primary outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-2 focus:ring-primary/20";

function ProblemListSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading problem catalogue">
      <span className="sr-only">Loading problem catalogue…</span>
      {[0, 1, 2, 3, 4].map((index) => (
        <div key={index} className="animate-pulse rounded-2xl border border-border bg-surface/60 p-4 sm:p-5" aria-hidden>
          <div className="mb-3 h-5 w-2/3 rounded bg-border" />
          <div className="mb-2 h-3 w-full rounded bg-border/80" />
          <div className="h-3 w-4/5 rounded bg-border/80" />
        </div>
      ))}
    </div>
  );
}

function ProblemRow({
  problem,
  selectedCompany,
  saving,
  onToggleBookmark,
}: {
  problem: Problem;
  selectedCompany: string;
  saving: boolean;
  onToggleBookmark: (problem: Problem) => void;
}) {
  return (
    <article
      className={`group rounded-2xl border border-l-4 border-border bg-surface/80 p-4 backdrop-blur-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-border-hover hover:shadow-lg hover:shadow-glow-primary sm:p-5 ${difficultyAccent[problem.difficulty] ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <Link
          href={`/problems/${encodeURIComponent(problem.id)}`}
          className="min-w-0 flex-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-surface"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 break-words text-base font-semibold text-text-primary transition-colors group-hover:text-primary sm:text-lg">
              {problem.title}
            </h2>
            {problem.is_solved ? (
              <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
                Solved
              </span>
            ) : null}
            <Badge tone={problem.difficulty === "easy" ? "success" : problem.difficulty === "medium" ? "warning" : "danger"}>
              {problem.difficulty}
            </Badge>
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-text-secondary">{problem.description}</p>
          {(problem.topics ?? []).length > 0 || (problem.companies ?? []).length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Problem tags">
              {(problem.topics ?? []).slice(0, 3).map((item) => (
                <span key={item} className="rounded-full border border-border bg-background/70 px-2 py-0.5 text-[11px] text-text-secondary">
                  {item}
                </span>
              ))}
              {(problem.companies ?? []).slice(0, 3).map((item) => (
                <span
                  key={`company-${item}`}
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${
                    item === selectedCompany
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-primary/20 bg-primary/5 text-text-secondary"
                  }`}
                >
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </Link>

        <button
          type="button"
          aria-label={problem.is_bookmarked ? `Remove ${problem.title} from saved problems` : `Save ${problem.title}`}
          aria-pressed={Boolean(problem.is_bookmarked)}
          onClick={() => onToggleBookmark(problem)}
          disabled={saving}
          className={`flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-xl border transition-[background-color,border-color,color,transform] active:scale-95 disabled:cursor-wait disabled:opacity-60 ${
            problem.is_bookmarked
              ? "border-warning/35 bg-warning/10 text-warning"
              : "border-border bg-background/70 text-text-secondary hover:border-warning/35 hover:text-warning"
          }`}
        >
          {saving ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill={problem.is_bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          )}
        </button>
      </div>
    </article>
  );
}

export default function ProblemsPage() {
  const reduceMotion = useReducedMotion();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");
  const [topic, setTopic] = useState("all");
  const [company, setCompany] = useState("all");
  const [solvedFilter, setSolvedFilter] = useState<SolvedFilter>("all");
  const [savedOnly, setSavedOnly] = useState(false);
  const [savingBookmarkIds, setSavingBookmarkIds] = useState<Set<string>>(() => new Set());
  const [bookmarkAnnouncement, setBookmarkAnnouncement] = useState("");

  const loadProblems = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await api.listProblems({ auth: true });
      setProblems(response.problems);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load problems");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProblems();
  }, [loadProblems]);

  const topics = useMemo(() => {
    const values = new Set<string>();
    for (const problem of problems) for (const item of problem.topics ?? []) values.add(item);
    return Array.from(values).sort((left, right) => left.localeCompare(right));
  }, [problems]);

  const companies = useMemo(() => {
    const counts = new Map<string, number>();
    for (const problem of problems) {
      for (const item of problem.companies ?? []) counts.set(item, (counts.get(item) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  }, [problems]);

  const filtered = useMemo(() => {
    const difficultyOrder: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
    const normalizedQuery = query.trim().toLowerCase();
    return problems
      .filter((problem) => {
        const matchesDifficulty = difficulty === "all" || problem.difficulty === difficulty;
        const matchesTopic = topic === "all" || (problem.topics ?? []).includes(topic);
        const matchesCompany = company === "all" || (problem.companies ?? []).includes(company);
        const solved = Boolean(problem.is_solved);
        const matchesSolved = solvedFilter === "all" || (solvedFilter === "solved" ? solved : !solved);
        const matchesSaved = !savedOnly || Boolean(problem.is_bookmarked);
        const matchesQuery =
          !normalizedQuery ||
          problem.title.toLowerCase().includes(normalizedQuery) ||
          problem.description.toLowerCase().includes(normalizedQuery);
        return matchesDifficulty && matchesTopic && matchesCompany && matchesSolved && matchesSaved && matchesQuery;
      })
      .sort((left, right) => (difficultyOrder[left.difficulty] ?? 9) - (difficultyOrder[right.difficulty] ?? 9));
  }, [company, difficulty, problems, query, savedOnly, solvedFilter, topic]);

  const solvedCount = useMemo(() => problems.filter((problem) => problem.is_solved).length, [problems]);
  const savedCount = useMemo(() => problems.filter((problem) => problem.is_bookmarked).length, [problems]);
  const hasActiveFilters = Boolean(query.trim()) || difficulty !== "all" || topic !== "all" || company !== "all" || solvedFilter !== "all" || savedOnly;

  const clearFilters = () => {
    setQuery("");
    setDifficulty("all");
    setTopic("all");
    setCompany("all");
    setSolvedFilter("all");
    setSavedOnly(false);
  };

  const toggleBookmark = async (problem: Problem) => {
    if (savingBookmarkIds.has(problem.id)) return;
    setSavingBookmarkIds((current) => new Set(current).add(problem.id));
    const wasBookmarked = Boolean(problem.is_bookmarked);
    try {
      if (wasBookmarked) await api.removeBookmark(problem.id);
      else await api.addBookmark(problem.id);
      setProblems((current) => current.map((item) => (item.id === problem.id ? { ...item, is_bookmarked: !wasBookmarked } : item)));
      const message = wasBookmarked ? `${problem.title} removed from saved problems` : `${problem.title} saved`;
      setBookmarkAnnouncement(message);
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update bookmark");
    } finally {
      setSavingBookmarkIds((current) => {
        const next = new Set(current);
        next.delete(problem.id);
        return next;
      });
    }
  };

  return (
    <Protected>
      <PageShell>
        <div className="space-y-6">
          <motion.header
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-border bg-surface/75 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-7"
          >
            <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary/12 blur-3xl" aria-hidden />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Practice catalogue</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Find your next problem</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary sm:text-base">
                Search 150 curated challenges, narrow by skill or interview signal, and save the right next step.
              </p>
            </div>
            <Link href="/paths" className={buttonStyles({ variant: "secondary", className: "relative min-h-11 shrink-0 touch-manipulation" })}>
              Explore learning paths
            </Link>
          </motion.header>

          {!loading && !loadError ? (
            <section className="grid grid-cols-3 gap-2 sm:max-w-xl sm:gap-3" aria-label="Catalogue summary">
              {[
                [problems.length, "Available"],
                [solvedCount, "Solved"],
                [savedCount, "Saved"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-border bg-surface/70 px-3 py-3 sm:px-4">
                  <p className="text-xl font-bold text-text-primary sm:text-2xl">{value}</p>
                  <p className="text-[11px] text-text-secondary sm:text-xs">{label}</p>
                </div>
              ))}
            </section>
          ) : null}

          {!loading && !loadError && problems.length > 0 ? (
          <section className="rounded-2xl border border-border bg-surface/70 p-4 sm:p-5" aria-labelledby="catalogue-filters-title">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 id="catalogue-filters-title" className="font-semibold text-text-primary">Refine the catalogue</h2>
                <p className="mt-1 text-xs text-text-secondary">Every filter combines with the others.</p>
              </div>
              {hasActiveFilters ? (
                <Button type="button" variant="ghost" size="sm" className="min-h-10 touch-manipulation" onClick={clearFilters}>
                  Clear all filters
                </Button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.4fr)_repeat(3,minmax(150px,1fr))]">
              <Input
                label="Search problems"
                type="search"
                placeholder="Title or description"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <label className="block text-sm font-medium text-text-primary">
                Status
                <select value={solvedFilter} onChange={(event) => setSolvedFilter(event.target.value as SolvedFilter)} className={`mt-1.5 ${selectClass}`}>
                  <option value="all">All statuses</option>
                  <option value="solved">Solved</option>
                  <option value="unsolved">Not solved yet</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-text-primary">
                Topic
                <select value={topic} onChange={(event) => setTopic(event.target.value)} className={`mt-1.5 ${selectClass}`}>
                  <option value="all">All topics</option>
                  {topics.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-text-primary">
                Company tag
                <select value={company} onChange={(event) => setCompany(event.target.value)} className={`mt-1.5 ${selectClass}`}>
                  <option value="all">All companies</option>
                  {companies.map(([name, count]) => <option key={name} value={name}>{name} ({count})</option>)}
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4 lg:flex-row lg:items-end lg:justify-between">
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-text-primary">Difficulty</legend>
                <div className="flex flex-wrap gap-2">
                  {(["all", "easy", "medium", "hard"] as const).map((item) => {
                    const selected = difficulty === item;
                    const selectedClass = item === "easy"
                      ? "border-accent bg-accent/10 text-accent"
                      : item === "medium"
                        ? "border-warning bg-warning/10 text-warning"
                        : item === "hard"
                          ? "border-error bg-error/10 text-error"
                          : "border-primary bg-primary/10 text-primary";
                    return (
                      <button
                        key={item}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setDifficulty(item)}
                        className={`min-h-10 touch-manipulation rounded-full border px-4 py-2 text-sm font-medium transition-colors ${selected ? selectedClass : "border-border bg-background/60 text-text-secondary hover:border-border-hover hover:text-text-primary"}`}
                      >
                        {item === "all" ? "Any difficulty" : item.charAt(0).toUpperCase() + item.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <div>
                <button
                  type="button"
                  aria-pressed={savedOnly}
                  onClick={() => setSavedOnly((current) => !current)}
                  className={`min-h-10 touch-manipulation rounded-full border px-4 py-2 text-sm font-medium transition-colors ${savedOnly ? "border-warning bg-warning/10 text-warning" : "border-border bg-background/60 text-text-secondary hover:border-warning/35 hover:text-warning"}`}
                >
                  {savedOnly ? "Showing saved problems" : "Saved problems only"}
                </button>
                <p className="mt-2 max-w-md text-xs leading-relaxed text-text-secondary">
                  Company tags are approximate and reflect commonly reported interview questions.
                </p>
              </div>
            </div>
          </section>
          ) : null}

          <div className="sr-only" role="status" aria-live="polite">{bookmarkAnnouncement}</div>

          {loading ? <ProblemListSkeleton /> : loadError ? (
            <section className="rounded-2xl border border-error/30 bg-error/5 p-6 text-center" role="alert">
              <h2 className="text-lg font-semibold text-text-primary">Problem catalogue is unavailable</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-text-secondary">{loadError}</p>
              <Button type="button" className="mt-4 min-h-11 touch-manipulation" onClick={() => void loadProblems()}>
                Retry catalogue
              </Button>
            </section>
          ) : problems.length === 0 ? (
            <section className="rounded-2xl border border-dashed border-border p-8 text-center">
              <h2 className="text-lg font-semibold text-text-primary">No problems are available yet</h2>
              <p className="mt-2 text-sm text-text-secondary">The catalogue will appear here when challenges are published.</p>
            </section>
          ) : (
            <section aria-labelledby="problem-results-title">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 id="problem-results-title" className="text-lg font-semibold text-text-primary">Problems</h2>
                  <p className="text-sm text-text-secondary" role="status" aria-label="Problem result count" aria-live="polite">
                    Showing <span className="font-semibold text-text-primary">{filtered.length}</span> of {problems.length}
                    {hasActiveFilters ? " matching problems" : " problems"}
                  </p>
                </div>
                {filtered.length > 0 ? <p className="text-xs text-text-secondary">Sorted easy to hard</p> : null}
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                  <h3 className="font-semibold text-text-primary">No problems match these filters</h3>
                  <p className="mt-2 text-sm text-text-secondary">Broaden the search or reset the catalogue.</p>
                  <Button type="button" variant="secondary" className="mt-4 min-h-11 touch-manipulation" onClick={clearFilters}>
                    Clear all filters
                  </Button>
                </div>
              ) : (
                <ul className="space-y-3" role="list">
                  {filtered.map((problem, index) => (
                    <motion.li
                      key={problem.id}
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: reduceMotion ? 0 : Math.min(index, 6) * 0.02 }}
                    >
                      <ProblemRow
                        problem={problem}
                        selectedCompany={company}
                        saving={savingBookmarkIds.has(problem.id)}
                        onToggleBookmark={(item) => void toggleBookmark(item)}
                      />
                    </motion.li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </PageShell>
    </Protected>
  );
}
