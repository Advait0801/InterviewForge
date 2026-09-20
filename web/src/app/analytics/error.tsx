"use client";

import { RouteError } from "@/components/ui/route-error";

export default function AnalyticsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} title="Analytics error" returnHref="/dashboard" returnLabel="Back to dashboard" />;
}
