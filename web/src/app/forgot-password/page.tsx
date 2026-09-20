"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Input } from "@/components/ui/input";
import { Button, buttonStyles } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { api } from "@/lib/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [requestError, setRequestError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setRequestError(null);
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !EMAIL_RE.test(normalizedEmail)) {
      setEmailError(normalizedEmail ? "Enter a valid email address." : "Enter your email address.");
      document.getElementById("forgot-email")?.focus();
      return;
    }

    setEmailError(undefined);
    setLoading(true);
    try {
      await api.forgotPassword(normalizedEmail);
      setSent(true);
    } catch (caught) {
      setRequestError(caught instanceof Error ? caught.message : "We couldn’t process the request. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset your password"
      description="Enter the email connected to your account. For privacy, the confirmation is the same for every address."
      footer={<Link className="font-semibold text-primary hover:underline" href="/login">Back to sign in</Link>}
    >
      {sent ? (
        <StatePanel
          title="Request received"
          description="If an account exists for that address, a password reset request was accepted. The reset link expires after one hour."
          icon={<span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-xl text-accent" aria-hidden>✓</span>}
          action={<Link href="/login" className={buttonStyles({ variant: "secondary" })}>Return to sign in</Link>}
        />
      ) : (
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <Input
            id="forgot-email"
            type="email"
            label="Email address"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (emailError) setEmailError(undefined);
            }}
            error={emailError}
            autoComplete="email"
            required
          />
          {requestError ? <p className="rounded-xl border border-error/25 bg-error/5 px-3 py-2.5 text-sm text-error" role="alert">{requestError}</p> : null}
          <Button className="w-full" type="submit" loading={loading} loadingLabel="Sending instructions…">
            Send reset instructions
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
