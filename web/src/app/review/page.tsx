"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { api, type ReviewItem } from "@/lib/api";
import { useApiResource } from "@/hooks/use-api-resource";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Button, buttonStyles } from "@/components/ui/button";
import { LoadingState, StatePanel } from "@/components/ui/state-panel";

const sources: Record<ReviewItem["source"], string> = {
  failed: "You failed it",
  struggled: "You solved it with difficulty",
  manual: "Added by you",
  backfill: "From your history",
};
export default function ReviewPage() {
  return (
    <Protected>
      <ReviewContent />
    </Protected>
  );
}
function ReviewContent() {
  const load = useCallback(() => api.getReviewQueue(), []);
  const state = useApiResource(load);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<{
    id: string;
    message: string;
  } | null>(null);
  const remove = async (item: ReviewItem) => {
    if (!window.confirm(`Remove ${item.title} from your review queue?`)) return;
    setRemoving(item.problemId);
    setRemoveError(null);
    try {
      await api.removeFromReview(item.problemId);
      window.dispatchEvent(new Event("if-review-changed"));
      await state.reload();
    } catch (error) {
      setRemoveError({
        id: item.problemId,
        message:
          error instanceof Error ? error.message : "Removal failed. Try again.",
      });
    } finally {
      setRemoving(null);
    }
  };
  return (
    <PageShell>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold">Your review queue</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Revisit problems over time to make what you learned stick.
          </p>
        </header>
        {state.loading ? (
          <LoadingState label="Loading review queue" />
        ) : state.error || state.missing ? (
          <StatePanel
            tone="error"
            title="Review queue unavailable"
            description={state.error ?? "Your review queue could not be found."}
            action={<Button onClick={state.reload}>Retry review queue</Button>}
          />
        ) : (
          state.data && (
            <>
              {!state.data.counts.total && (
                <StatePanel
                  title="Nothing to review yet — problems you struggle with appear here."
                  action={
                    <Link href="/problems" className="text-primary underline">
                      Browse problems
                    </Link>
                  }
                />
              )}
              {[
                {
                  title: `Due now (${state.data.counts.due})`,
                  items: state.data.due,
                },
                { title: "Coming up", items: state.data.upcoming },
              ].map((group) => (
                <section
                  key={group.title}
                  className="space-y-3"
                  aria-label={group.title}
                >
                  <h2 className="text-xl font-semibold">{group.title}</h2>
                  {!group.items.length ? (
                    <p className="text-sm text-text-secondary">
                      {group.title === "Coming up"
                        ? "No upcoming reviews."
                        : "You're caught up for today."}
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {group.items.map((item) => (
                        <li
                          key={item.problemId}
                          className="rounded-2xl border border-border bg-surface/70 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="break-words font-semibold">
                                {item.title}
                              </h3>
                              <p className="mt-1 text-xs text-text-secondary">
                                <span className="capitalize">
                                  {item.difficulty}
                                </span>{" "}
                                · {sources[item.source]} · Due {item.dueOn}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Link
                                href={`/problems/${item.problemId}`}
                                className={buttonStyles({ size: "sm" })}
                              >
                                Practise
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={Boolean(removing)}
                                loading={removing === item.problemId}
                                onClick={() => void remove(item)}
                              >
                                Remove
                                <span className="sr-only"> {item.title}</span>
                              </Button>
                            </div>
                          </div>
                          {removeError?.id === item.problemId && (
                            <p role="alert" className="mt-2 text-sm text-error">
                              {removeError.message}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </>
          )
        )}
      </div>
    </PageShell>
  );
}
