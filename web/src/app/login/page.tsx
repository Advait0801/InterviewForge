"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Input } from "@/components/ui/input";
import { PasswordField } from "@/components/ui/password-field";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";

type FieldErrors = { identifier?: string; password?: string };

function validate(identifier: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!identifier.trim()) errors.identifier = "Enter your email or username.";
  if (!password) errors.password = "Enter your password.";
  return errors;
}

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);

  // Set by api.ts when the backend reports the stored session is no longer valid.
  // Read from window rather than useSearchParams, which would need a Suspense boundary.
  useEffect(() => {
    setSessionEnded(new URLSearchParams(window.location.search).get("expired") === "1");
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const errors = validate(identifier, password);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstInvalid = errors.identifier ? "login-identifier" : "login-password";
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      const response = await api.login(identifier.trim(), password);
      setToken(response.token);
      toast.success("Signed in");
      router.push("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn’t sign you in. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Continue your practice"
      description="Sign in to pick up your coding, interview, and system-design progress."
      footer={<>New to InterviewForge? <Link className="font-semibold text-primary hover:underline" href="/register">Create an account</Link></>}
    >
      {sessionEnded ? (
        <p className="mb-4 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 text-sm text-text-primary" role="status">
          Your session ended. Please sign in again.
        </p>
      ) : null}
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <Input
          id="login-identifier"
          label="Email or username"
          placeholder="you@example.com"
          value={identifier}
          onChange={(event) => {
            setIdentifier(event.target.value);
            if (fieldErrors.identifier) setFieldErrors((current) => ({ ...current, identifier: undefined }));
          }}
          error={fieldErrors.identifier}
          autoComplete="username"
          required
        />
        <PasswordField
          id="login-password"
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: undefined }));
          }}
          error={fieldErrors.password}
          autoComplete="current-password"
          required
        />
        <div className="flex justify-end">
          <Link className="text-sm font-medium text-primary hover:underline" href="/forgot-password">Forgot password?</Link>
        </div>
        {error ? <p className="rounded-xl border border-error/25 bg-error/5 px-3 py-2.5 text-sm text-error" role="alert">{error}</p> : null}
        <Button className="w-full" type="submit" loading={loading} loadingLabel="Signing in…">
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
