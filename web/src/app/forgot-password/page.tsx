"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Enter your email");
      return;
    }
    setLoading(true);
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
      toast.success("If an account exists, reset instructions were sent.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <div className="flex flex-1 items-center justify-center relative">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 left-1/4 h-60 w-60 rounded-full bg-primary/10 blur-[120px] animate-blob" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md relative"
        >
          <Card className="p-8">
            <div className="mb-6 flex flex-col items-center">
              <Logo size={40} className="mb-3" />
              <h1 className="text-2xl font-bold">Reset password</h1>
              <p className="mt-1 text-center text-sm text-text-secondary">
                {sent
                  ? "Check your email (in development, the reset link is printed in the backend console)."
                  : "We’ll send a link if an account exists for this email."}
              </p>
            </div>
            {!sent ? (
              <form className="space-y-4" onSubmit={onSubmit}>
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
                <Button className="w-full" disabled={loading} type="submit">
                  {loading ? "Sending…" : "Send reset link"}
                </Button>
              </form>
            ) : null}
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
