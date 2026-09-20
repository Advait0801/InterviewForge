"use client";

import { RouteError } from "@/components/ui/route-error";

export default function SettingsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} title="Settings error" returnHref="/dashboard" returnLabel="Back to dashboard" />;
}
