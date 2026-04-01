"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { api, LeaderboardEntry } from "@/lib/api";

const PAGE_SIZE = 20;

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [myUsername, setMyUsername] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await api.getLeaderboard(p, PAGE_SIZE);
      setEntries(res.leaderboard);
      setTotal(res.total);
      setPage(p);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard(1);
    api.me().then((r) => setMyUsername(r.user.username)).catch(() => {});
  }, [fetchLeaderboard]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Protected>
      <PageShell>
        <motion.div initial="hidden" animate="visible" variants={fadeUp} className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Leaderboard</h1>
            <p className="mt-1 text-text-secondary">Global ranking by problems solved.</p>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface/50">
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary w-16">Rank</th>
                    <th className="px-4 py-3 text-left font-semibold text-text-secondary">User</th>
                    <th className="px-4 py-3 text-right font-semibold text-text-secondary">Solved</th>
                    <th className="px-4 py-3 text-right font-semibold text-text-secondary">Acceptance</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center">
                        <div className="flex items-center justify-center gap-2 text-text-secondary">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          Loading...
                        </div>
                      </td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-text-secondary">
                        No submissions yet. Be the first!
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => {
                      const isMe = myUsername && entry.username === myUsername;
                      return (
                        <tr
                          key={entry.rank}
                          className={`border-b border-border/50 transition-colors hover:bg-surface-hover/50 ${
                            isMe ? "bg-primary/5" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                                entry.rank === 1
                                  ? "bg-warning/20 text-warning"
                                  : entry.rank === 2
                                    ? "bg-text-secondary/20 text-text-secondary"
                                    : entry.rank === 3
                                      ? "bg-orange-500/20 text-orange-400"
                                      : "text-text-secondary"
                              }`}
                            >
                              {entry.rank}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/profile/${entry.username}`}
                              className="flex items-center gap-2.5 font-medium text-text-primary hover:text-primary transition-colors"
                            >
                              <Avatar src={entry.avatar_url} name={entry.name ?? entry.username} size="sm" />
                              <div>
                                <span>
                                  {entry.name || entry.username}
                                  {isMe && (
                                    <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                      You
                                    </span>
                                  )}
                                </span>
                                <p className="text-xs text-text-secondary">@{entry.username}</p>
                              </div>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-semibold text-accent">{entry.solved}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-text-secondary">{entry.acceptanceRate}%</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <p className="text-xs text-text-secondary">
                  Page {page} of {totalPages} ({total} users)
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => fetchLeaderboard(page - 1)}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-hover disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => fetchLeaderboard(page + 1)}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-hover disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      </PageShell>
    </Protected>
  );
}
