"use client";
import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useApiResource } from "@/hooks/use-api-resource";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { LoadingState, StatePanel } from "@/components/ui/state-panel";
import { ReplayTimeline } from "@/components/interview/replay-timeline";
import { ShareLinks } from "@/components/interview/share-links";

export default function InterviewReplayPage() {
  return (
    <Protected>
      <ReplayContent />
    </Protected>
  );
}
function ReplayContent() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => api.getInterviewReplay(id), [id]);
  const loadSessions = useCallback(() => api.listInterviews(), []);
  const state = useApiResource(load);
  const history = useApiResource(loadSessions);
  const [generating, setGenerating] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const session = history.data?.sessions.find((session) => session.id === id);
  return (
    <PageShell>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Link className="text-sm text-primary underline" href="/interview">
          ← Past interviews
        </Link>
        {state.loading ? (
          <LoadingState label="Loading interview replay" />
        ) : state.missing ? (
          <StatePanel
            title="Interview not found"
            description="This interview is no longer available."
            action={
              <Link href="/interview" className="text-primary underline">
                Back to interviews
              </Link>
            }
          />
        ) : state.error ? (
          <StatePanel
            tone="error"
            title="Replay unavailable"
            description={state.error}
            action={<Button onClick={state.reload}>Retry replay</Button>}
          />
        ) : (
          state.data && (
            <>
              <header className="space-y-2">
                <h1 className="text-3xl font-bold capitalize">
                  {state.data.company} interview replay
                </h1>
                <p className="text-sm text-text-secondary">
                  {state.data.date} · {state.data.persona} · {state.data.mode} ·{" "}
                  {state.data.status}
                </p>
              </header>
              <ReplayTimeline key={id} replay={state.data} />
              {state.data.status === "completed" && !state.data.report && (
                <div className="space-y-2">
                  <Button
                    loading={generating}
                    onClick={async () => {
                      setGenerating(true);
                      setReportError(null);
                      try {
                        await api.getInterviewReport(id);
                        await state.reload();
                      } catch (error) {
                        setReportError(
                          error instanceof Error
                            ? error.message
                            : "Could not generate the report. Try again.",
                        );
                      } finally {
                        setGenerating(false);
                      }
                    }}
                  >
                    Generate report
                  </Button>
                  {reportError && (
                    <p role="alert" className="text-sm text-error">
                      {reportError}
                    </p>
                  )}
                </div>
              )}
              {state.data.status === "completed" &&
                (history.loading ? (
                  <LoadingState label="Loading sharing details" />
                ) : history.error || !session ? (
                  <StatePanel
                    tone="error"
                    title="Sharing details unavailable"
                    description={
                      history.error ??
                      "Session details could not be found. Reload before sharing."
                    }
                    action={
                      <Button onClick={history.reload}>
                        Retry sharing details
                      </Button>
                    }
                  />
                ) : (
                  <ShareLinks
                    id={id}
                    resumeGrounded={session.resume_grounded}
                  />
                ))}
            </>
          )
        )}
      </div>
    </PageShell>
  );
}
