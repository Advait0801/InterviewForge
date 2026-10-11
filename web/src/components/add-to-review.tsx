"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function AddToReview({ problemId }: { problemId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex max-w-full flex-wrap items-center gap-2 text-xs">
      <Button
        size="sm"
        variant="secondary"
        loading={busy}
        disabled={Boolean(message)}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const result = await api.addToReview(problemId);
            setMessage(result.added ? "Added" : "Already in your queue");
            window.dispatchEvent(new Event("if-review-changed"));
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Could not add to review. Try again.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {message ?? "Add to review"}
      </Button>
      {error && (
        <p className="text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
