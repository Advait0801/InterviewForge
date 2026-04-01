"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { PageShell } from "@/components/layout/page-shell";
import { ActivityHeatmap } from "@/components/ui/activity-heatmap";
import { Avatar } from "@/components/ui/avatar";
import { api, PublicProfile } from "@/lib/api";

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [data, setData] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;
    api
      .getPublicProfile(username)
      .then((res) => setData(res))
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load profile");
      })
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <PageShell>
        <p className="text-sm text-text-secondary">Loading profile...</p>
      </PageShell>
    );
  }

  if (!data) {
    return (
      <PageShell>
        <p className="text-sm text-text-secondary">Profile not found.</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar src={data.profile.avatar_url} name={data.profile.name ?? data.profile.username} size="lg" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{data.profile.name || data.profile.username}</h1>
            <p className="mt-1 text-sm text-text-secondary">@{data.profile.username}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Solved" value={data.stats.problemsSolved} />
          <Stat label="Attempted" value={data.stats.problemsAttempted} />
          <Stat label="Acceptance" value={`${data.stats.acceptanceRate}%`} />
          <Stat label="Interviews" value={data.stats.interviewsStarted} />
        </div>

        {/* Activity heatmap */}
        <div className="rounded-xl border border-border bg-surface/50 p-4">
          <h2 className="mb-3 text-lg font-semibold">Activity</h2>
          <ActivityHeatmap activityMap={data.activityMap ?? {}} />
        </div>

        <div className="rounded-xl border border-border bg-surface/50 p-4">
          <h2 className="mb-3 text-lg font-semibold">Recent Activity</h2>
          {data.recentActivity.length === 0 ? (
            <p className="text-sm text-text-secondary">No recent activity.</p>
          ) : (
            <div className="space-y-2">
              {data.recentActivity.map((item, idx) => (
                <div key={`${item.created_at}-${idx}`} className="rounded-lg border border-border bg-background/60 p-3">
                  <p className="text-sm">
                    <span className="font-medium">{item.type === "submission" ? "Submission" : "Interview"}:</span>{" "}
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {item.status ?? "n/a"} · {new Date(item.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface/50 p-4">
      <p className="text-xs uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
