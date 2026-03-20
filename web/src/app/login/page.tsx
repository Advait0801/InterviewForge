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
  identifier?: string;
  password?: string;
};

function validate(identifier: string, password: string): FieldErrors | null {
  const errors: FieldErrors = {};
  if (!identifier.trim()) {
    errors.identifier = "Email or username is required";
  }
  if (!password) {
    errors.password = "Password is required";
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const errs = validate(identifier, password);
    if (errs) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      const res = await api.login(identifier, password);
      setToken(res.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
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
            <h1 className="mb-4 text-2xl font-semibold">Sign in</h1>
            <form className="space-y-3" onSubmit={onSubmit}>
              <Input
                placeholder="Email or username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                error={fieldErrors.identifier}
                autoComplete="username"
              />
              <PasswordField
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fieldErrors.password}
                autoComplete="current-password"
              />
              {error ? <p className="text-sm text-error">{error}</p> : null}
              <Button className="w-full" disabled={loading} type="submit">
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
            <p className="mt-4 text-sm text-text-secondary">
              No account?{" "}
              <Link className="text-primary" href="/register">
                Create one
              </Link>
            </p>
          </Card>
        </motion.div>
      </div>
    </PageShell>
  );
}
