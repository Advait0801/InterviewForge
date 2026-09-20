# UI Phase 5 - Coding and timed-assessment workspaces

**Goal:** Keep problems, code, results, assessment progress, and primary actions
usable under pressure without changing execution or completion contracts.
**Status:** Complete; awaiting approval for Phase 6. **Completed:** 2026-09-17.

## What changed

- Reworked problem detail into a stable two-pane workspace with a calmer toolbar,
  persistent Monaco instance, accessible information and console tabs, keyboard-
  resizable results, durable execution failures, and explicit load/retry states.
- Added a responsive website pane switcher below 768 CSS pixels. Problem and editor
  panes are hidden with CSS rather than conditionally unmounted, so switching at a
  narrow browser width does not discard code, selection, console output, or Monaco
  state. No native mobile application is in scope.
- Preserved a draft per language and restored the latest saved submission for the
  selected language. Superseded problem/detail requests can no longer overwrite a
  newer route or language choice.
- Made Monaco follow the site theme, improved selection/cursor/guide contrast, stopped
  it from stealing focus on mount, and disabled smooth scrolling and cursor animation
  when reduced motion is requested.
- Rebuilt assessment setup and history around labeled choices, a concise configuration
  summary, clear loading/error/empty states, local retry, creation feedback, and useful
  active/completed history actions.
- Reworked the timed workspace with visible progress, a readable deadline, per-problem
  and per-language drafts, restored linked submissions, result/test-case tabs, partial
  problem recovery, and durable run, submit, and completion errors.
- Derived the timer from an absolute deadline instead of decrementing an interval.
  Expiry submits once, waits for an in-flight problem submission and its assessment
  link, preserves submission IDs, and offers an explicit retry if completion fails.
- Reframed completed assessments as a scannable score summary with solved, attempted,
  and unattempted outcomes and a direct route back to assessment setup.

## Three iterations

### Iteration 1 - Hierarchy, responsive workspace, and state

Implemented the shared pane switcher and theme-aware editor, then rebuilt problem and
assessment toolbars, panes, consoles, timers, setup, history, and results. Existing API
contracts remained unchanged. The problem workspace gained latest-submission recovery
per language; assessments gained draft keys per problem/language and restored linked
submission code.

### Iteration 2 - Challenge normal and adverse behavior

Added 11 focused component/workspace tests within a 39-test suite. They cover loading,
empty, error/retry, setup choices, language restoration, execution errors, pane state
retention, keyboard resizing, assessment submission linkage, timeout ordering, editor
theme, and reduced motion.

The self-asserting Chrome harness used a disposable local QA account and the real local
problem catalogue, runner, submission persistence, assessment linking, and completion
services. It checked both themes at 320, 390, 768, 1024, and 1440 CSS pixels. Explicit
fixtures were limited to named error, empty, and shortened-deadline scenarios. The
first runs found a clipped small-screen tab row and an early single-row breakpoint at
200% magnification; both were repaired with a compact grid through tablet widths.

### Iteration 3 - Audit, repair, and final visual review

The final code audit added request versioning to problem loads and cleared assessment
state when navigating to a different assessment, preventing stale responses or drafts
from replacing a newer route. It also verified that timeout completion waits for an
accepted in-flight submission.

Eleven screenshots were visually inspected across desktop and narrow website layouts,
light/dark Monaco, execution results, assessment work, explicit failure/retry, timeout
results, and 200% magnification. The final browser run recorded 32 observations with no
page overflow, clipped visible controls, nested interactive elements, page exceptions,
or failed requests. Lint, TypeScript, 39 tests, and an isolated production build were
rerun after the repairs.

## Verification results

| Check | Result |
|---|---|
| Web tests | 9 files, 39 tests passed |
| Web lint | Passed with zero warnings |
| Web TypeScript | Passed with no diagnostics |
| Isolated production build | Passed; all 18 static pages and dynamic routes emitted |
| Browser matrix | 32 observations, 320-1440 CSS pixels, both themes |
| Screenshots | 11 files; 11 unique SHA-256 hashes |
| Layout/semantics | 0 page overflows, clipped controls, or nested interactive controls |
| Browser diagnostics | 0 page errors or request failures |
| Real problem execution | Run 200/pass; Submit 201/pass; latest code restored |
| Learning surfaces | Hint, editorial, and unlocked AI-review action verified |
| Assessment persistence | Submission 201; assessment link 200; ID retained |
| Deadline | 1.2-second deterministic deadline; completion 200 after in-flight work |
| Accessibility | Keyboard split 38% to 43%; reduced-motion infinite animations: 0 |
| Magnification | 200% check had no horizontal overflow or clipped controls |

## Evidence

| Evidence | Contents |
|---|---|
| [browser-phase5.json](evidence/phase-5/browser-phase5.json) | Route matrix, integrations, recoveries, themes, motion, zoom, and diagnostics |
| [checks.txt](evidence/phase-5/checks.txt) | Final lint, typecheck, tests, build, browser, and service summary |
| [screenshot-sha256.txt](evidence/phase-5/screenshot-sha256.txt) | Hashes for all 11 screenshots |

The evidence directory contains all screenshots. `capture-phase5.mjs` is the
reproducible browser harness. The user-facing development website remains on port 3002.

## Material limits

- “Mobile” evidence means the responsive website at narrow browser widths. The native
  mobile client was removed earlier and was not recreated or tested.
- The deadline was shortened by replacing only the assessment-detail response's
  `remainingMs`; the submission, link, and final completion requests used real local
  services. Waiting an actual hour would not add coverage to the timer transition.
- Python was the real passing runner integration. All four language selections,
  starters, and restoration paths were checked, but C, C++, and Java were not each
  executed through their sandbox in this UI-focused phase.
- AI Review was verified as unlocked after a real submission, but no paid model call
  was made. Hints and editorial content were opened in the browser.
- The production build passed in isolation. A before/after production timing comparison
  was not retained after the user requested one live website port only, so this phase
  makes no performance-delta claim.
- The browser matrix and semantic checks are meaningful automated coverage, not a full
  assistive-technology certification.

**Commit title:** `feat(ui): improve coding and assessment workspaces`.

**Checkpoint:** Phase 6 will address the interview and system-design feedback flows.
It begins only after explicit user approval.
