import Link from "next/link";
import type { ReviewOutcome as Outcome } from "@/lib/api";

export function ReviewOutcome({ outcome }: { outcome: Outcome }) {
  if (!outcome) return null;
  const message =
    outcome.action === "enrolled"
      ? `Added to your review queue — due ${outcome.dueOn}`
      : outcome.action === "reviewed"
        ? `Review recorded (${outcome.quality}/5) — next review ${outcome.dueOn}`
        : outcome.action === "lapsed"
          ? "Back in your review queue — due tomorrow"
          : `Already in your review queue — due ${outcome.dueOn}`;
  return (
    <p className="text-sm text-text-secondary">
      {message}.{" "}
      <Link className="font-medium text-primary underline" href="/review">
        View review queue
      </Link>
    </p>
  );
}
