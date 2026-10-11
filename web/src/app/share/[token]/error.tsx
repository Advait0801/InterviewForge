"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-dvh bg-background p-6 text-text-primary">
      <div className="mx-auto max-w-3xl space-y-4" role="alert">
        <h1 className="text-xl font-semibold">Shared interview unavailable</h1>
        <p>Please try loading this shared interview again.</p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
