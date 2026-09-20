"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/ui/password-field";
import { Button, buttonStyles } from "@/components/ui/button";
import { LoadingState, StatePanel } from "@/components/ui/state-panel";
import { toast } from "sonner";
import { api } from "@/lib/api";

type FieldErrors = { password?: string; confirm?: string };

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setRequestError(null);
    const errors: FieldErrors = {};
    if (password.length < 6) errors.password = "Use at least 6 characters.";
    if (!confirm) errors.confirm = "Confirm your new password.";
    else if (password !== confirm) errors.confirm = "The passwords do not match.";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstInvalid = errors.password ? "reset-password" : "reset-confirm";
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      toast.success("Password updated. Sign in with your new password.");
      router.replace("/login");
    } catch (caught) {
      setRequestError(caught instanceof Error ? caught.message : "We couldn’t update your password. Request a new link and try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <StatePanel
        tone="error"
        title="This reset link is incomplete"
        description="Request a fresh password reset link, then open the full link from your email."
        action={<Link href="/forgot-password" className={buttonStyles({ variant: "secondary" })}>Request a new link</Link>}
      />
    );
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <PasswordField
        id="reset-password"
        label="New password"
        hint="At least 6 characters"
        placeholder="Create a new password"
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: undefined }));
        }}
        error={fieldErrors.password}
        autoComplete="new-password"
        required
      />
      <PasswordField
        id="reset-confirm"
        label="Confirm new password"
        placeholder="Repeat your new password"
        value={confirm}
        onChange={(event) => {
          setConfirm(event.target.value);
          if (fieldErrors.confirm) setFieldErrors((current) => ({ ...current, confirm: undefined }));
        }}
        error={fieldErrors.confirm}
        autoComplete="new-password"
        required
      />
      {requestError ? (
        <div className="rounded-xl border border-error/25 bg-error/5 px-3 py-2.5 text-sm text-error" role="alert">
          <p>{requestError}</p>
          <Link className="mt-2 inline-block font-semibold underline" href="/forgot-password">Request another link</Link>
        </div>
      ) : null}
      <Button className="w-full" type="submit" loading={loading} loadingLabel="Updating password…">
        Update password
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Choose a new password"
      description="Use a password you do not reuse elsewhere, then sign in again with the new password."
      footer={<Link className="font-semibold text-primary hover:underline" href="/login">Back to sign in</Link>}
    >
      <Suspense fallback={<LoadingState label="Preparing password reset…" />}>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
