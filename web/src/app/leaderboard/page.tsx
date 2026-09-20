"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LoadingState, StatePanel } from "@/components/ui/state-panel";
import { api, LeaderboardEntry } from "@/lib/api";

const PAGE_SIZE = 20;

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const requestId = useRef(0);

  const fetchLeaderboard = useCallback(async (requestedPage: number) => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getLeaderboard(requestedPage, PAGE_SIZE);
      if (currentRequest !== requestId.current) return;
      setEntries(res.leaderboard);
      setTotal(res.total);
      setPage(res.page);
    } catch (err) {
      if (currentRequest === requestId.current) setError(err instanceof Error ? err.message : "Could not load rankings");
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard(1);
    api.me().then((res) => setMyUsername(res.user.username)).catch(() => {});
    return () => { requestId.current += 1; };
  }, [fetchLeaderboard]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Protected>
      <PageShell>
        <div className="space-y-6">
          <header>
            <h1 className="text-3xl font-bold sm:text-4xl">Leaderboard</h1>
            <p className="mt-1 text-text-secondary">Ranked by distinct problems solved. Acceptance is based on submissions.</p>
          </header>

          {loading && entries.length === 0 ? <LoadingState label="Loading rankings" /> : null}
          {error ? (
            <StatePanel tone="error" title="Rankings unavailable" description={error} action={<Button variant="ghost" onClick={() => fetchLeaderboard(page)}>Retry rankings</Button>} />
          ) : null}
          {!loading && !error && entries.length === 0 ? (
            <StatePanel title="No ranked submissions yet" description="Rankings appear after the first code submission." action={<Link href="/problems" className="text-sm font-semibold text-primary hover:underline">Browse problems</Link>} />
          ) : null}

          {entries.length > 0 ? (
            <section aria-label="Global rankings" className="border-y border-border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-text-secondary">
                      <th scope="col" className="w-16 px-2 py-3 text-left font-semibold sm:px-4">Rank</th>
                      <th scope="col" className="px-2 py-3 text-left font-semibold sm:px-4">User</th>
                      <th scope="col" className="px-2 py-3 text-right font-semibold sm:px-4">Solved</th>
                      <th scope="col" className="hidden px-4 py-3 text-right font-semibold sm:table-cell">Acceptance</th>
                    </tr>
                  </thead>
                  <tbody className={loading ? "opacity-50" : ""}>
                    {entries.map((entry) => {
                      const isMe = entry.username === myUsername;
                      return (
                        <tr key={entry.username} className={`border-b border-border/50 last:border-0 ${isMe ? "bg-primary/5" : ""}`}>
                          <td className="px-2 py-3 font-semibold tabular-nums text-text-secondary sm:px-4">{entry.rank}</td>
                          <td className="px-2 py-3 sm:px-4">
                            <Link href={`/profile/${encodeURIComponent(entry.username)}`} className="flex min-w-0 items-center gap-2.5 font-medium text-text-primary hover:text-primary">
                              <Avatar src={entry.avatar_url} name={entry.name ?? entry.username} size="sm" />
                              <span className="min-w-0">
                                <span className="block break-words">{entry.name || entry.username}{isMe ? <span className="ml-2 text-xs font-semibold text-primary">You</span> : null}</span>
                                <span className="block break-all text-xs font-normal text-text-secondary">@{entry.username}</span>
                                <span className="block text-xs font-normal text-text-secondary sm:hidden">{entry.acceptanceRate}% accepted</span>
                              </span>
                            </Link>
                          </td>
                          <td className="px-2 py-3 text-right font-semibold tabular-nums text-accent sm:px-4">{entry.solved}</td>
                          <td className="hidden px-4 py-3 text-right tabular-nums text-text-secondary sm:table-cell">{entry.acceptanceRate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 ? (
                <nav aria-label="Leaderboard pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-3">
                  <p className="text-sm text-text-secondary">Page {page} of {totalPages} · {total} ranked users</p>
                  <div className="flex gap-2">
                    <Button variant="ghost" disabled={loading || page <= 1} onClick={() => fetchLeaderboard(page - 1)}>Previous</Button>
                    <Button variant="ghost" disabled={loading || page >= totalPages} onClick={() => fetchLeaderboard(page + 1)}>Next</Button>
                  </div>
                </nav>
              ) : null}
            </section>
          ) : null}
        </div>
      </PageShell>
    </Protected>
  );
}
