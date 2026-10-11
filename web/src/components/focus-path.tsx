"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  type FocusTopic,
  type LearningPathDetailResponse,
} from "@/lib/api";
import { Button } from "@/components/ui/button";

export function GenerateFocusPath({
  rebuild = false,
  onGenerated,
}: {
  rebuild?: boolean;
  onGenerated?: (path: LearningPathDetailResponse) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        loading={busy}
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const result = await api.generateLearningPath();
            onGenerated?.(result);
            router.push(`/paths/${encodeURIComponent(result.path.slug)}`);
            router.refresh();
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Could not build your focus path. Try again.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {rebuild ? "Rebuild my focus path" : "Build my focus path"}
      </Button>
      {rebuild && (
        <p className="text-xs text-text-secondary">
          Rebuilding replaces your current personal path.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
export function FocusTopics({ topics }: { topics: FocusTopic[] }) {
  return (
    <section
      className="space-y-3 rounded-2xl border border-border bg-surface/70 p-5"
      aria-labelledby="focus-topics-heading"
    >
      <h2 id="focus-topics-heading" className="text-xl font-semibold">
        Built from
      </h2>
      <p className="text-sm text-text-secondary">
        Your submissions, hints and review history highlight these topics.
      </p>
      {topics.length ? (
        <ul className="space-y-3">
          {topics.map((topic) => (
            <li
              key={topic.topic}
              className="flex flex-wrap justify-between gap-2 border-t border-border pt-3 text-sm"
            >
              <span>
                <strong>{topic.topic}</strong> · {topic.failed} of{" "}
                {topic.submissions} submissions failed
              </span>
              <span className="text-text-secondary">
                Score {topic.score.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-secondary">
          No focus-topic breakdown is available.
        </p>
      )}
    </section>
  );
}
