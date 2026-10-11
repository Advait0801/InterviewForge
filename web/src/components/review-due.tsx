"use client";
import { useCallback, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useApiResource } from "@/hooks/use-api-resource";
import { Button } from "@/components/ui/button";

export function ReviewDue() {
  const load = useCallback(() => api.getReviewQueue(), []);
  const state = useApiResource(load);
  const { reload } = state;
  useEffect(() => {
    const refresh = () => {
      void reload();
    };
    window.addEventListener("if-review-changed", refresh);
    return () => window.removeEventListener("if-review-changed", refresh);
  }, [reload]);
  return (
    <div className="rounded-2xl border border-border bg-surface/75 p-5 text-sm">
      {state.loading ? (
        <p role="status">Loading reviews…</p>
      ) : state.error || state.missing ? (
        <>
          <p role="alert">{state.error ?? "Review queue unavailable."}</p>
          <Button variant="ghost" size="sm" onClick={state.reload}>
            Retry review count
          </Button>
        </>
      ) : (
        <Link href="/review" className="font-semibold text-primary underline">
          {state.data?.counts.due} reviews due
        </Link>
      )}
    </div>
  );
}
