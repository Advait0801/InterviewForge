"use client";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function EmailConfirmation({
  email,
  confirmed,
  banner = false,
}: {
  email: string;
  confirmed: boolean;
  banner?: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [serverConfirmed, setServerConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deadline, setDeadline] = useState(0);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    const tick = () =>
      setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  const verified = confirmed || serverConfirmed;
  if (banner && (dismissed || confirmed)) return null;
  return (
    <section
      aria-label="Email confirmation"
      className={`${banner ? "rounded-2xl border border-border bg-surface/75 p-4" : "mt-4"} space-y-3 text-sm`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 break-words">
          {banner && !verified ? (
            <>
              Confirm your email — we sent a link to{" "}
              <span className="break-all">{email}</span>. Check Spam too.
            </>
          ) : (
            <>
              Email: <strong>{verified ? "Confirmed" : "Not confirmed"}</strong>
            </>
          )}
        </p>
        {banner && (
          <button
            type="button"
            aria-label="Dismiss email reminder"
            onClick={() => setDismissed(true)}
            className="min-h-8 rounded px-2 text-text-secondary underline"
          >
            Dismiss
          </button>
        )}
      </div>
      {!verified && (
        <Button
          variant="secondary"
          size="sm"
          loading={busy}
          disabled={seconds > 0}
          onClick={async () => {
            setBusy(true);
            setMessage(null);
            setError(null);
            try {
              await api.resendVerification();
              setMessage("Sent — check your inbox and Spam");
            } catch (error) {
              if (
                error instanceof ApiError &&
                error.status === 409 &&
                error.code === "already_verified"
              )
                setServerConfirmed(true);
              else if (
                error instanceof ApiError &&
                error.status === 429 &&
                error.retryAfterSeconds !== undefined
              ) {
                const delay = Math.max(0, Math.ceil(error.retryAfterSeconds));
                setDeadline(Date.now() + delay * 1000);
                setSeconds(delay);
              } else
                setError(
                  error instanceof Error
                    ? error.message
                    : "Could not queue the email. Try again.",
                );
            } finally {
              setBusy(false);
            }
          }}
        >
          Resend email
        </Button>
      )}
      {seconds > 0 ? (
        <p role="status">You can resend in {seconds} seconds</p>
      ) : (
        message && <p role="status">{message}</p>
      )}
      {error && (
        <p role="alert" className="text-error">
          {error}
        </p>
      )}
    </section>
  );
}
