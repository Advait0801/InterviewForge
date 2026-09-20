"use client";

import { RouteError } from "@/components/ui/route-error";

export default function LeaderboardError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} title="Leaderboard error" returnHref="/problems" returnLabel="Browse problems" />;
}
