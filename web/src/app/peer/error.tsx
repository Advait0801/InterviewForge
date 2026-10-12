"use client";
import { RouteError } from "@/components/ui/route-error";
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="Peer interview page error"
      returnHref="/peer"
      returnLabel="Peer interviews"
    />
  );
}
