"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";
import { Avatar } from "@/components/ui/avatar";
import { LoadingState, StatePanel } from "@/components/ui/state-panel";
import { api } from "@/lib/api";
import { clearToken, setToken } from "@/lib/auth";

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
    avatar_url: string | null;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.me();
      setUser(res.user);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load account");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAccount(); }, [loadAccount]);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    if (file.size > 500_000) {
      setAvatarError("Image must be under 500KB");
      e.target.value = "";
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarError("Only JPEG, PNG, or WebP images are allowed");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUri = reader.result as string;
      if (new Blob([dataUri]).size > 500_000) {
        setAvatarError("This image is too large after encoding. Choose an image under about 370KB.");
        return;
      }
      setAvatarUploading(true);
      try {
        const res = await api.uploadAvatar(dataUri);
        setUser((prev) => (prev ? { ...prev, avatar_url: res.avatar_url } : prev));
        toast.success("Avatar updated");
      } catch (err) {
        setAvatarError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setAvatarUploading(false);
      }
    };
    reader.onerror = () => setAvatarError("Could not read this image. Choose another file.");
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAvatarRemove = async () => {
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      await api.removeAvatar();
      setUser((prev) => (prev ? { ...prev, avatar_url: null } : prev));
      toast.success("Avatar removed");
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Failed to remove avatar");
    } finally {
      setAvatarUploading(false);
    }
  };

  const validatePasswordForm = (): FieldErrors | null => {
    const errors: FieldErrors = {};
    if (!currentPassword) errors.current = "Current password is required";
    if (!newPassword) errors.next = "New password is required";
    else if (newPassword.length < MIN_LEN) errors.next = `Must be at least ${MIN_LEN} characters`;
    else if (newPassword === currentPassword) errors.next = "Choose a different password";
    if (newPassword !== confirmPassword) errors.confirm = "Passwords do not match";
    return Object.keys(errors).length > 0 ? errors : null;
  };

  const onSubmitPassword = async (e: FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setPasswordError(null);
    const errs = validatePasswordForm();
    if (errs) {
      setFieldErrors(errs);
      return;
    }
    setSubmitting(true);
    try {
      const { token } = await api.changePassword(currentPassword, newPassword);
      // The change revoked every earlier token, this tab's included; keep the new one.
      setToken(token);
      toast.success("Password updated. Other sessions have been signed out.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not update password";
      setPasswordError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onSignOutEverywhere = async () => {
    if (!window.confirm("Sign out of InterviewForge on every device, including this one?")) return;
    setSigningOutAll(true);
    try {
      await api.logoutAll();
      clearToken();
      window.location.assign("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign out everywhere");
      setSigningOutAll(false);
    }
  };

  return (
    <Protected>
      <PageShell>
        <div className="w-full">
          <header className="mb-8">
            <h1 className="text-3xl font-bold sm:text-4xl">Settings</h1>
            <p className="mt-1 text-text-secondary">Account and security</p>
          </header>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Account info */}
            <div>
              <Card className="p-6">
                <div className="mb-5 flex items-center gap-3">
                  <h2 className="text-lg font-semibold">Account</h2>
                </div>
                {loadError ? <StatePanel tone="error" title="Account unavailable" description={loadError} action={<Button variant="ghost" onClick={loadAccount}>Retry account</Button>} /> : null}
                {loading && !user ? <LoadingState label="Loading account" /> : null}
                {user ? (
                  <>
                    <div className="flex items-center gap-4 mb-6 pb-5 border-b border-border">
                      <Avatar src={user.avatar_url} name={user.name ?? user.username} size="xl" />
                      <div className="flex min-w-0 flex-col gap-2">
                        <p className="text-xs text-text-secondary">Profile picture</p>
                        <div className="flex flex-wrap gap-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            aria-label="Choose profile picture"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={handleAvatarSelect}
                          />
                          <Button
                            type="button"
                            className="!px-3 !py-1.5 text-sm"
                            disabled={avatarUploading}
                            loading={avatarUploading}
                            loadingLabel="Updating picture"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            Upload
                          </Button>
                          {user.avatar_url && (
                            <Button
                              type="button"
                              variant="ghost"
                              className="!px-3 !py-1.5 text-sm"
                              disabled={avatarUploading}
                              onClick={handleAvatarRemove}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-text-secondary">JPEG, PNG, or WebP. Encoded image must be under 500KB.</p>
                      </div>
                    </div>
                    {avatarError ? <p className="mb-4 text-sm text-error" role="alert">{avatarError}</p> : null}
                    <dl className="space-y-4 text-sm">
                      {[
                        { label: "Username", value: user.username ?? "—" },
                        { label: "Email", value: user.email },
                        { label: "Full name", value: user.name ?? "—" },
                      ].map((field) => (
                        <div key={field.label}>
                          <dt className="text-text-secondary text-xs font-medium uppercase tracking-wider mb-1">{field.label}</dt>
                          <dd className="break-all text-text-primary">{field.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                ) : null}
              </Card>
            </div>

            {/* Change password */}
            <div>
              <Card className="p-6">
                <div className="mb-5 flex items-center gap-3">
                  <h2 className="text-lg font-semibold">Change password</h2>
                </div>
                <form className="space-y-4" onSubmit={onSubmitPassword}>
                  <PasswordField
                    label="Current password"
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    error={fieldErrors.current}
                    autoComplete="current-password"
                  />
                  <PasswordField
                    label="New password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    error={fieldErrors.next}
                    autoComplete="new-password"
                  />
                  <PasswordField
                    label="Confirm new password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    error={fieldErrors.confirm}
                    autoComplete="new-password"
                  />
                  {passwordError ? <p className="text-sm text-error" role="alert">{passwordError}</p> : null}
                  <Button className="w-full" type="submit" loading={submitting} loadingLabel="Updating password">
                    Update password
                  </Button>
                  <p className="text-xs text-text-secondary">Changing your password signs out your other devices.</p>
                </form>
              </Card>

              <Card className="mt-6 p-6">
                <h2 className="text-lg font-semibold">Sessions</h2>
                <p className="mt-1 mb-4 text-sm text-text-secondary">
                  Lost a device, or signed in somewhere you shouldn&apos;t have? This ends every session, including this one.
                </p>
                <Button
                  variant="danger"
                  className="w-full"
                  onClick={onSignOutEverywhere}
                  loading={signingOutAll}
                  loadingLabel="Signing out everywhere"
                >
                  Sign out everywhere
                </Button>
              </Card>
            </div>
          </div>
        </div>
      </PageShell>
    </Protected>
  );
}
