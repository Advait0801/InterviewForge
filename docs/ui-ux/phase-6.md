# UI Phase 6 - Interview flow and system-design feedback

**Goal:** Make the four-stage interview easier to follow and design feedback
easier to inspect and act on without changing the AI/API contracts.
**Status:** Complete; awaiting approval for Phase 7. **Completed:** 2026-09-19.

## What changed

- Interview setup now exposes selected company and difficulty states with a compact
  hierarchy. The active session has a labeled four-stage progress display, readable
  conversation, a multiline answer composer, and separate processing, recording,
  transcription, and voice-evaluation states.
- Answer submission preserves the draft until the accepted answer is confirmed in the
  transcript. If refresh fails or a POST outcome is uncertain, the next action only
  re-fetches the conversation; it cannot send the same answer twice. A newly created
  session whose first transcript fetch fails offers a retry without creating another
  session.
- Recording explains missing or denied microphone access, appends a successful
  transcript to the draft, and stops media tracks after recording or unmount. Existing
  voice evaluation remains available once audio exists.
- Completed sessions retain the transcript, stage scores, strengths, weaknesses,
  recommendations, and PDF export. Report errors are visible and retryable.
- System-design setup has labeled, selected prompt/company controls and durable
  analysis and voice errors. A failed analysis preserves the prompt and explanation.
  Results offer both **Edit design** (preserve draft) and **Try another** (clear it).
- The architecture diagram is full-width and theme-aware: horizontal on wide screens,
  vertical on narrow website widths, with larger labels and nonanimated edges under
  reduced motion. An expandable component/connection list is its text equivalent;
  empty diagrams have an explicit state. Feedback tabs expose selection semantics,
  and rubric scores have accessible values.
- Removed page-wide entrance motion from both active workspaces and kept interview
  autoscroll inside the conversation pane rather than moving the entire page.

## Three iterations

### Iteration 1 - Hierarchy and interaction state

Reworked interview setup, stage progress, conversation, composer, answer reconciliation,
recording and report states. Reorganized system-design setup and results, then added
explicit failure/retry handling and a full-width diagram with a text alternative.

### Iteration 2 - Challenge flows and narrow layouts

Added nine focused tests covering setup selection, start and initial-transcript
failures, multiline answers, follow-up and four-stage progression, accepted-answer
refresh failure without duplicate POST, microphone unavailable/denied, transcription,
voice evaluation, report PDF access, design analysis retry with draft retention,
theme/reduced-motion graph behavior, empty diagram, rubric, risks, and improvements.

The deterministic Chrome matrix covered both routes and themes at 320, 390, 768,
1024, and 1440 CSS pixels. The first visual review found entrance animations leaving
work surfaces dim during transitions and a diagram squeezed into one desktop column.
Removing the page motion and using horizontal desktop layout resolved both findings.

### Iteration 3 - Audit, repair, and final verification

The audit added recovery for a session created before its first transcript could load,
kept the conversation pane's autoscroll local, stopped microphone tracks on unmount,
and split **Edit design** from **Try another**. The final Chrome run recorded 43
observations and 12 unique screenshots, with zero page overflow, clipped visible
controls, nested interactive controls, page exceptions, or failed requests.

A deterministic five-answer run included a behavioral follow-up, all four stages,
report generation, and an actual Chrome PDF download. A 503 design-analysis fixture
recovered without losing the explanation; an empty diagram rendered its explicit
state. Keyboard activation and a 360 CSS-pixel reflow proxy covered the layout space
of a 720-pixel window at 200% browser zoom. Lint, TypeScript, all 48 tests, and an
isolated production build passed after the final repairs.

## Verification results

| Check | Result |
|---|---|
| Web tests | 10 files, 48 tests passed |
| Web lint and TypeScript | Passed with no diagnostics |
| Isolated production build | Passed; no additional live web port |
| Browser matrix | 43 observations, both themes, 320-1440 CSS pixels |
| Screenshots | 12 files; 12 unique SHA-256 hashes |
| Layout and diagnostics | 0 overflow, clipped controls, nested interactive controls, page errors, or failed requests |
| Interview | 5 answers, 4 stages, 1 follow-up, report displayed, PDF downloaded |
| System design | 503 retry, preserved draft, empty diagram, full graph, semantic feedback tabs |
| Keyboard and motion | Enter activated setup controls; 0 infinite animations with reduced motion |
| Local API contract | Interview list 200; empty design validation 400 |

## Evidence

| Evidence | Contents |
|---|---|
| [browser-phase6.json](evidence/phase-6/browser-phase6.json) | Route matrix, flow, recovery, zoom proxy, and diagnostics |
| [checks.txt](evidence/phase-6/checks.txt) | Final command and integration outcomes |
| [screenshot-sha256.txt](evidence/phase-6/screenshot-sha256.txt) | Hashes for all 12 screenshots |

The evidence directory also contains the screenshots. `capture-phase6.mjs` is the
reproducible browser harness. The user-facing website remains on port 3002 only.
With the local web and API services running, install Playwright in a temporary
directory and run it from the repository root:

```sh
npm install --prefix /tmp/interviewforge-playwright playwright
PLAYWRIGHT_MODULE=/tmp/interviewforge-playwright/node_modules/playwright/index.mjs node docs/ui-ux/capture-phase6.mjs
```

The harness creates a disposable QA account and rewrites the browser JSON,
screenshots, and checksum manifest together.

## Material limits

- The final four-stage interview, report, design feedback, error, and empty states used
  deterministic browser fixtures. The local API was checked with authenticated list
  and validation requests, but a real paid interview run was not performed.
- Two diagnostic design-analysis requests unintentionally reached the local AI service
  before the Playwright route pattern was fixed. Both returned 200 (about 32 and 7
  seconds). The final matrix intercepted every interview route and made no further AI
  calls. They are not represented as fixture results or as a full integration test.
- Microphone success and denial were exercised with component-level mocks. Real device
  capture and browser permission UX vary by host and were not asserted in Chrome.
- The 200% check is a layout-space proxy at 360 CSS pixels, not an operating-system
  accessibility audit. The browser matrix does not certify every screen reader.
- No before/after production timing comparison was retained. The user's one-live-port
  request was respected; the production build ran in isolation without opening a port.
- The backend has no idempotency key for interview answers. After an ambiguous POST
  failure, the UI conservatively blocks another send and refreshes the transcript;
  if the server never records that answer, the user may need to restart the session.

**Commit title:** `feat(ui): clarify interview flow and design feedback`.

**Checkpoint:** Phase 7 covers remaining screens and the final regression review.
It begins only after explicit user approval.
