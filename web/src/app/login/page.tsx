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
import { Logo } from "@/components/ui/logo";
import { toast } from "sonner";
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
      toast.success("Signed in");
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <div className="flex flex-1 items-center justify-center relative">
        {/* Decorative background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 left-1/4 h-60 w-60 rounded-full bg-primary/10 blur-[120px] animate-blob" />
          <div className="absolute -bottom-20 right-1/4 h-60 w-60 rounded-full bg-secondary/10 blur-[120px] animate-blob [animation-delay:3s]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md relative"
        >
          <Card className="p-8">
            <div className="mb-6 flex flex-col items-center">
              <Logo size={40} className="mb-3" />
              <h1 className="text-2xl font-bold">Welcome back</h1>
              <p className="mt-1 text-sm text-text-secondary">Sign in to your InterviewForge account</p>
            </div>
            <form className="space-y-4" onSubmit={onSubmit}>
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
            <p className="mt-5 text-center text-sm text-text-secondary">
              No account?{" "}
              <Link className="font-medium text-primary hover:underline" href="/register">
                Create one
              </Link>
            </p>
          </Card>
        </motion.div>
      </div>
    </PageShell>
  );
}
