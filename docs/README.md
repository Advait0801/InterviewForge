# Documentation

All project documentation lives here, except two files that must stay at the repo root:

- **`/README.md`** — public-facing overview; GitHub only renders the root one.
- **`/CLAUDE.md`** — Claude Code auto-discovers this at the root. Moving it here would
  mean it never gets loaded.

## Index

| Doc | What it's for |
|---|---|
| [`DECISIONS.md`](DECISIONS.md) | Running log of decisions and findings. **Append as we go.** |
| [`EXECUTION_PLAN.md`](EXECUTION_PLAN.md) | **Start here.** The active plan — phases, goals, iteration loops, exit criteria, and the parked backlog |
| [`INTERVIEW_NOTES.md`](INTERVIEW_NOTES.md) | Deep explain-it-out-loud walkthrough of every subsystem |
| [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) | Original product spec and long-term vision |

## Conventions

- `DECISIONS.md` is append-only. New entries at the top, dated, never rewrite history —
  a superseded decision gets a new entry that says what replaced it.
- `EXECUTION_PLAN.md` holds both the scheduled phases and the parked backlog. Its progress
  table is updated at each phase pause; completed items get cross-referenced from
  `DECISIONS.md` when the work actually lands.
