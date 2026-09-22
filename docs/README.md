# Documentation

All project documentation lives here, except two files that must stay at the repo root:

- **`/README.md`** — public-facing overview; GitHub only renders the root one.
- **`/CLAUDE.md`** — Claude Code auto-discovers this at the root. Moving it here would
  mean it never gets loaded.

## Index

| Doc | What it's for |
|---|---|
| [`DECISIONS.md`](DECISIONS.md) | Running log of decisions and findings. **Append as we go.** The record of what was built and why |
| [`BACKLOG.md`](BACKLOG.md) | What is deliberately not built yet, and the verification rounds still to run |
| [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) | Original product spec and long-term vision |
| [`eval/`](eval) | Retrieval evaluation results per phase, with the raw JSON behind each number |
| [`ui-ux/phase-0.md`](ui-ux/phase-0.md) | UI baseline, route/state matrix, verification evidence, and test approach |
| [`ui-ux/phase-1.md`](ui-ux/phase-1.md) | Shared UI, navigation, motion, authentication hydration, and browser verification evidence |
| [`ui-ux/phase-2.md`](ui-ux/phase-2.md) | Landing, authentication, onboarding-flow, contrast, and production-browser evidence |
| [`ui-ux/phase-3.md`](ui-ux/phase-3.md) | Dashboard hierarchy, honest resource states, accessible analytics, and heatmap evidence |
| [`ui-ux/phase-4.md`](ui-ux/phase-4.md) | Problem discovery, bookmark semantics, learning-path progression, and 150-row evidence |
| [`ui-ux/phase-5.md`](ui-ux/phase-5.md) | Coding and timed-assessment workspaces, persistent responsive panes, timer safety, and real execution evidence |
| [`ui-ux/phase-6.md`](ui-ux/phase-6.md) | Four-stage interview, transcript recovery, voice controls, PDF export, and system-design feedback evidence |
| [`ui-ux/phase-7.md`](ui-ux/phase-7.md) | Leaderboard, public profile, settings, route recovery, full route matrix, and final performance evidence |

## History

Both phase plans were retired on 2026-09-20 once their workstreams merged — the platform
plan (`EXECUTION_PLAN.md`, phases 0–7) and the UI plan (`UI_UX_PLAN.md`, UI phases 0–7).
They remain in git history at `4083f5e`. Their still-relevant remainder — parked ideas and
the two unrun verification rounds — is in [`BACKLOG.md`](BACKLOG.md); everything they
delivered is recorded in [`DECISIONS.md`](DECISIONS.md) as D-001 through D-052.

## Conventions

- `DECISIONS.md` is append-only. New entries at the top, dated, never rewrite history —
  a superseded decision gets a new entry that says what replaced it.
- `BACKLOG.md` is the opposite: it only holds what hasn't happened. When something there
  ships, delete it from the backlog and write the decision entry instead.
- UI phase reports in `ui-ux/` are historical evidence, not living documents. The capture
  scripts beside them are re-runnable against a local stack.
