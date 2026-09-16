"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

const practiceSteps = [
  "Work through a realistic prompt",
  "Explain decisions and tradeoffs",
  "Review feedback and improve",
];

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <PageShell>
      <div className="relative isolate flex flex-1 items-center py-4 sm:py-8">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <div className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-primary/10 blur-[110px] animate-blob" />
          <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-secondary/10 blur-[110px] animate-blob [animation-delay:2s]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-surface/80 shadow-2xl shadow-primary/[0.07] backdrop-blur-xl lg:grid-cols-[0.9fr_1.1fr]"
        >
          <aside className="relative hidden overflow-hidden border-r border-border bg-gradient-to-br from-primary/12 via-surface to-secondary/10 p-10 lg:flex lg:flex-col lg:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Focused practice
              </span>
              <h2 className="mt-6 text-3xl font-bold leading-tight tracking-tight">
                One account. Every interview round.
              </h2>
              <p className="mt-3 text-sm leading-6 text-text-secondary">
                Move from coding to communication and system design without losing your practice history.
              </p>
            </div>
            <ol className="mt-10 space-y-4">
              {practiceSteps.map((step, index) => (
                <li key={step} className="flex items-center gap-3 text-sm text-text-primary">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-xs font-bold text-primary">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </aside>

          <Card className="rounded-none border-0 bg-transparent p-6 shadow-none sm:p-9">
            <div className="mb-7">
              <Logo size={38} className="mb-5" decorative />
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
              <p className="mt-2 max-w-lg text-sm leading-6 text-text-secondary">{description}</p>
            </div>
            {children}
            {footer ? <div className="mt-6 border-t border-border pt-5 text-center text-sm text-text-secondary">{footer}</div> : null}
          </Card>
        </motion.div>
      </div>
    </PageShell>
  );
}
