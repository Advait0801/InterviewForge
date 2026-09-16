# InterviewForge UI/UX improvement plan

**Status:** Phases 0–4 complete. Awaiting user approval for Phase 5; later phases have not started.
**Prepared:** 2026-09-14
**Reviewed baseline:** `main` at `a9c3fef`; working tree was clean before this document.
**Working branch:** `feat/ui-ux-polish` (created in Phase 0; one branch for all phases)
**Direction:** Keep InterviewForge recognizable; make practice clearer, calmer, and more attractive.

The user delegated the visual direction, requested a separate branch in Phase 0,
at least three iterations per phase, a commit after each completed phase, and an
explicit confirmation before proceeding to the next phase. Sub-agents are allowed.

## 1. Project understanding and findings

InterviewForge combines AI mock interviews, 150 coding problems in four languages,
timed assessments, learning paths, system-design feedback, and progress tracking.
The frontend is Next.js 16 / React 19 / Tailwind 4. Framer Motion, Recharts, React
Flow, and Monaco are already installed. Express owns data and orchestration;
FastAPI owns AI. This work primarily belongs in `web/`.

Reviewed the repository guidance, previous execution plan and decisions, recent
commit history, shared UI components, frontend routes, and CI configuration. A
read-only sub-agent independently audited the core practice/interview flows.

### Evidence that shapes the plan

| Finding | Source | Planned response |
|---|---|---|
| Indigo/cyan accents, Inter/JetBrains Mono, light/dark tokens, glass cards, and motion already define the identity | `web/src/app/globals.css`, `app/layout.tsx`, `components/ui/` | Refine the existing system and reduce competing visual emphasis |
| Eight navigation links plus account controls appear from the `md` breakpoint; menu lacks expanded/current-page semantics | `components/layout/navbar.tsx` | Verify intermediate widths; simplify grouping, clarify “OA,” and improve keyboard/mobile navigation |
| Repeated entrance variants and infinite CSS decoration have no shared reduced-motion policy | `app/globals.css`, page components | Centralize motion rules and support reduced motion across CSS, charts, diagrams, and editor settings |
| All problem rows stagger by index at 0.04 seconds each; the final rows can wait roughly six seconds | `app/problems/page.tsx` | Cap entrance staggering; keep the full catalogue immediately usable |
| A bookmark button is nested inside a problem link; landing CTAs nest buttons inside links | `app/problems/page.tsx`, `app/page.tsx` | Separate actions and use the correct interactive element |
| Dashboard swallows some failures; analytics errors can become “No data yet” | `app/dashboard/page.tsx`, `app/analytics/page.tsx` | Distinguish loading, empty, error, and partial success; offer local retry |
| Heatmap details only respond to mouse hover; analytics tooltips use hardcoded dark colors | `components/ui/activity-heatmap.tsx`, `app/analytics/page.tsx` | Add accessible data summaries and keyboard/touch access; theme charts consistently |
| Workspaces use fixed-height toolbars and dense split panes; shared Monaco editor forces a dark theme | `app/problems/[id]/page.tsx`, `app/assessments/[id]/page.tsx`, `components/code-workspace-editor.tsx` | Responsive work areas and toolbars; deliberate editor theming and focus behavior |
| Interview answers use a single-line field; voice and submission actions need clearer states | `app/interview/page.tsx` | Multiline composer, clear recording/evaluating states, and stronger stage hierarchy |
| System-design diagrams already exist, with animated edges | `app/system-design/page.tsx` | Improve the existing diagram's readability, navigation, and connection to feedback |
| CI currently blocks on web lint; no frontend test script exists | `.github/workflows/ci.yml`, `web/package.json`, decision D-031 | Preserve blocking lint; introduce focused behavioral checks where they protect meaningful interactions |

**Initial audit limits:** The planning audit was source-based; browser access was
unavailable. Phase 0 subsequently established user-authorized Playwright access to
the running app on port **3002**. See [the baseline report](ui-ux/phase-0.md) for
actual browser findings, screenshots, and verification limits.

**Existing discrepancies to keep visible:** the repository guidance's lint-exception
note is stale (D-031 and CI show it was fixed). The interview UI offers four companies
while the platform supports ten. Resume APIs exist without an upload UI. These are
separate feature/documentation decisions, not implicit additions to this visual pass.

## 2. Visual direction and scope

### A polished technical workspace

- Retain the logo, indigo/cyan identity, fonts, and both themes.
- Use stronger heading hierarchy, consistent spacing, quieter borders, and fewer
  competing gradients. Give the primary next action the most emphasis.
- Keep working screens calm and dense enough for practice. Make empty screens
  useful with a concise explanation and a relevant action.
- Add one signature landing visual: a small isometric “interview workspace” with
  code, conversation, and architecture panels connected through the four stages.
  Build it with existing HTML/CSS/SVG and restrained motion. Clearly label any
  example content as a preview; it must not resemble actual user scores.
- Prefer useful visualizations: readable progress, topic distribution, the existing
  activity heatmap, interview stages, and system-design relationships.
- Use short state transitions (roughly 150–250 ms), occasional section reveals
  (roughly 250–400 ms), and capped staggering. Final timing is tuned in-browser.
  Avoid delayed controls, repeated page-wide reveals, or decorative movement while
  someone is coding, answering, or taking an assessment.
- Respect reduced motion, touch input, keyboard navigation, and readable contrast.
  Static decoration and visible status text must work without animation.

### Boundaries

Preserve existing routes, API contracts, authentication, scoring, interview stage
transitions, code execution, persistence, and report export. Keep backend and AI
changes out unless a concrete UI blocker requires a separately explained adjustment.
Do not invent readiness scores or progress metrics the product cannot support.

A WebGL/Three.js scene, new design-system package, new AI features, company expansion,
resume upload, backend backlog fixes, and deployment are not scheduled here. A small
CSS/SVG illustration gives the requested depth without committing the app to a 3D
runtime. Reconsider only if the reviewed visual result needs it.

## 3. Working agreement

### Approval and branching

1. Save and review this plan first. Ask for approval to begin **Phase 0 only**.
2. Phase 0 creates `feat/ui-ux-polish` from the checked local `main` baseline before
   any feature edits. Carry this draft onto that branch and commit it there.
3. Work on only the approved phase. After its checks pass, update evidence, commit,
   report the result and any remaining issues, and **pause for explicit approval**.
4. Feedback at a checkpoint is handled before advancing. If a completed phase needs
   a follow-up fix, record and commit it transparently; do not rewrite history.
5. Use this single feature branch for all phases, with separate phase commits.
   Do not create per-phase branches or PRs, or merge intermediate phases into `main`.
6. After the entire plan is complete and the user accepts the final phase checkpoint,
   push the feature branch and create **one PR into `main`** covering all phases.
   Include the final scope, verification evidence, and any remaining limitations.
   Review the PR and required CI checks, resolve any findings, then merge it into
   `main`. Verify the merge and report the PR link and merge commit. Deployment is
   outside this plan.

This document governs the UI workstream's phase numbers, branch, and co-author.
`docs/EXECUTION_PLAN.md` remains the historical platform plan; do not restart its
completed phases or inherit its old branch/Claude co-author. Phase 0 will link the
new workstream from the docs index and clarify that relationship.

### Minimum three iterations per phase

Every phase has a concrete goal and follows this loop:

| Iteration | Required work | Evidence |
|---|---|---|
| 1 — Implement and check | Establish the phase baseline, implement a cohesive first pass, run appropriate static checks and a focused behavior/visual check | Changes, command results, initial screenshots or documented observations |
| 2 — Challenge and repair | Exercise normal, empty, failed, slow, keyboard, narrow-screen, and reduced-motion cases relevant to the phase; fix discovered problems | Reproducible findings, repairs, checks run against the repaired code |
| 3 — Refine and verify | Inspect the final result, simplify, rerun affected checks after fixes, and verify phase exit criteria | Final command results, before/after evidence, unresolved issues explicitly listed |

For Phase 0, these iterations apply to branch setup, baseline collection, and audit
reconciliation. Do not invent code changes just to fill an iteration. Three is a
minimum: continue with iteration 4+ whenever a required check still fails. Repeated
identical commands alone do not constitute three meaningful iterations.

Store one report per phase at `docs/ui-ux/phase-N.md`, with goal, iteration entries,
environment, commands and exit results, screenshots where available, findings, and
exit-criteria status. Keep screenshots free of personal information or credentials.
Link non-obvious decisions to new entries in `docs/DECISIONS.md`.

### Verification standards

- Web checks: `cd web && npm run lint`, `npx tsc --noEmit`, and `npm run build`.
  Run equivalent commands in an isolated environment if necessary; a production
  build must not overwrite the live dev server's `.next` output. Do not run competing
  build/type-generation commands against the same output directory.
- Record existing failures separately. A new regression blocks completion; a missing
  environment dependency is “blocked,” never “passed.” Phase 0 establishes the baseline.
- Browser review: 390 px phone, 768 px tablet, 1024 px intermediate desktop, and
  1440 px desktop; include a 320 px overflow check, both themes, keyboard-only use,
  reduced motion, and 200% zoom for changed layouts. Panes/canvases may scroll locally;
  the whole page must not hide clipped controls behind `overflow-x: hidden`.
- Add behavioral tests for high-risk changes such as bookmark actions, filter state,
  editor state retention, timer completion, and request-state transitions. Choose
  the smallest suitable frontend harness in Phase 0; wire it in during the first
  phase that needs it. Avoid snapshots or tests that simply mirror styling classes.
- UI fixtures should cover deterministic AI responses and errors. Unit tests must
  never call paid models. Separately verify real local integration where needed;
  mocked responses do not certify the backend or AI pipeline.
- Preserve the real Run/Submit paths with focused local sandbox checks when workspace
  behavior changes. Do not rerun all 600 problem/language checks for cosmetic edits.
- Measure representative production routes before and after using the same viewport,
  data, cache state, and tool. Record initial JS, layout shift, and interaction/loading
  measurements where available. Target no new layout shift from decoration or loading
  states and no unexplained >10% relative regression in measured load/interaction time.
  Investigate noise with repeated samples; do not claim a score from a dev build.
- Sub-agents may independently review bounded work or disjoint components. The primary
  agent integrates, verifies, and enforces the phase gate. No agent starts a later phase.

### Commit format

Match the recent conventional commits: imperative title up to 72 characters, a body
explaining the problem, final change, verification, and applicable decision/finding IDs.
Use the configured human author and this assistant as co-author:

```text
feat(ui): refine navigation and shared interaction states

Complete UI Phase 1 by clarifying navigation and standardizing focus,
surface, loading, and motion behavior across shared components.

Verification: describe the actual three iterations and final check results.
Evidence: docs/ui-ux/phase-1.md. Reference decision IDs when applicable.

Co-Authored-By: GPT-5.6 Sol <noreply@openai.com>
```

Aim for one coherent commit per completed phase. Stage only the phase's files;
inspect the staged diff and final commit, and report the commit hash at the pause.
Do not claim verification that was not performed.

## 4. Phases

### Phase 0 — Separate branch and trustworthy baseline

**Goal:** Isolate the work and establish what the existing app actually looks like
and how it behaves before changing it.

**Scope:** Create `feat/ui-ux-polish`; commit the approved plan and documentation
links; inventory routes and key states; establish browser/test access and baseline.

1. **Iteration 1:** Check working tree and branch collisions; create the feature
   branch without overwriting user work. Set up the evidence report and route matrix.
2. **Iteration 2:** Run baseline lint/typecheck/build; capture public and authenticated
   screens in both themes at representative widths. Use a dedicated local QA account
   or an available authorized test session. Record runtime, keyboard, and layout issues.
3. **Iteration 3:** Reconcile source findings against the actual UI, verify evidence
   and reproducible commands, select the focused testing approach, and refine scope.

**Exit:** Correct branch; indexed plan; baseline checks and screenshots recorded;
existing defects separated from new work; browser verification available. If browser
access is still unavailable, report the blocker and leave Phase 0 incomplete.

**Commit:** `chore(ui): establish the UI polish branch and baseline`

**Checkpoint:** Report baseline and any proposed scope changes; pause for Phase 1 approval.

### Phase 1 — Shared design, navigation, and motion foundations

**Goal:** Make every page feel consistent and make every shared control easy to use.

**Scope:** `globals.css`, shared UI components, `layout.tsx`, `page-shell.tsx`,
`navbar.tsx`, `auth/protected.tsx`, theme/motion integration, and focused test setup
where needed. Phase 0 confirmed authenticated reload hydration mismatches; align
the auth guard's initial server/client render while preserving access behavior.
Refine tokens, spacing and surfaces; distinguish static and interactive cards;
create consistent focus, busy, disabled, error, empty, and skeleton patterns.
Keep familiar routes, clarify “OA” as “Assessments,” and make navigation fit its width.

1. **Iteration 1:** Implement tokens, shared states, navigation, and motion helpers.
2. **Iteration 2:** Test menu open/close, Escape and focus behavior, active nested
   routes, signed-in/out controls, theme persistence, reduced motion, and widths.
3. **Iteration 3:** Fix shared regressions, review representative pages and both
   themes, rerun behavioral checks, lint, typecheck, and build.

**Exit:** Navigation fits; focus is visible; shared controls have clear semantics;
motion respects preferences; representative existing pages remain functional.

**Commit:** `feat(ui): refine navigation and shared interaction states`

**Checkpoint:** Show the foundation in both themes; pause for Phase 2 approval.

### Phase 2 — Landing page and onboarding polish

**Goal:** Explain the product quickly and make starting practice feel inviting.

**Scope:** Home, login, register, forgot/reset password, and email verification
screens. Add the isometric workspace preview, a concise four-stage explanation,
clear primary/secondary actions, cohesive forms, labels, and recovery messages.

1. **Iteration 1:** Implement responsive hero/preview and form hierarchy using the
   shared system; fix nested CTA elements.
2. **Iteration 2:** Verify signed-in/out destinations, form validation and pending/
   failure/success states, keyboard order, narrow layouts, and static reduced-motion view.
3. **Iteration 3:** Tune contrast and visual density, verify that decoration causes
   no layout shift or blocked interactions, and rerun appropriate checks.

**Exit:** Product purpose and next action are immediately clear; onboarding behavior
is preserved; the preview is legible on desktop and simplifies cleanly on phones.

**Commit:** `feat(ui): polish the landing and authentication experience`

**Checkpoint:** Review the visual direction in the running app; pause for Phase 3 approval.

### Phase 3 — Dashboard and useful progress visualizations

**Goal:** Help users understand their progress and choose the next practice action.

**Scope:** Dashboard, analytics, and activity heatmap. Prioritize a clear next action,
supporting stats, recent activity and recommendations. Refine existing charts with
theme-aware styling, readable labels, units, legends, and accessible summaries.
Provide honest loading/empty/error/partial states and local retries.

1. **Iteration 1:** Implement information hierarchy and chart/heatmap improvements.
2. **Iteration 2:** Check new users, active users, sparse/large data, endpoint failures,
   partial success, tooltip keyboard/touch access, and totals against supplied data.
3. **Iteration 3:** Repair inconsistencies, verify theme and mobile legibility,
   confirm that retries do not refetch unrelated panels, and rerun checks.

**Exit:** Failed requests never masquerade as zero progress; visualization values
match source data; key progress details are available without hover or color alone.

**Commit:** `feat(ui): clarify dashboard progress and analytics`

**Checkpoint:** Show populated, empty, and failed states; pause for Phase 4 approval.

### Phase 4 — Practice discovery and learning paths

**Goal:** Make finding a suitable problem quick, scannable, and predictable.

**Scope:** Problem catalogue and learning path list/detail. Improve row density,
filter grouping, clear/reset affordances, result counts, selected-state semantics,
bookmark independence, and path progression. Preserve company-tag caveats and
existing filter meaning. Cap stagger delays irrespective of catalogue size.

1. **Iteration 1:** Implement discovery layouts, accessible filter controls, and
   distinct link/bookmark actions; reuse established path progress data.
2. **Iteration 2:** Exercise combined company/topic/difficulty/search/solved filters,
   bookmarks, no matches, failed loads, keyboard use, and all 150 rows.
3. **Iteration 3:** Refine phone layouts and long titles/tags, verify counts and
   navigation against the real catalogue, and rerun affected tests/static checks.

**Exit:** Filtering remains correct, bookmarks do not navigate, path links work,
and list animation never delays access to late results.

**Commit:** `feat(ui): streamline problem discovery and learning paths`

**Checkpoint:** Demonstrate filter/bookmark/path flows; pause for Phase 5 approval.

### Phase 5 — Coding and timed assessment workspaces

**Goal:** Keep the problem, editor, results, and primary actions usable under pressure.

**Scope:** Problem detail, shared Monaco editor, assessment setup/list/detail/results.
Improve toolbar hierarchy, responsive panes, console/result tabs, editor theming,
loading/error recovery, timer readability, and assessment progress. Adapt navigation
between panes on small screens without remounting and losing active work.

1. **Iteration 1:** Implement workspace layout and state presentation while preserving
   language selection, latest-submission restoration, console sizing, hints/editorials,
   AI review, per-problem assessment code, submission IDs, and completion behavior.
2. **Iteration 2:** Run focused sandbox Run/Submit flows with passing/failing code;
   verify language changes, problem switches, pane resizing/keyboard access, long
   output, errors, and read-only completion. Test timer expiry and in-flight submission
   behavior with deterministic clock/network controls.
3. **Iteration 3:** Repair regressions and verify all four language selections,
   deadline behavior, reduced-motion urgency, and mobile toolbar reachability.
   Repeat affected integration tests and the web checks.

**Exit:** Code and supported restored state survive layout/theme changes; actions
stay reachable; assessment time/scoring semantics and Run/Submit results are preserved.
No decorative motion distracts during active work.

**Commit:** `feat(ui): refine coding and assessment workspaces`

**Checkpoint:** Demonstrate real execution and timer evidence; pause for Phase 6 approval.

### Phase 6 — Interview flow and system-design feedback

**Goal:** Make a multi-stage interview easy to follow and its feedback easy to act on.

**Scope:** Interview setup/session/report and system-design setup/analysis. Refine
selection states, stage progression, conversation readability, multiline composer,
send/record/evaluate states, report hierarchy, diagram labels/controls, and feedback
grouping. Preserve citations, transcript, scoring, and PDF export access.

1. **Iteration 1:** Implement hierarchy and interaction states with existing contracts.
2. **Iteration 2:** Exercise four-stage progression, follow-ups, long answers,
   pending/error/retry cases, missing/denied microphone access, completed reports,
   diagram empty/dense/error responses, and export using deterministic fixtures.
3. **Iteration 3:** Check actual local API compatibility and a bounded end-to-end
   integration smoke where available; refine mobile and keyboard behavior; rerun
   affected checks. Record whether any live AI calls were used and what remains mocked.

**Exit:** Users can identify the current stage and next action; retry does not lose
an answer or duplicate a submission; voice controls explain unavailable states;
diagrams and feedback remain understandable with motion disabled.

**Commit:** `feat(ui): clarify interview flow and design feedback`

**Checkpoint:** Review the full flow and integration evidence; pause for Phase 7 approval.

### Phase 7 — Remaining screens and final regression review

**Goal:** Deliver a cohesive experience across the full product, ready for user review.

**Scope:** Leaderboard, public profile, settings, route error boundaries, and any
remaining shared-state inconsistencies. Finish visual consistency, responsive,
accessibility, and performance review. Preserve profile/avatar/account behavior.

1. **Iteration 1:** Polish secondary pages and address inconsistencies found in the
   route matrix. Verify settings validation, ranking display, and missing profiles.
2. **Iteration 2:** Run the full route/state matrix across themes and representative
   widths; check keyboard, reduced motion, zoom, loading failures, and production
   performance against Phase 0. Run focused frontend behavioral and integration suites.
3. **Iteration 3:** Fix the remaining regressions, capture final before/after evidence,
   rerun impacted checks and clean lint/typecheck/build, and reconcile the final diff
   against scope. Record final limitations rather than hiding them in a green summary.

**Exit:** All phase criteria met; no introduced functional regressions or unresolved
critical accessibility/layout failures; performance changes explained; evidence and
decisions indexed; final commit reviewed and branch ready for the user's inspection.

**Commit:** `feat(ui): complete interface polish and regression review`

**Checkpoint:** Final demo, verification summary, and commit list. Pause for user
acceptance as required after every phase. Then follow the agreed delivery sequence:
push the single feature branch, create one PR, review and pass required CI, merge
into `main`, and verify the merge.

## 5. Progress and checkpoint format

| Phase | State | Goal/evidence | Commit | Approval to advance |
|---|---|---|---|---|
| 0 | Complete | [Branch and baseline](ui-ux/phase-0.md) | `chore(ui): establish the UI polish branch and baseline` | Approved |
| 1 | Complete | [Shared UI foundation](ui-ux/phase-1.md) | `feat(ui): refine navigation and shared interaction states` | Approved |
| 2 | Complete | [Landing and onboarding](ui-ux/phase-2.md) | `feat(ui): polish the landing and authentication experience` | Approved |
| 3 | Complete | [Dashboard and analytics](ui-ux/phase-3.md) | `feat(ui): clarify dashboard progress and analytics` | Approved |
| 4 | Complete | [Practice discovery and learning paths](ui-ux/phase-4.md) | `feat(ui): streamline problem discovery and learning paths` | Pending |
| 5 | Not started | Workspaces | — | Pending |
| 6 | Not started | Interview/design feedback | — | Pending |
| 7 | Not started | Completion/regression | — | Pending |

Each checkpoint reports: goal achieved, visible changes, evidence from at least three
iterations, test results, surprises/limitations, commit hash, and the next phase's
scope. Then ask for explicit confirmation and stop. Questions that materially change
scope are raised early; routine design/implementation decisions use this plan.

**Plan approval:** User approved the plan and Phase 0 with “got it go,” approved
Phase 1 with “yoo lets do phase1,” Phase 2 with “go phase2,” Phase 3 with
“go phase3,” and Phase 4 with “go conontue.” Approval for Phase 5 is pending at
this checkpoint.
