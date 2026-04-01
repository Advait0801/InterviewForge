"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { PasswordField } from "@/components/ui/password-field";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { toast } from "sonner";
import { api } from "@/lib/api";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("Invalid or missing reset link.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      toast.success("Password updated. You can sign in.");
      router.replace("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <p className="text-center text-sm text-text-secondary">
        Missing token.{" "}
        <Link className="text-primary hover:underline" href="/forgot-password">
          Request a new link
        </Link>
        .
      </p>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <PasswordField
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
      />
      <PasswordField
        placeholder="Confirm password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="new-password"
      />
      <Button className="w-full" disabled={loading} type="submit">
        {loading ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <PageShell>
      <div className="flex flex-1 items-center justify-center relative">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative">
          <Card className="p-8">
            <div className="mb-6 flex flex-col items-center">
              <Logo size={40} className="mb-3" />
              <h1 className="text-2xl font-bold">Choose a new password</h1>
            </div>
            <Suspense fallback={<p className="text-sm text-text-secondary">Loading…</p>}>
              <ResetForm />
            </Suspense>
            <p className="mt-5 text-center text-sm text-text-secondary">
              <Link className="font-medium text-primary hover:underline" href="/login">
                Back to sign in
              </Link>
            </p>
          </Card>
        </motion.div>
      </div>
    </PageShell>
  );
}
