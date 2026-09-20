"use client";

import { Suspense, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { buttonStyles } from "@/components/ui/button";
import { LoadingState, StatePanel } from "@/components/ui/state-panel";
import { emailVerificationUrl } from "@/lib/api";
import { getToken } from "@/lib/auth";

const noopSubscribe = () => () => {};

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const verified = searchParams.get("verified");
  const error = searchParams.get("error");
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const isAuthed = mounted && Boolean(getToken());
  const accountHref = isAuthed ? "/dashboard" : "/login";
  const accountLabel = isAuthed ? "Continue to dashboard" : "Continue to sign in";

  useEffect(() => {
    if (token) window.location.replace(emailVerificationUrl(token));
  }, [token]);

  if (token) return <LoadingState label="Verifying your email…" />;

  if (verified === "1") {
    return (
      <StatePanel
        title="Email verified"
        description="Your email is confirmed. Sign in to continue your InterviewForge practice."
        icon={<span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-xl text-accent" aria-hidden>✓</span>}
        action={<Link href={accountHref} className={buttonStyles()}>{accountLabel}</Link>}
      />
    );
  }

  if (error) {
    const content = error === "invalid"
      ? ["This verification link has expired", "The link may already have been used or is no longer valid."]
      : error === "missing"
        ? ["This verification link is incomplete", "Open the full verification link from your email."]
        : ["We couldn’t verify your email", "Please try the link again later. Your account is still available."];
    return (
      <StatePanel
        tone="error"
        title={content[0]}
        description={content[1]}
        action={<Link href={accountHref} className={buttonStyles({ variant: "secondary" })}>{isAuthed ? "Back to dashboard" : "Back to sign in"}</Link>}
      />
    );
  }

  return (
    <StatePanel
      title="Check your email"
      description="Open the complete verification link from your email to confirm your address."
      action={<Link href={accountHref} className={buttonStyles({ variant: "ghost" })}>{isAuthed ? "Back to dashboard" : "Back to sign in"}</Link>}
    />
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthShell
      eyebrow="Email verification"
      title="Confirm your email"
      description="Verification keeps account recovery and important account updates connected to you."
    >
      <Suspense fallback={<LoadingState label="Checking verification status…" />}>
        <VerifyContent />
      </Suspense>
    </AuthShell>
  );
}
