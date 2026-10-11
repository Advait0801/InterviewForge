"use client";
import { useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useApiResource } from "@/hooks/use-api-resource";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LoadingState, StatePanel } from "@/components/ui/state-panel";
import { ReplayTimeline } from "@/components/interview/replay-timeline";

export default function PublicInterviewPage() {
  const { token } = useParams<{ token: string }>();
  const load = useCallback(() => api.getPublicInterview(token), [token]);
  const state = useApiResource(load);
  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-text-primary sm:px-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-semibold">InterviewForge · Shared interview</h1>
          <ThemeToggle />
        </div>
        {state.loading ? (
          <LoadingState label="Loading shared interview" />
        ) : state.missing ? (
          <StatePanel
            title="This link doesn't exist or is no longer shared."
            description="It may have expired or been revoked. Ask the person who shared it for a new link."
          />
        ) : state.error ? (
          <StatePanel
            tone="error"
            title="Shared interview unavailable"
            description={state.error}
            action={
              <Button onClick={state.reload}>Retry shared interview</Button>
            }
          />
        ) : (
          state.data && (
            <>
              <header className="space-y-2">
                <h2 className="break-words text-3xl font-bold capitalize">
                  {state.data.company} interview
                </h2>
                {state.data.candidate && (
                  <p className="break-words text-lg">{state.data.candidate}</p>
                )}
                <p className="text-sm text-text-secondary">
                  {state.data.date} · {state.data.persona} · {state.data.mode}
                </p>
              </header>
              <ReplayTimeline key={token} replay={state.data} />
            </>
          )
        )}
      </div>
    </main>
  );
}
