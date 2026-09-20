# UI Phase 2 — Landing page and onboarding polish

**Goal:** Explain InterviewForge quickly and make starting or resuming practice feel
inviting, clear, and reliable. **Status:** Complete; awaiting approval for Phase 3.
**Completed:** 2026-09-15.

## What changed

- Rebuilt the landing page around one clear promise and primary action. Three concise
  capability cards and a semantic four-stage flow explain how coding, communication,
  and system-design practice fit together.
- Added a responsive, isometric-style interview workspace preview with code, coaching,
  and architecture panels. It uses existing HTML, CSS, and SVG, is explicitly labeled
  illustrative, and stays legible and static when reduced motion is requested.
- Removed nested button/link calls to action. Signed-out visitors receive registration
  and sign-in destinations; signed-in visitors receive a hydration-stable dashboard
  action.
- Added a shared authentication shell across login, registration, recovery, reset, and
  verification. Forms now have persistent labels and hints, inline errors, pending and
  disabled states, useful autofill metadata, and focus recovery after invalid input.
- Connected email token links to the existing backend verification endpoint. Added
  distinct success, invalid-token, missing-token, and server-failure outcomes with
  appropriate recovery actions. Password recovery confirms request acceptance without
  implying that local SMTP delivery occurred.
- Improved light-theme status and action colors after measured contrast checks. Made
  shared gradient buttons reusable by semantic links. Generated unique SVG gradient
  identifiers for every logo instance and marked decorative logos correctly.
- Added seven focused onboarding tests and one repeated-logo semantics test, bringing
  the frontend suite to 18 tests.

## Three iterations

### Iteration 1 — Build the landing and onboarding system

Implemented the landing hierarchy, illustrative workspace, four-stage explanation,
shared authentication shell, and all five authentication screens. Exported the shared
button styles so links can look like actions while retaining link semantics. Added
focused tests for landing destinations, hydration, validation focus, pending states,
API failures, recovery/reset states, verification states, URL encoding, and repeated
logo instances.

### Iteration 2 — Challenge every route and the real flow

An independent source audit found a broken verification path, nested CTA controls,
home hydration risk, incomplete labels and recovery states, low light-theme contrast,
and repeated SVG gradient identifiers. These findings were repaired before the final
browser run.

Playwright then covered home and authentication routes at 320, 390, 720, 768, 1024,
and 1440 CSS pixels in both themes. The run checked signed-in and signed-out actions,
validation focus, a delayed request's busy/disabled state, persistent 401 feedback,
overflow, clipped controls, nested interactive elements, reduced motion, contrast,
console errors, page errors, and hydration. A disposable account completed the real
local register → email verification → recovery → password reset → sign-in sequence.
Verification and reset tokens were read from local development backend logs only for
this synthetic flow and are absent from the evidence.

### Iteration 3 — Refine contrast, semantics, and production behavior

Visual review of desktop and phone screenshots led to final spacing and copy refinements.
The action gradient was moved into Tailwind's utility layer so its production CSS is
retained, and both endpoints were measured with white text. Recovery language was made
strictly factual. The verified-email action was made auth-aware without reintroducing a
server/client mismatch. Logo IDs and decorative semantics were hardened and tested.

The final test, lint, TypeScript, build, and browser checks were rerun after those changes.
An isolated production build was compared with a contemporaneous build of the Phase 0
home page using the same browser and machine. Script count stayed at 29, decoded script
bytes increased from 1,942,620 to 1,982,079 (about 2.0%), and observed layout shift fell
slightly from 0.002574 to 0.002550. Local load timings varied between samples; two warm
Phase 2 loads were about 13–16% above their control while another matched the earlier
baseline. The variation is recorded rather than presented as a field-performance result.

## Verification results

| Check | Result |
|---|---|
| `npm test` | 5 files, 18 tests passed |
| `npm run lint` | Passed with no diagnostics |
| `npx tsc --noEmit` | Passed |
| Isolated `npm run build` | Passed; production route manifest generated successfully |
| Browser observations | 36 across 320–1440 CSS pixels, both themes |
| Screenshots | 30 files; 30 unique SHA-256 hashes |
| Layout and semantics | 0 horizontal overflows; 0 clipped visible controls; 0 nested interactive elements |
| Browser diagnostics | 0 unexpected console errors; 0 page errors; 0 signed-in home hydration errors |
| Expected diagnostic | One browser resource diagnostic from the deliberate 401 login fixture |
| Real onboarding flow | Register, verify, recover, reset, and new-password sign-in passed |
| Reduced motion | Preference detected; preview visible; 0 active infinite animations |
| Contrast | All measured text/action combinations at least 4.62:1 |
| Production shape | 29 scripts; +2.0% decoded script bytes; layout-shift sum 0.002550 |

The 720 CSS-pixel viewport is a reflow-space proxy for a 1440-pixel browser window at
200% zoom. It verifies available layout space, not assistive-technology behavior.

## Evidence

| Evidence | Contents |
|---|---|
| [browser-phase2.json](evidence/phase-2/browser-phase2.json) | Full route, interaction, real-flow, contrast, and motion results |
| [browser-run.txt](evidence/phase-2/browser-run.txt) | Final clean Playwright summary |
| [tests.txt](evidence/phase-2/tests.txt) | Focused behavioral suite |
| [lint.txt](evidence/phase-2/lint.txt) | ESLint run |
| [typecheck.txt](evidence/phase-2/typecheck.txt) | Standalone TypeScript run |
| [build.txt](evidence/phase-2/build.txt) | Isolated Phase 2 Next.js production build |
| [production-home.json](evidence/phase-2/production-home.json) | Initial Phase 2 production navigation samples |
| [production-home-repeat.json](evidence/phase-2/production-home-repeat.json) | Repeated Phase 2 production navigation samples |
| [production-control.json](evidence/phase-2/production-control.json) | Contemporaneous Phase 0 production control samples |
| [screenshot-sha256.txt](evidence/phase-2/screenshot-sha256.txt) | Hashes for all 30 screenshots |
| [integrity.txt](evidence/phase-2/integrity.txt) | Evidence count and final result summary |

The evidence directory also contains the 30 route screenshots, command transcripts,
and the control build transcript. `capture-phase2.mjs` and
`measure-phase2-production.mjs` are reproducible browser harnesses.

## Limits and next phase

- Browser and integration checks use local services and disposable QA data. The local
  backend logs verification/reset links because email delivery is not configured; this
  phase connects and verifies the browser flow but does not add an email provider.
- The production measurements are unthrottled local navigation samples. They document
  relative bundle/layout behavior and timing variance, not Core Web Vitals or deployed
  user performance.
- The focused suite protects the changed landing and onboarding behavior. It does not
  certify external email delivery, a screen reader, or unrelated authenticated routes.
- No paid AI calls were made; recommendation requests in browser setup used an empty,
  deterministic fixture.

**Commit title:** `feat(ui): polish the landing and authentication experience`.
Use `git log --oneline --grep='polish the landing and authentication experience'`
after the checkpoint commit to locate its hash.

**Checkpoint:** Phase 3 will clarify the dashboard and analytics hierarchy, make charts
and heatmaps readable beyond hover/color, and separate loading, empty, failed, and partial
data states. It begins only after explicit user approval.
