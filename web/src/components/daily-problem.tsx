"use client";
import { useCallback } from "react";
import Link from "next/link";
import { api, type DailyProblem } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useApiResource } from "@/hooks/use-api-resource";
import { LoadingState, StatePanel } from "@/components/ui/state-panel";
import { Button, buttonStyles } from "@/components/ui/button";

export function DailyProblemCard({
  day,
  signedIn,
}: {
  day: DailyProblem;
  signedIn: boolean;
}) {
  return (
    <section
      aria-labelledby="daily-heading"
      className="space-y-3 rounded-2xl border border-primary/30 bg-surface/75 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="daily-heading" className="text-lg font-semibold">
          Problem of the Day
        </h2>
        <span className="text-xs text-text-secondary">{day.date} · UTC</span>
      </div>
      <p className="break-words text-xl font-bold">{day.problem.title}</p>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-border px-2 py-1 capitalize">
          {day.problem.difficulty}
        </span>
        {day.problem.topics.map((topic) => (
          <span
            className="rounded-full border border-border px-2 py-1 text-text-secondary"
            key={topic}
          >
            {topic}
          </span>
        ))}
        {signedIn && day.solvedOnDay && (
          <span className="font-semibold text-accent">Solved today</span>
        )}
      </div>
      {signedIn && day.streak && (
        <p className="text-sm text-text-secondary">
          {day.streak.current}-day streak · best {day.streak.best}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href={`/problems/${day.problem.id}`}
          className={buttonStyles({ size: "sm" })}
        >
          Solve
        </Link>
        <Link
          href="/daily"
          className="text-sm font-medium text-primary underline"
        >
          Past days
        </Link>
      </div>
    </section>
  );
}
export function DailyProblemWidget() {
  const load = useCallback(
    () => api.getDailyProblem(undefined, Boolean(getToken())),
    [],
  );
  const state = useApiResource(load);
  if (state.loading)
    return (
      <LoadingState label="Loading today's problem" className="min-h-28" />
    );
  if (state.error || state.missing)
    return (
      <StatePanel
        tone="error"
        title="Daily problem unavailable"
        description={state.error ?? "No daily problem is available for today."}
        action={
          <Button size="sm" onClick={state.reload}>
            Retry daily problem
          </Button>
        }
      />
    );
  return (
    state.data && (
      <DailyProblemCard day={state.data} signedIn={Boolean(getToken())} />
    )
  );
}
