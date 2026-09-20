# UI route and state verification matrix

**Prepared:** 2026-09-14
**Scope:** All 19 `web/src/app/**/page.tsx` routes found during Phase 0 source review.
**Workstream:** UI/UX polish (plan retired 2026-09-20; see [DECISIONS](../DECISIONS.md) D-045 to D-052)

## Evidence boundary

This document is a **source inventory and planned verification checklist**, not a
record that every route or state has passed. The inventory was checked against the
route files, frontend authentication guards, `web/package.json`, existing Vitest
configuration, and `.github/workflows/ci.yml`. No application behavior, browser
interaction, or automated test execution is certified by this matrix.

Actual Phase 0 baseline checks, screenshots, command results, findings, and untested
states belong in [the Phase 0 report](phase-0.md) and its linked evidence. Later
phase reports should identify which rows and states were exercised and distinguish
real service responses from deterministic fixtures.

## Routes and planned checks

“Auth” describes the frontend access requirement. Some backend endpoints accept
optional authentication, but that does not make their guarded frontend pages public.
For every authenticated route, also check signed-out navigation to the login screen.

| Route | Access | Planned states and interactions | Owning UI phase |
|---|---|---|---|
| `/` | Public | Signed-out/in CTA destinations; responsive hero and preview; correct CTA semantics | 2 |
| `/login` | Public | Empty/invalid fields; password visibility; pending; failed login; successful dashboard navigation | 2 |
| `/register` | Public | Username/email/password validation; optional full name; pending; duplicate account; successful dashboard navigation | 2 |
| `/forgot-password` | Public | Empty email; pending; request failure; sent confirmation | 2 |
| `/reset-password` | Public | Missing token; invalid/expired token; short/mismatched passwords; pending; success navigation | 2 |
| `/verify-email` | Public | Default; `verified=1`; `error=invalid`, `missing`, `server`; dashboard link | 2 |
| `/dashboard` | Auth | New/populated user; stats/activity/recommendations independently slow or failed; partial data; heatmap details | 3 |
| `/analytics` | Auth | Loading; no activity; sparse/populated charts; request failure; readable tooltip/legend values and accessible summaries | 3 |
| `/problems` | Auth | Loading/failure; all 150 results; combined search/difficulty/topic/company/solved filters; no matches; independent bookmark pending/failure | 4 |
| `/paths` | Auth | Loading; populated/empty/failure; progress count; path navigation | 4 |
| `/paths/[slug]` | Auth | Loading; valid/not-found/request failure; zero/partial/full progress; problem links; navigation between slugs | 4 |
| `/problems/[id]` | Auth | Valid/missing problem; editor loading; language change; persisted code; tabs; Run/Submit pending/pass/fail/error; hints/editorials/bookmarks | 5 |
| `/assessments` | Auth | Setup choices; creation pending/failure; empty/populated/failed history; resume/results navigation | 5 |
| `/assessments/[id]` | Auth | Loading/missing assessment; partial problem-load failure; active timer/expiry; problem/language switching; retained code; Run/Submit; final submission/results | 5 |
| `/interview` | Auth | Setup; starting/failure; stage progression; answer pending/failure; recording/permission denial/transcription; completed report/loading/export | 6 |
| `/system-design` | Auth | Empty/invalid inputs; analysis pending/failure; recording/transcription; populated diagram; feedback tabs; pan/zoom; export | 6 |
| `/settings` | Auth | User loading/failure; avatar validation/upload/remove states; password validation/pending/failure/success | 7 |
| `/leaderboard` | Auth | Loading; empty/populated/failure; current-user row; first/last pagination; profile links | 7 |
| `/profile/[username]` | Public | Loading; populated/zero-activity profile; missing user/request failure; long names; avatar fallback | 7 |

The states above include desired verification cases where the current implementation
does not yet provide distinct UI. Their presence in the table does not imply that
the current page already handles them correctly.

## Shared browser checks

- Review changed layouts at 390, 768, 1024, and 1440 px; add a 320 px overflow check.
- Include light/dark themes, keyboard-only use, reduced motion, and 200% zoom.
- For Phase 1 shared changes, sample landing/login plus authenticated dashboard and
  catalogue. Later phases exercise their changed screens; Phase 7 reconciles the
  complete route/state matrix.
- Check menu open/close, Escape and focus behavior, nested active routes, signed-in/
  out controls, and theme persistence.
- Check local pane/canvas scrolling separately from page overflow. Confirm controls
  remain reachable, particularly in coding and assessment workspaces.
- Use a dedicated local QA account or authorized test session. Keep tokens, passwords,
  and personal data out of committed screenshots and logs.

## Focused frontend testing approach

### Existing baseline

`web/package.json` currently has lint/build scripts and no frontend test script or
test harness. Backend and code-runner already use Vitest; backend declares the
3.2.x line. CI runs Node 20, installs with `npm ci`, runs blocking web lint, invokes
`npm test --if-present`, then builds. This is a source finding, not a claim that CI
was run during this inventory.

### Component and behavior tests

Introduce the smallest useful harness during the first approved phase that needs
it, expected to be Phase 1:

- Vitest aligned with the existing repository version, `jsdom`, Testing Library
  React, `user-event`, and `jest-dom`; configure the `@/` alias explicitly.
- Add `npm test` as `vitest run`. The existing CI test step will pick it up without
  requiring browser installation. Review the CI comment that currently says web
  has no test script when adding the harness.
- Mock Next navigation, API methods, storage, and media queries deliberately.
  Unexpected network calls should fail tests; unit tests must never contact paid
  models or require credentials.
- Start with meaningful navigation/theme interaction checks. Add bookmark
  independence, combined filter behavior, request failure/retry transitions, timer
  completion, and editor-state retention tests only as those behaviors change.
- Use controlled promises and fake timers for slow requests and timer expiry.
  Avoid styling-class assertions and broad snapshot suites.

### Separate browser and integration verification

The user has authorized Playwright browser verification. Keep its results separate
from component tests and record the browser version, route/data setup, viewport,
theme, and actual checks in each phase report. Phase 0 browser tooling does not by
itself imply a committed Playwright CI suite or installed frontend test dependency.

Use the real browser for Monaco typing/focus, React Flow navigation, responsive
layout, media preferences, theme persistence, and readable charts. Deterministic
API fixtures can exercise AI/request errors without paid calls; label those checks
as fixture-backed. They do not certify backend or AI integration.

When workspace behavior changes, preserve focused real local Run/Submit checks
against the sandbox. Do not rerun all 600 problem/language combinations for purely
cosmetic edits. Record production performance only from a production build using
comparable data and measurement conditions, as required by the UI plan.
