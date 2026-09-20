"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";

export function RouteError({ error, reset, title, returnHref, returnLabel }: {
  error: Error & { digest?: string };
  reset: () => void;
  title: string;
  returnHref: string;
  returnLabel: string;
}) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <PageShell>
      <div className="flex min-h-[45vh] flex-col items-center justify-center gap-4 text-center" role="alert">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="max-w-md text-sm text-text-secondary">This page hit an unexpected error. Your saved work has not been changed.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button type="button" onClick={reset}>Try again</Button>
          <Link href={returnHref} className="text-sm font-semibold text-primary hover:underline">{returnLabel}</Link>
        </div>
      </div>
    </PageShell>
  );
}
