"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

// Reveal count resets when the hints change. That is done by remounting via a
// `key` at the call site rather than a setState-in-effect, which is React's
// documented answer to "reset state when a prop changes".
export function ProgressiveHints({
  hints,
  problemId,
}: {
  hints: string[];
  problemId: string;
}) {
  const [revealed, setRevealed] = useState(0);

  if (hints.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        No hints available for this problem yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {hints.slice(0, revealed).map((h, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-surface/60 p-4"
        >
          <p className="mb-1 text-[11px] font-semibold text-text-secondary">
            Hint {i + 1}
          </p>
          <p className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap">
            {h}
          </p>
        </div>
      ))}
      {revealed < hints.length && (
        <button
          type="button"
          onClick={() => {
            const next = revealed + 1;
            setRevealed(next);
            if (getToken())
              void api.recordHintViews(problemId, next).catch(() => {});
          }}
          className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary/20"
        >
          {revealed === 0 ? "Show hint 1" : `Show hint ${revealed + 1}`}
        </button>
      )}
      {revealed === hints.length && hints.length > 1 && (
        <button
          type="button"
          onClick={() => setRevealed(0)}
          className="text-xs font-medium text-text-secondary hover:text-primary"
        >
          Reset hints
        </button>
      )}
    </div>
  );
}
