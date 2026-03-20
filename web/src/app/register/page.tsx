"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordField } from "@/components/ui/password-field";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";

type FieldErrors = {
  username?: string;
  email?: string;
  password?: string;
};

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function validate(username: string, email: string, password: string): FieldErrors | null {
  const errors: FieldErrors = {};
  if (!username.trim()) {
    errors.username = "Username is required";
  } else if (!USERNAME_RE.test(username)) {
    errors.username = "3–20 characters, letters/numbers/underscore only";
  }
  if (!email.trim()) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address";
  }
  if (!password) {
    errors.password = "Password is required";
  } else if (password.length < 6) {
    errors.password = "Must be at least 6 characters";
  }
  return Object.keys(errors).length > 0 ? errors : null;
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

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const errs = validate(username, email, password);
    if (errs) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      const res = await api.register(username, email, password, fullName || undefined);
      setToken(res.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <div className="flex flex-1 items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <Card className="p-6">
            <h1 className="mb-4 text-2xl font-semibold">Create account</h1>
            <form className="space-y-3" onSubmit={onSubmit}>
              <Input
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                error={fieldErrors.username}
                autoComplete="username"
              />
              <Input
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fieldErrors.email}
                autoComplete="email"
              />
              <PasswordField
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fieldErrors.password}
                autoComplete="new-password"
              />
              <Input
                placeholder="Full name (optional)"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              {error ? <p className="text-sm text-error">{error}</p> : null}
              <Button className="w-full" disabled={loading} type="submit">
                {loading ? "Creating..." : "Create account"}
              </Button>
            </form>
            <p className="mt-4 text-sm text-text-secondary">
              Already have an account?{" "}
              <Link className="text-primary" href="/login">
                Sign in
              </Link>
            </p>
          </Card>
        </motion.div>
      </div>
    </PageShell>
  );
}
