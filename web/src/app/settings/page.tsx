"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";
import { api } from "@/lib/api";

const MIN_LEN = 6;

type FieldErrors = {
  current?: string;
  next?: string;
  confirm?: string;
};

export default function SettingsPage() {
  const [user, setUser] = useState<{
    email: string;
    username: string | null;
    name: string | null;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .me()
      .then((res) => setUser(res.user))
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to load profile";
        setLoadError(msg);
        toast.error(msg);
      });
  }, []);

  const validatePasswordForm = (): FieldErrors | null => {
    const errors: FieldErrors = {};
    if (!currentPassword) errors.current = "Current password is required";
    if (!newPassword) errors.next = "New password is required";
    else if (newPassword.length < MIN_LEN) errors.next = `Must be at least ${MIN_LEN} characters`;
    if (newPassword !== confirmPassword) errors.confirm = "Passwords do not match";
    return Object.keys(errors).length > 0 ? errors : null;
  };

  const onSubmitPassword = async (e: FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    const errs = validatePasswordForm();
    if (errs) {
      setFieldErrors(errs);
      return;
    }
    setSubmitting(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not update password";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Protected>
      <PageShell>
        <div className="mx-auto w-full max-w-lg">
          <h1 className="mb-6 text-3xl font-semibold">Settings</h1>

          <Card className="mb-6 p-6">
            <h2 className="mb-4 text-lg font-semibold">Account</h2>
            {loadError ? <p className="text-sm text-error">{loadError}</p> : null}
            {!user && !loadError ? <p className="text-sm text-text-secondary">Loading…</p> : null}
            {user ? (
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-text-secondary">Username</dt>
                  <dd className="mt-1 rounded-xl border border-border bg-background/50 px-3 py-2 text-text-primary">{user.username ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">Email</dt>
                  <dd className="mt-1 rounded-xl border border-border bg-background/50 px-3 py-2 text-text-primary">{user.email}</dd>
                </div>
                <div>
                  <dt className="text-text-secondary">Full name</dt>
                  <dd className="mt-1 rounded-xl border border-border bg-background/50 px-3 py-2 text-text-primary">{user.name ?? "—"}</dd>
                </div>
              </dl>
            ) : null}
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold">Change password</h2>
            <form className="space-y-3" onSubmit={onSubmitPassword}>
              <PasswordField
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                error={fieldErrors.current}
                autoComplete="current-password"
              />
              <PasswordField
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                error={fieldErrors.next}
                autoComplete="new-password"
              />
              <PasswordField
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={fieldErrors.confirm}
                autoComplete="new-password"
              />
              <Button className="w-full" type="submit" disabled={submitting}>
                {submitting ? "Updating…" : "Update password"}
              </Button>
            </form>
          </Card>
        </div>
      </PageShell>
    </Protected>
  );
}
