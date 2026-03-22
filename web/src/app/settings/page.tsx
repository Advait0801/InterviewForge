"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
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

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: "easeOut" as const },
  }),
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
        <motion.div initial="hidden" animate="visible" className="w-full">
          <motion.div variants={fadeUp} custom={0} className="mb-8">
            <h1 className="text-3xl font-bold sm:text-4xl tracking-tight">Settings</h1>
            <p className="mt-1 text-text-secondary">Manage your account and preferences</p>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Account info */}
            <motion.div variants={fadeUp} custom={1}>
              <Card className="p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold">Account</h2>
                </div>
                {loadError ? <p className="text-sm text-error">{loadError}</p> : null}
                {!user && !loadError ? (
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Loading…
                  </div>
                ) : null}
                {user ? (
                  <dl className="space-y-4 text-sm">
                    {[
                      { label: "Username", value: user.username ?? "—" },
                      { label: "Email", value: user.email },
                      { label: "Full name", value: user.name ?? "—" },
                    ].map((field) => (
                      <div key={field.label}>
                        <dt className="text-text-secondary text-xs font-medium uppercase tracking-wider mb-1">{field.label}</dt>
                        <dd className="rounded-xl border border-border bg-background/60 px-4 py-2.5 text-text-primary">{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </Card>
            </motion.div>

            {/* Change password */}
            <motion.div variants={fadeUp} custom={2}>
              <Card className="p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 border border-warning/20">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-warning">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold">Change password</h2>
                </div>
                <form className="space-y-4" onSubmit={onSubmitPassword}>
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
            </motion.div>
          </div>
        </motion.div>
      </PageShell>
    </Protected>
  );
}
