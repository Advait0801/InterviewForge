"use client";

import Link from "next/link";
import { Protected } from "@/components/auth/protected";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <Protected>
      <PageShell>
        <h1 className="mb-6 text-3xl font-semibold">Good to see you.</h1>
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/problems">
            <Card className="h-full transition hover:border-primary">
              <h2 className="mb-2 text-xl font-semibold">Practice coding</h2>
              <p className="text-sm text-text-secondary">Solve coding problems with run/submit workflow.</p>
            </Card>
          </Link>
          <Link href="/interview">
            <Card className="h-full transition hover:border-primary">
              <h2 className="mb-2 text-xl font-semibold">AI Interview</h2>
              <p className="text-sm text-text-secondary">
                Run behavioral/coding/system-design interview turns with feedback.
              </p>
            </Card>
          </Link>
        </div>
      </PageShell>
    </Protected>
  );
}
