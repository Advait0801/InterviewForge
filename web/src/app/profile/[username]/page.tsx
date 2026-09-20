"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { ActivityHeatmap } from "@/components/ui/activity-heatmap";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LoadingState, StatePanel } from "@/components/ui/state-panel";
import { api, PublicProfile } from "@/lib/api";

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [data, setData] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const requestId = useRef(0);

  const fetchProfile = useCallback(async () => {
    if (!username) return;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    setMissing(false);
    try {
      const result = await api.getPublicProfile(username);
      if (currentRequest === requestId.current) setData(result);
    } catch (err) {
      if (currentRequest !== requestId.current) return;
      const message = err instanceof Error ? err.message : "Could not load profile";
      if (message === "User not found") setMissing(true);
      else setError(message);
      setData(null);
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    fetchProfile();
    return () => { requestId.current += 1; };
  }, [fetchProfile]);

  if (loading) {
    return (
      <PageShell>
        <LoadingState label="Loading profile" />
      </PageShell>
    );
  }

  if (!data) {
    return (
      <PageShell>
        <StatePanel
          tone={error ? "error" : "neutral"}
          title={missing ? "Profile not found" : "Profile unavailable"}
          description={missing ? `There is no public profile for @${username}.` : error ?? "This profile could not be loaded."}
          action={missing ? <Link href="/leaderboard" className="text-sm font-semibold text-primary hover:underline">Back to leaderboard</Link> : <Button variant="ghost" onClick={fetchProfile}>Retry profile</Button>}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="flex min-w-0 items-center gap-4 border-b border-border pb-6">
          <Avatar src={data.profile.avatar_url} name={data.profile.name ?? data.profile.username} size="lg" />
          <div className="min-w-0">
            <h1 className="break-words text-3xl font-bold">{data.profile.name || data.profile.username}</h1>
            <p className="mt-1 break-all text-sm text-text-secondary">@{data.profile.username}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-b border-border pb-6 lg:grid-cols-4">
          <Stat label="Solved" value={data.stats.problemsSolved} />
          <Stat label="Attempted" value={data.stats.problemsAttempted} />
          <Stat label="Acceptance" value={`${data.stats.acceptanceRate}%`} />
          <Stat label="Interviews" value={data.stats.interviewsStarted} />
        </div>

        {/* Activity heatmap */}
        <section className="border-b border-border pb-6">
          <h2 className="mb-3 text-lg font-semibold">Activity</h2>
          <ActivityHeatmap activityMap={data.activityMap ?? {}} />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Recent activity</h2>
          {data.recentActivity.length === 0 ? (
            <p className="text-sm text-text-secondary">No recent activity.</p>
          ) : (
            <ol className="divide-y divide-border">
              {data.recentActivity.map((item, idx) => (
                <li key={`${item.created_at}-${idx}`} className="py-3">
                  <p className="text-sm">
                    <span className="font-medium">{item.type === "submission" ? "Submission" : "Interview"}:</span>{" "}
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {item.status ?? "n/a"} · {new Date(item.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 py-2">
      <p className="text-xs uppercase text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
