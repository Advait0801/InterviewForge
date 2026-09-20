"use client";

import { RouteError } from "@/components/ui/route-error";

export default function SystemDesignError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} title="System design error" returnHref="/dashboard" returnLabel="Back to dashboard" />;
}
