"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { PageShell } from "@/components/layout/page-shell";
import { Button, buttonStyles } from "@/components/ui/button";
import { LoadingState, StatePanel } from "@/components/ui/state-panel";

const INVITE_KEY = "if-peer-pending-invite";
export default function PeerJoinPage() {
  const router = useRouter();
  const token = useRef<string | null>(null);
  const started = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  const join = useCallback(async () => {
    if (!token.current) {
      setError("This invite doesn't exist or is no longer open.");
      setLoading(false);
      return;
    }
    // Tab-scoped, cleared after joining; the bearer token never enters a query string.
    sessionStorage.setItem(INVITE_KEY, token.current);
    if (!getToken()) {
      router.replace("/login?next=%2Fpeer%2Fjoin");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.joinPeerSession(token.current);
      sessionStorage.removeItem(INVITE_KEY);
      token.current = null;
      router.replace(`/peer/${result.session.id}`);
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      setError(
        status === 404
          ? "This invite doesn't exist or is no longer open."
          : status === 409
            ? "This interview already has both participants."
            : e instanceof Error
              ? e.message
              : "Could not join the interview.",
      );
      setRetryable(status !== 404 && status !== 409 && status !== 400);
      if (status === 404 || status === 409 || status === 400) {
        sessionStorage.removeItem(INVITE_KEY);
        token.current = null;
      }
      setLoading(false);
    }
  }, [router]);
  useEffect(() => {
    // Strict Mode must not consume this one-seat invite twice.
    if (started.current) return;
    started.current = true;
    token.current =
      window.location.hash.slice(1) || sessionStorage.getItem(INVITE_KEY);
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search,
    );
    queueMicrotask(() => void join());
  }, [join]);
  return (
    <PageShell>
      <div className="mx-auto w-full max-w-xl space-y-4">
        <h1 className="text-3xl font-bold">Join a peer interview</h1>
        {loading ? (
          <LoadingState label="Joining the interview…" />
        ) : (
          <StatePanel
            tone="error"
            title="Could not join"
            description={error ?? undefined}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {retryable && <Button onClick={join}>Retry join</Button>}
                <Link
                  className={buttonStyles({ variant: "secondary" })}
                  href="/peer"
                >
                  Peer interviews
                </Link>
              </div>
            }
          />
        )}
      </div>
    </PageShell>
  );
}
