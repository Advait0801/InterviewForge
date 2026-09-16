"use client";

import { motion } from "framer-motion";

const codeLines = ["function pairSum(nums, target) {", "  const seen = new Map();", "  // explain the tradeoff", "  return [left, right];", "}"];

export function InterviewWorkspacePreview() {
  return (
    <figure aria-labelledby="workspace-preview-title" className="relative mx-auto w-full max-w-2xl lg:max-w-none">
      <div className="absolute inset-8 rounded-full bg-gradient-to-r from-primary/25 via-secondary/15 to-accent/20 blur-3xl" aria-hidden />
      <div className="relative [perspective:1200px]">
        <motion.div
          initial={{ opacity: 0, y: 24, rotateX: 3, rotateY: -3 }}
          animate={{ opacity: 1, y: 0, rotateX: 0, rotateY: 0 }}
          transition={{ duration: 0.55, delay: 0.12 }}
          className="overflow-hidden rounded-[1.75rem] border border-border bg-surface/95 p-3 shadow-2xl shadow-primary/15 sm:p-4 lg:[transform:rotateX(3deg)_rotateY(-4deg)]"
        >
          <div className="flex items-center justify-between border-b border-border px-2 pb-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-error/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-warning/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-accent/80" />
            </div>
            <span className="rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
              Practice session
            </span>
          </div>

          <div className="grid gap-3 pt-3 sm:grid-cols-[1.25fr_0.75fr]">
            <section className="min-w-0 rounded-2xl border border-border bg-[#090d16] p-4 text-slate-200 shadow-inner" aria-label="Code editor preview">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-[11px] text-slate-400">solution.js</span>
                <span className="rounded-md bg-primary/15 px-2 py-1 text-[10px] font-medium text-primary-light">JavaScript</span>
              </div>
              <div className="space-y-2 font-mono text-[10px] leading-5 sm:text-xs">
                {codeLines.map((line, index) => (
                  <div key={line} className={index === 2 ? "text-slate-500" : index === 3 ? "text-cyan-300" : "text-slate-300"}>
                    <span className="mr-3 inline-block w-3 select-none text-right text-slate-600">{index + 1}</span>
                    {line}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                <span className="text-[10px] text-slate-400">All sample cases passed</span>
                <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_12px_var(--accent)]" aria-hidden />
              </div>
            </section>

            <div className="grid gap-3">
              <section className="rounded-2xl border border-border bg-background/70 p-4" aria-label="Coach conversation preview">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/12 text-primary" aria-hidden>✦</span>
                  <div>
                    <p className="text-xs font-semibold">Interview coach</p>
                    <p className="text-[10px] text-text-secondary">Follow-up prompt</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-text-secondary">
                  How would your approach change if memory were limited?
                </p>
                <div className="mt-3 flex items-end gap-1" aria-label="Audio response visualization">
                  {[8, 14, 20, 11, 17, 9, 15, 7].map((height, index) => (
                    <span key={index} className="w-1.5 rounded-full bg-gradient-to-t from-primary to-secondary" style={{ height }} />
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-background/70 p-4" aria-label="System design preview">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Architecture</p>
                <svg className="mt-3 h-16 w-full" viewBox="0 0 180 64" role="img" aria-label="Client connected to API and data store">
                  <defs>
                    <linearGradient id="preview-line" x1="0" x2="1">
                      <stop stopColor="var(--primary)" />
                      <stop offset="1" stopColor="var(--secondary)" />
                    </linearGradient>
                  </defs>
                  <path d="M42 32H72M108 32H138" stroke="url(#preview-line)" strokeWidth="2" strokeDasharray="4 4" />
                  <rect x="4" y="18" width="38" height="28" rx="8" fill="var(--surface-hover)" stroke="var(--border-hover)" />
                  <rect x="72" y="14" width="36" height="36" rx="10" fill="color-mix(in srgb, var(--primary) 14%, var(--surface))" stroke="var(--primary)" />
                  <rect x="138" y="18" width="38" height="28" rx="8" fill="var(--surface-hover)" stroke="var(--border-hover)" />
                  <text x="23" y="35" textAnchor="middle" fill="var(--text-secondary)" fontSize="8">Client</text>
                  <text x="90" y="35" textAnchor="middle" fill="var(--primary-light)" fontSize="8">API</text>
                  <text x="157" y="35" textAnchor="middle" fill="var(--text-secondary)" fontSize="8">Data</text>
                </svg>
              </section>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-1.5" aria-label="Four-stage interview preview">
            {["Code", "Explain", "Design", "Review"].map((stage, index) => (
              <div key={stage} className={`rounded-xl border px-2 py-2 text-center ${index === 1 ? "border-primary/40 bg-primary/10" : "border-border bg-background/60"}`}>
                <span className="block text-[9px] text-text-secondary">0{index + 1}</span>
                <span className="text-[10px] font-semibold sm:text-xs">{stage}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
      <figcaption id="workspace-preview-title" className="mt-4 text-center text-xs text-text-secondary">
        Illustrative workspace preview — example prompts, not user performance data.
      </figcaption>
    </figure>
  );
}
