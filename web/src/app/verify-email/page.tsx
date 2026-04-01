"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

function VerifyContent() {
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified");
  const err = searchParams.get("error");

  let title = "Email verification";
  let body = "Use the link from your email to verify your account.";
  if (verified === "1") {
    title = "Email verified";
    body = "Your email is confirmed. You can continue using InterviewForge.";
  } else if (err === "invalid") {
    title = "Link expired or invalid";
    body = "Request a new verification email from your account settings (coming soon), or contact support.";
  } else if (err === "missing") {
    title = "Missing token";
    body = "Open the full verification link from your email.";
  } else if (err === "server") {
    title = "Something went wrong";
    body = "Please try again later.";
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-center">{title}</h1>
      <p className="mt-2 text-center text-sm text-text-secondary">{body}</p>
      <p className="mt-6 text-center">
        <Link className="font-medium text-primary hover:underline" href="/dashboard">
          Go to dashboard
        </Link>
      </p>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <PageShell>
      <div className="flex flex-1 items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Card className="p-8">
            <div className="mb-6 flex flex-col items-center">
              <Logo size={40} className="mb-3" />
            </div>
            <Suspense fallback={<p className="text-center text-text-secondary">Loading…</p>}>
              <VerifyContent />
            </Suspense>
          </Card>
        </motion.div>
      </div>
    </PageShell>
  );
}
