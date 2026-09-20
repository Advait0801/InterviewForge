"use client";

import { RouteError } from "@/components/ui/route-error";

export default function AssessmentsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} title="Assessments error" returnHref="/problems" returnLabel="Browse problems" />;
}
