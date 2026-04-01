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
      toast.success("Account created — verify your email (link is logged in the backend console in dev).");
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <div className="flex flex-1 items-center justify-center relative">
        {/* Decorative background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 right-1/4 h-60 w-60 rounded-full bg-accent/10 blur-[120px] animate-blob" />
          <div className="absolute -bottom-20 left-1/4 h-60 w-60 rounded-full bg-primary/10 blur-[120px] animate-blob [animation-delay:3s]" />
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
              <h1 className="text-2xl font-bold">Create account</h1>
              <p className="mt-1 text-sm text-text-secondary">Get started with InterviewForge for free</p>
            </div>
            <form className="space-y-4" onSubmit={onSubmit}>
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
            <p className="mt-5 text-center text-sm text-text-secondary">
              Already have an account?{" "}
              <Link className="font-medium text-primary hover:underline" href="/login">
                Sign in
              </Link>
            </p>
          </Card>
        </motion.div>
      </div>
    </PageShell>
  );
}
