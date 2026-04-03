"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageShell>
      <div className="flex min-h-[45vh] flex-col items-center justify-center gap-4 px-2 text-center sm:px-0">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard error</h1>
        <p className="max-w-md text-sm text-text-secondary">{error.message}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button type="button" className="min-h-11 touch-manipulation" onClick={() => reset()}>
            Try again
          </Button>
          <Link href="/problems" className="text-sm font-medium text-primary hover:underline">
            Go to problems
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
