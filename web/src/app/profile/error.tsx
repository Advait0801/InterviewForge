"use client";

import { RouteError } from "@/components/ui/route-error";

export default function ProfileError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} title="Profile error" returnHref="/leaderboard" returnLabel="Back to leaderboard" />;
}
