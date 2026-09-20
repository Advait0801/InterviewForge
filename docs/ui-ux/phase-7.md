# UI Phase 7 - Completion and regression review

**Goal:** Finish secondary screens and audit the website as a whole.
**Status:** Complete; awaiting user acceptance before pushing or creating a PR.
**Completed:** 2026-09-20.

## What changed

- Leaderboard now separates loading, empty, error, and ranked data. Failed pagination
  retains the last successful page, with an explicit retry. Its ranking explanation
  matches the API's distinct-solved ordering and submission-based acceptance rate.
  Narrow website widths move acceptance below the username for legibility.
- Public profiles distinguish a missing user from a load failure and offer the
  appropriate back or retry action. Stats, activity, and recent history use calmer,
  unframed sections; long names and usernames wrap safely.
- Settings now shows durable account-load, avatar, and password errors. Password fields
  have visible labels and reject a reused password before POST. Avatar selection
  checks the encoded data URI against the backend's 500KB limit, not only raw file
  size. Existing upload, remove, and password API behavior remains intact.
- Added route-specific render-error recovery for leaderboard, profile, settings,
  analytics, assessments, and system design, using one shared presentation.

## Three iterations

### Iteration 1 - Secondary pages and recovery

Inspected the Phase 6 handoff, backend ranking/profile/password/avatar contracts,
shared UI components, existing route boundaries, and tests. Implemented the page
hierarchy and explicit resource states. Added six route boundaries without changing
the API contract or account persistence behavior.

### Iteration 2 - Behavior and route matrix

Added seven focused tests for leaderboard failure/retry and pagination, missing versus
failed profiles, stale profile responses after navigation, password validation and
retained inputs, account-load recovery, render-error reset, and encoded avatar size.
The full frontend suite passed 55 tests.

Chrome walked 14 authenticated routes at 390, 768, and 1440 CSS pixels in both
themes, plus five guest auth routes at narrow and wide widths: 94 route observations.
It also checked leaderboard 503 recovery, an actual missing profile, settings
validation, reduced motion, keyboard input, and a 360 CSS-pixel reflow proxy for a
720-pixel window at 200% zoom.

### Iteration 3 - Visual audit and final verification

The first screenshot review found narrow leaderboard acceptance text wrapping into
the username; it now has its own line. The first browser checker also mistook
off-screen cells inside the deliberately horizontal heatmap scroller for clipped
controls; the checker excludes that explicit scroll region while still checking
document overflow and other visible controls. A later rerun briefly hit the local
API's shared 500-request/15-minute IP bucket; restarting the local backend cleared
its in-memory limiter. The final expanded run passed with 16 verified screenshots,
zero document overflow, clipped controls outside the heatmap, nested interactions,
page exceptions, or failed requests.

Lint, TypeScript, 55 tests, and an isolated Next.js production build passed. The
production homepage was briefly served on **the same port 3002** for a Phase 0
comparison, then the usual Docker web service was restored to 3002 and returned 200.

## Performance review

Three local unthrottled production homepage navigations were recorded in one Chrome
context, matching Phase 0's measurement shape. Warm-load mean rose from 24.2 ms in
Phase 0 to 35.1 ms now (+45%); decoded script resources rose from 1,942,620 to
2,228,455 bytes (+14.7%). Observed layout-shift sum remained about 0.00255 versus
0.00257. The intervening phases added substantial application behavior and route
code; this comparison does not isolate Phase 7 as the cause. It is a real local
regression signal, not a field Web Vital or a production-network estimate, and
should be tracked during PR review rather than called neutral.

## Evidence

| Evidence | Contents |
|---|---|
| [browser-phase7.json](evidence/phase-7/browser-phase7.json) | 94-route matrix, five state checks, and browser diagnostics |
| [production-home.json](evidence/phase-7/production-home.json) | Three same-port production homepage timings and script sizes |
| [checks.txt](evidence/phase-7/checks.txt) | Commands and final outcomes |
| [screenshot-sha256.txt](evidence/phase-7/screenshot-sha256.txt) | SHA-256 manifest for 16 screenshots |

`capture-phase7.mjs` is the reproducible route harness. With local web/API services
running, install Playwright in a temporary directory and run from the repository root:

```sh
npm install --prefix /tmp/interviewforge-playwright playwright
PLAYWRIGHT_MODULE=/tmp/interviewforge-playwright/node_modules/playwright/index.mjs node docs/ui-ux/capture-phase7.mjs
```

The harness creates a disposable QA account and assessment. Repeated runs may reach
the local API's IP rate limit; wait for its window rather than treating 429 as a
website rendering result. It rewrites the browser JSON, screenshots, and hash list.

## Material limits

- The route matrix used real local read APIs and one disposable assessment setup,
  but failure states were browser fixtures. It did not change real credentials or
  upload/remove a real avatar; those behaviors are covered by component mocks and
  backend contract inspection.
- No paid AI request or microphone/device interaction was made in Phase 7. Those
  workflows retain the dedicated Phase 5 and 6 evidence and limits.
- The 200% check is a CSS layout-space proxy, not a screen-reader or OS-level zoom
  certification. The screenshots are website widths, not a native mobile app.
- Local performance samples vary with cache, host activity, and Chrome version.
  The Phase 0 comparison is directional; it does not identify a single offending
  bundle or replace field monitoring.
- The shared API limiter keys on IP before authentication (existing F-23), so
  repeated integration sweeps can exhaust the same bucket. That backend issue was
  not changed in this UI phase.

**Commit title:** `feat(ui): complete interface polish and regression review`.

**Checkpoint:** Await user acceptance. Do not push or create the single PR until
the user approves the completed UI plan and delivery sequence.
