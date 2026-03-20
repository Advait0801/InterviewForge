import Link from "next/link";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <PageShell>
      <section className="rounded-2xl border border-border bg-surface p-10">
        <h1 className="mb-4 text-4xl font-semibold">Practice real interviews. Ship better code.</h1>
        <p className="mb-8 max-w-2xl text-text-secondary">
          InterviewForge simulates real software engineering interviews with coding, system design, and behavioral
          rounds.
        </p>
        <div className="flex gap-3">
          <Link href="/register">
            <Button>Get Started</Button>
          </Link>
          <Link href="/login">
            <Button variant="ghost">Sign In</Button>
          </Link>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <Card>
          <h2 className="mb-2 text-lg font-semibold">AI Interview Simulation</h2>
          <p className="text-sm text-text-secondary">Company-style interviews with adaptive follow-up questions.</p>
        </Card>
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Coding Workspace</h2>
          <p className="text-sm text-text-secondary">Solve problems with editor, test execution, and runtime feedback.</p>
        </Card>
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Speech Feedback</h2>
          <p className="text-sm text-text-secondary">Record your explanation and receive structured communication feedback.</p>
        </Card>
      </section>
    </PageShell>
  );
}
