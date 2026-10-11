"use client";
import { useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useApiResource } from "@/hooks/use-api-resource";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { LoadingState, StatePanel } from "@/components/ui/state-panel";

export default function DailyPage() {
  const load = useCallback(
    () => api.getDailyHistory(30, Boolean(getToken())),
    [],
  );
  const state = useApiResource(load);
  const signedIn = Boolean(getToken());
  return (
    <PageShell>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold">Past daily problems</h1>
          <p className="mt-2 text-sm text-text-secondary">
            The last 30 days, newest first. Days and streaks use UTC.
          </p>
        </header>
        {signedIn && state.data?.streak && (
          <p className="font-semibold">
            {state.data.streak.current}-day streak · best{" "}
            {state.data.streak.best}
          </p>
        )}
        {state.loading ? (
          <LoadingState label="Loading daily history" />
        ) : state.error || state.missing ? (
          <StatePanel
            tone="error"
            title="Daily history unavailable"
            description={state.error ?? "Daily history could not be found."}
            action={<Button onClick={state.reload}>Retry daily history</Button>}
          />
        ) : !state.data?.days.length ? (
          <StatePanel
            title="No daily problems yet"
            description="Check back for the next daily problem."
            action={
              <Link href="/problems" className="text-primary underline">
                Browse problems
              </Link>
            }
          />
        ) : (
          <ol className="divide-y divide-border rounded-2xl border border-border bg-surface/70 px-4">
            {state.data.days.map((day) => (
              <li
                key={day.date}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div className="min-w-0">
                  <p className="text-xs text-text-secondary">{day.date}</p>
                  <Link
                    className="mt-1 block break-words font-semibold text-primary underline"
                    href={`/problems/${day.problem.id}`}
                  >
                    {day.problem.title}
                  </Link>
                  <p className="mt-1 text-xs capitalize text-text-secondary">
                    {day.problem.difficulty}
                  </p>
                </div>
                {signedIn &&
                  (day.solvedOnDay ? (
                    <span className="text-sm text-accent">
                      Solved on the day
                    </span>
                  ) : day.solved ? (
                    <span className="text-sm text-text-secondary">
                      Solved another day
                    </span>
                  ) : (
                    <span className="text-sm text-text-secondary">
                      Not solved
                    </span>
                  ))}
              </li>
            ))}
          </ol>
        )}
      </div>
    </PageShell>
  );
}
