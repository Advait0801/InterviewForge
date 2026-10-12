"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button, buttonStyles } from "@/components/ui/button";
import { LoadingState, StatePanel } from "@/components/ui/state-panel";
import { useApiResource } from "@/hooks/use-api-resource";
import { api, type PeerRole } from "@/lib/api";

function PeerLobby() {
  const load = useCallback(() => api.listPeerSessions(), []);
  const state = useApiResource(load);
  const [search, setSearch] = useState("");
  const problemsLoad = useCallback(() => api.listProblems(), []);
  const problems = useApiResource(problemsLoad);
  const [problemId, setProblemId] = useState("");
  const [role, setRole] = useState<PeerRole>("interviewer");
  const [duration, setDuration] = useState("45");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ url: string; id: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  async function create(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const minutes = Number(duration);
    if (!Number.isInteger(minutes) || minutes < 15 || minutes > 90) {
      setError("Choose a duration from 15 to 90 whole minutes.");
      return;
    }
    setCreating(true);
    try {
      const result = await api.createPeerSession({
        role,
        durationMinutes: minutes,
        ...(problemId ? { problemId } : {}),
      });
      setInvite({
        url: `${window.location.origin}/peer/join#${result.inviteToken}`,
        id: result.session.id,
      });
      setCopied(false);
      setCopyError(false);
      void state.reload();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not create the interview. Try again.",
      );
    } finally {
      setCreating(false);
    }
  }
  return (
    <PageShell>
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header>
          <p className="text-sm font-semibold text-primary">
            Practise together
          </p>
          <h1 className="mt-2 text-3xl font-bold">Peer mock interviews</h1>
          <p className="mt-2 text-text-secondary">
            Take turns interviewing. Share code, with optional microphone and
            camera.
          </p>
        </header>
        {invite && (
          <Card className="min-w-0 space-y-3" role="status">
            <h2 className="text-xl font-semibold">Your invite link</h2>
            <p className="text-sm text-text-secondary">
              This link seats exactly one person. Copy it now: it can&apos;t be
              shown again after you dismiss it or leave this page.
            </p>
            <Input
              label="Invite link"
              readOnly
              value={invite.url}
              onFocus={(e) => e.target.select()}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(invite.url);
                    setCopied(true);
                    setCopyError(false);
                  } catch {
                    setCopyError(true);
                  }
                }}
              >
                {copied ? "Copied" : "Copy invite"}
              </Button>
              <Link
                className={buttonStyles({ variant: "secondary" })}
                href={`/peer/${invite.id}`}
              >
                Open room
              </Link>
              <Button variant="ghost" onClick={() => setInvite(null)}>
                Dismiss invite
              </Button>
            </div>
            {copyError && (
              <p role="alert" className="text-sm text-error">
                Copy failed. Select the invite link and copy it manually.
              </p>
            )}
          </Card>
        )}
        <Card className="space-y-4">
          <h2 className="text-xl font-semibold">Host a peer interview</h2>
          <form className="space-y-4" onSubmit={create}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="peer-role"
                  className="mb-1.5 block text-sm font-medium"
                >
                  Your role
                </label>
                <select
                  id="peer-role"
                  value={role}
                  onChange={(e) =>
                    setRole(
                      e.target.value === "candidate"
                        ? "candidate"
                        : "interviewer",
                    )
                  }
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                >
                  <option value="interviewer">Interviewer</option>
                  <option value="candidate">Candidate</option>
                </select>
              </div>
              <Input
                label="Duration (minutes)"
                type="number"
                min={15}
                max={90}
                step={1}
                required
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <Input
              label="Search problems (optional)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {problems.loading ? (
              <LoadingState
                label="Loading problem choices"
                className="min-h-16"
              />
            ) : problems.error || problems.missing ? (
              <StatePanel
                tone="error"
                title="Problem choices unavailable"
                description={problems.error ?? "No problem list found."}
                action={
                  <Button onClick={problems.reload}>Retry problems</Button>
                }
              />
            ) : (
              <div>
                <label
                  htmlFor="peer-problem"
                  className="mb-1.5 block text-sm font-medium"
                >
                  Problem (optional)
                </label>
                <select
                  id="peer-problem"
                  value={problemId}
                  onChange={(e) => setProblemId(e.target.value)}
                  className="w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5"
                >
                  <option value="">No problem — choose together</option>
                  {problems.data?.problems
                    .filter(
                      (p) =>
                        p.id === problemId ||
                        p.title.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.difficulty})
                      </option>
                    ))}
                </select>
                {search &&
                  !problems.data?.problems.some((p) =>
                    p.title.toLowerCase().includes(search.toLowerCase()),
                  ) && (
                    <p className="mt-2 text-sm text-text-secondary">
                      No problems match your search.
                    </p>
                  )}
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-error">
                {error}
              </p>
            )}
            <Button
              type="submit"
              loading={creating}
              loadingLabel="Creating invite…"
              disabled={Boolean(invite)}
            >
              Create invite
            </Button>
          </form>
        </Card>
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Your sessions</h2>
          {state.loading ? (
            <LoadingState label="Loading peer sessions" />
          ) : state.error || state.missing ? (
            <StatePanel
              tone="error"
              title="Peer sessions unavailable"
              description={state.error ?? "Your sessions could not be found."}
              action={<Button onClick={state.reload}>Retry sessions</Button>}
            />
          ) : !state.data?.sessions.length ? (
            <StatePanel
              title="No peer interviews yet"
              description="Host an interview above, or open a partner's invite link."
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {state.data.sessions.map((s) => (
                <li key={s.id}>
                  <Card className="h-full min-w-0 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge>{s.status}</Badge>
                      <Badge>{s.myRole}</Badge>
                    </div>
                    <h3 className="break-words font-semibold">
                      {s.problem?.title ?? "Open practice"}
                    </h3>
                    <p className="break-words text-sm text-text-secondary">
                      Partner:{" "}
                      {s.partner?.username ?? "Waiting for someone to join"}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {s.durationMinutes} minute
                      {s.durationMinutes === 1 ? "" : "s"} · Created{" "}
                      {new Date(s.createdAt).toLocaleString()}
                    </p>
                    {s.startedAt && (
                      <p className="text-sm text-text-secondary">
                        Started {new Date(s.startedAt).toLocaleString()}
                      </p>
                    )}
                    {s.endedAt && (
                      <p className="text-sm text-text-secondary">
                        Ended {new Date(s.endedAt).toLocaleString()}
                      </p>
                    )}
                    <Link
                      className={buttonStyles({
                        variant: "secondary",
                        size: "sm",
                      })}
                      href={`/peer/${s.id}`}
                    >
                      {s.status === "waiting" || s.status === "active"
                        ? "Open room"
                        : "View feedback"}
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  );
}
export default function PeerPage() {
  return (
    <Protected>
      <PeerLobby />
    </Protected>
  );
}
