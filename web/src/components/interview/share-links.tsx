"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { api, ApiError, type ShareLink } from "@/lib/api";
import { useApiResource } from "@/hooks/use-api-resource";
import { Button } from "@/components/ui/button";
import { LoadingState, StatePanel } from "@/components/ui/state-panel";

function ShareDialog({
  id,
  resumeGrounded,
  onClose,
  onCreated,
}: {
  id: string;
  resumeGrounded: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("30");
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportRequired, setReportRequired] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);
  const create = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setReportRequired(false);
    try {
      const result = await api.createInterviewShare(id, {
        displayName: name.trim() || null,
        expiresInDays: expiry === "never" ? null : Number(expiry),
      });
      setUrl(`${window.location.origin}/share/${result.token}`);
      onCreated();
    } catch (error) {
      const required =
        error instanceof ApiError &&
        error.status === 409 &&
        error.code === "report_not_ready";
      setReportRequired(required);
      setError(
        required
          ? "Generate the report first"
          : error instanceof Error
            ? error.message
            : "Could not create a link. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      aria-labelledby="share-heading"
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-border bg-background p-5 text-text-primary shadow-xl backdrop:bg-black/60"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="share-heading" className="text-xl font-semibold">
          Share interview
        </h2>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
      {resumeGrounded && (
        <p className="my-4 rounded-lg border border-border bg-surface p-3 text-sm">
          The questions in this interview may mention your résumé.
        </p>
      )}
      {url ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold">
            You won&apos;t see this link again
          </p>
          <label className="block text-sm" htmlFor="share-url">
            Share URL
          </label>
          <input
            id="share-url"
            readOnly
            value={url}
            className="mono w-full min-w-0 rounded-lg border border-border bg-surface p-2 text-xs"
            onFocus={(event) => event.target.select()}
          />
          <Button
            size="sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              } catch {
                setError("Copy failed. Select and copy the URL above.");
              }
            }}
          >
            Copy
          </Button>
          {copied && (
            <p role="status" className="text-sm">
              Copied
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={create} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="share-name"
              className="mb-1 block text-sm font-medium"
            >
              Display name (optional)
            </label>
            <input
              id="share-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              className="w-full rounded-lg border border-border bg-surface p-2 text-sm"
            />
            <p className="mt-1 text-xs text-text-secondary">
              Shown to anyone with the link.
            </p>
          </div>
          <div>
            <label
              htmlFor="share-expiry"
              className="mb-1 block text-sm font-medium"
            >
              Expires after
            </label>
            <select
              id="share-expiry"
              value={expiry}
              onChange={(event) => setExpiry(event.target.value)}
              className="w-full rounded-lg border border-border bg-surface p-2 text-sm"
            >
              <option value="never">Never</option>
              {[7, 30, 90].map((days) => (
                <option key={days} value={days}>
                  {days} days
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" loading={busy}>
            Create share link
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-error">
          {error}
        </p>
      )}
      {reportRequired && (
        <Link
          href="/interview"
          className="mt-2 block text-sm text-primary underline"
        >
          Back to interview
        </Link>
      )}
    </dialog>
  );
}

export function ShareLinks({
  id,
  resumeGrounded,
}: {
  id: string;
  resumeGrounded: boolean;
}) {
  const load = useCallback(() => api.listInterviewShares(id), [id]);
  const state = useApiResource(load);
  const [open, setOpen] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(
    null,
  );
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const revoke = async (link: ShareLink) => {
    if (
      !window.confirm(
        `Revoke link …${link.tokenHint}? Anyone with it will lose access.`,
      )
    )
      return;
    setRevoking(link.id);
    setError(null);
    try {
      await api.revokeInterviewShare(id, link.id);
      await state.reload();
    } catch (error) {
      setError({
        id: link.id,
        message:
          error instanceof Error
            ? error.message
            : "Revocation failed. Try again.",
      });
    } finally {
      setRevoking(null);
    }
  };
  return (
    <section
      className="space-y-4 rounded-2xl border border-border bg-surface/60 p-5"
      aria-labelledby="share-links-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="share-links-heading" className="text-xl font-semibold">
          Share links
        </h2>
        <Button ref={trigger} size="sm" onClick={() => setOpen(true)}>
          Share
        </Button>
      </div>
      {open && (
        <ShareDialog
          id={id}
          resumeGrounded={resumeGrounded}
          onClose={close}
          onCreated={() => {
            void state.reload();
          }}
        />
      )}
      {state.loading ? (
        <LoadingState label="Loading share links" />
      ) : state.error || state.missing ? (
        <StatePanel
          tone="error"
          title="Share links unavailable"
          description={state.error ?? "Share links could not be found."}
          action={<Button onClick={state.reload}>Retry links</Button>}
        />
      ) : !state.data?.links.length ? (
        <p className="text-sm text-text-secondary">No active share links.</p>
      ) : (
        <ul className="space-y-3">
          {state.data.links.map((link) => (
            <li className="rounded-lg border border-border p-3" key={link.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 text-sm">
                  <p className="break-words font-semibold">
                    …{link.tokenHint}
                    {link.displayName && ` · ${link.displayName}`}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {link.viewCount} views · Created{" "}
                    {new Date(link.createdAt).toLocaleDateString()} ·{" "}
                    {link.expiresAt
                      ? `Expires ${new Date(link.expiresAt).toLocaleDateString()}`
                      : "Never expires"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={Boolean(revoking)}
                  loading={revoking === link.id}
                  onClick={() => void revoke(link)}
                >
                  Revoke<span className="sr-only"> …{link.tokenHint}</span>
                </Button>
              </div>
              {error?.id === link.id && (
                <p role="alert" className="mt-2 text-sm text-error">
                  {error.message}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
