"use client";
import { useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useApiResource } from "@/hooks/use-api-resource";
import { LoadingState, StatePanel } from "@/components/ui/state-panel";
import { Button } from "@/components/ui/button";

export function InterviewHistory() {
  const load = useCallback(() => api.listInterviews(), []);
  const state = useApiResource(load);
  return (
    <section className="space-y-4" aria-labelledby="interview-history-heading">
      <h2 id="interview-history-heading" className="text-xl font-semibold">
        Past interviews
      </h2>
      {state.loading ? (
        <LoadingState label="Loading interview history" />
      ) : state.error || state.missing ? (
        <StatePanel
          tone="error"
          title="Interview history unavailable"
          description={state.error ?? "Interview history could not be found."}
          action={<Button onClick={state.reload}>Retry history</Button>}
        />
      ) : !state.data?.sessions.length ? (
        <p className="text-sm text-text-secondary">
          No past interviews yet. Your sessions will appear here.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface/70 px-4">
          {state.data.sessions.map((session) => (
            <li
              key={session.id}
              className="flex flex-wrap items-center justify-between gap-3 py-4"
            >
              <div className="min-w-0">
                <h3 className="font-semibold capitalize">{session.company}</h3>
                <p className="text-xs text-text-secondary">
                  {new Date(session.created_at).toLocaleDateString()} ·{" "}
                  {session.status} · {session.persona}
                </p>
              </div>
              {session.status === "completed" ? (
                <Link
                  href={`/interview/${session.id}`}
                  className="min-h-9 rounded px-2 py-2 text-sm font-semibold text-primary underline"
                >
                  Replay
                </Link>
              ) : (
                <span className="text-sm text-text-secondary">In progress</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
