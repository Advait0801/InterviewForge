"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Input } from "@/components/ui/input";
import { PasswordField } from "@/components/ui/password-field";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";

type FieldErrors = { username?: string; email?: string; password?: string };
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(username: string, email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!username.trim()) errors.username = "Choose a username.";
  else if (!USERNAME_RE.test(username)) errors.username = "Use 3–20 letters, numbers, or underscores.";
  if (!email.trim()) errors.email = "Enter your email address.";
  else if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Create a password.";
  else if (password.length < 6) errors.password = "Use at least 6 characters.";
  return errors;
}

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const errors = validate(username, email, password);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstInvalid = errors.username ? "register-username" : errors.email ? "register-email" : "register-password";
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      const response = await api.register(username.trim(), email.trim(), password, fullName.trim() || undefined);
      setToken(response.token);
      toast.success("Account created");
      router.push("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn’t create your account. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Create your account"
      title="Start practicing with purpose"
      description="Create one profile for coding problems, mock interviews, learning paths, and progress."
      footer={<>Already have an account? <Link className="font-semibold text-primary hover:underline" href="/login">Sign in</Link></>}
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <Input
          id="register-username"
          label="Username"
          hint="3–20 letters, numbers, or underscores"
          placeholder="your_username"
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
            if (fieldErrors.username) setFieldErrors((current) => ({ ...current, username: undefined }));
          }}
          error={fieldErrors.username}
          autoComplete="username"
          required
        />
        <Input
          id="register-email"
          label="Email address"
          placeholder="you@example.com"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: undefined }));
          }}
          error={fieldErrors.email}
          autoComplete="email"
          required
        />
        <PasswordField
          id="register-password"
          label="Password"
          hint="At least 6 characters"
          placeholder="Create a password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: undefined }));
          }}
          error={fieldErrors.password}
          autoComplete="new-password"
          required
        />
        <Input
          id="register-name"
          label="Full name"
          hint="Optional"
          placeholder="Ada Lovelace"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          autoComplete="name"
        />
        {error ? <p className="rounded-xl border border-error/25 bg-error/5 px-3 py-2.5 text-sm text-error" role="alert">{error}</p> : null}
        <Button className="w-full" type="submit" loading={loading} loadingLabel="Creating account…">
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
