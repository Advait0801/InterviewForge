# UI Phase 0 — Branch and baseline

**Goal:** Isolate the UI work and establish a reproducible baseline before changing
the application. **Status:** Complete; awaiting user approval for Phase 1.
**Started:** 2026-09-14. **Final review:** 2026-09-15.

## Branch and scope

- Branch: `feat/ui-ux-polish`, created from local `main` at
  `a9c3fefe4b2db822d3c8f915776198c0648d8582`.
- The only pre-existing working-tree change was the requested, untracked UI plan.
- This phase adds documentation and a browser audit script. Application source,
  service configuration, dependencies, and lockfiles are unchanged.
- One branch serves all UI phases; one PR follows the entire completed improvement.
  Each phase still ends with its own commit and user approval checkpoint.
- The user changed commit attribution during Phase 0 to
  `Co-Authored-By: GPT-6 Astra <noreply@openai.com>`.

## Three verification iterations

### Iteration 1 — Establish the baseline

Created the branch after checking its name was unused. Reviewed all 19 route files,
shared components, current CI, and commit conventions. An independent sub-agent
checked the route/state inventory and testing approach. Updated the documentation
index, root README, repository guidance, and historical platform plan to point to
the UI workstream. Corrected the stale claim that web lint was non-blocking.

Docker reported all six local services running. Source was copied into a temporary
directory without `.env` files, `.next`, or build caches. Existing local dependencies
were copied there using macOS copy-on-write cloning. This isolated build cannot
overwrite the running Docker development server's build directory.

### Iteration 2 — Run and challenge

- Lint passed without diagnostics; production build passed, including Next's
  TypeScript pass; standalone TypeScript check passed after generated types existed.
- Nine HTTP route checks returned 200 with an InterviewForge marker. The catalogue
  endpoint returned 150 problems. These checks validate server responses, not client
  authentication or rendered layout.
- Native Chrome initially required permissions. After access was enabled, window
  control remained intermittent. The user explicitly authorized Playwright as the
  browser-verification fallback; it runs in a separate headless Chrome profile.
- First browser pass recorded 58 screenshots and 57 layout observations. It exposed
  clipped navigation, clipped workspace controls, absent menu Escape behavior,
  ongoing reduced-motion animations, misleading analytics errors, and authenticated
  hydration diagnostics.
- The audit script itself injected local storage into `about:blank`, causing 25
  test-setup errors. These are **harness errors**, not product defects. The initial
  counts are preserved in [iteration-2-summary.json](evidence/phase-0/iteration-2-summary.json).

### Iteration 3 — Refine the audit and reverify

Replaced the script's storage-injection hook with origin-scoped browser storage
state. Added a real form login followed by reload to distinguish the authentication
hydration issue from test setup. Added a theme-persistence reload check, synthetic
populated analytics and leaderboard screenshots, and deduplicated error diagnostics.
Recaptured the baseline with the corrected script. Reviewed representative images
directly and used a second agent for independent screenshot review.

The corrected pass recorded **62 screenshots / 61 layout observations** in Chrome
152.0.7977.83. The about:blank setup errors are gone. All observations reached the
requested route with the expected theme. Real login then reload still reproduces
the hydration mismatch. Theme selection survives reload, and signed-out practice
navigation correctly redirects to `/login`.

Screenshot review caught one more harness issue: JavaScript-driven Recharts
animation had not finished in the populated samples. Added an explicit settling
wait and recaptured those two images, verifying three pie sectors in each theme.
This is capture refinement, not a product chart-rendering defect.

The frontend test approach is documented in [route-matrix.md](route-matrix.md): use
Vitest aligned with existing repository tooling and Testing Library for focused
component behavior in Phase 1. Keep browser checks and real sandbox execution
separate. No frontend test dependencies are introduced in Phase 0.

## Reproduction and evidence

The browser audit is [capture-baseline.mjs](capture-baseline.mjs). It requires the
running local web/API and creates a synthetic `uiqa_*` account plus a two-problem,
120-minute assessment each time it runs. It never logs the account password or JWT.
These disposable local records are left in place; the script does not delete data.
It neither submits solutions nor starts interviews or speech/AI evaluation.

Install Playwright in a temporary tool directory, then point `PLAYWRIGHT_MODULE` at
its absolute `node_modules/playwright/index.mjs` path. Installed Google Chrome is
used via `channel: 'chrome'`; no browser download or user-profile reuse is needed.

```sh
PLAYWRIGHT_MODULE=/absolute/temp-tools/node_modules/playwright/index.mjs \
PROD_URL=http://localhost:3003 \
node docs/ui-ux/capture-baseline.mjs
```

Optional settings: `UI_BASE_URL`, `UI_API_URL`, and `UI_EVIDENCE_DIR`. Defaults are
web `http://localhost:3002`, API `http://localhost:4000/api`, and this phase's evidence
directory. Only run against a local QA stack. Repeated runs create additional test
records and can encounter the existing API rate limit.

The production build was served temporarily at `127.0.0.1:3003` from the isolated
copy, using `npm run start -- --hostname 127.0.0.1 --port 3003`. It is separate from
the development stack. The build uses the local public API URL and disables Next
telemetry; no service environment secrets are copied.
The temporary production server was stopped after measurements; the Docker stack
remains running.

| Evidence | Result/scope |
|---|---|
| [environment.txt](evidence/phase-0/environment.txt) | Baseline revision, branch, host Node/npm, and environment separation |
| [lint.txt](evidence/phase-0/lint.txt) | `npm run lint`, exit 0 |
| [typecheck.txt](evidence/phase-0/typecheck.txt) | `npx --no-install tsc --noEmit`, exit 0 |
| [build.txt](evidence/phase-0/build.txt) | `npm run build`, exit 0; Next 16.1.6 / Turbopack |
| [http-baseline.json](evidence/phase-0/http-baseline.json) | Nine server route responses and real 150-problem API catalogue |
| [browser-run.txt](evidence/phase-0/browser-run.txt) | Final browser audit execution summary |
| [chart-refinement.txt](evidence/phase-0/chart-refinement.txt) | Targeted chart recapture after JavaScript animation settled |
| [browser-baseline.json](evidence/phase-0/browser-baseline.json) | Browser version, viewport/theme observations, screenshot manifest, diagnostic counts, interaction checks, production samples |
| [integrity.txt](evidence/phase-0/integrity.txt), [screenshot-sha256.txt](evidence/phase-0/screenshot-sha256.txt) | Evidence checks and hashes of all 62 screenshots |
| [route-matrix.md](route-matrix.md) | Full 19-route inventory and planned state coverage, not a claim every state passed |

### Screenshot coverage and data provenance

- Home and authenticated dashboard: 320, 390, 768, 1024, and 1440 CSS px, both themes.
- All other routes: desktop baseline in both themes, including real local problem,
  path, and assessment detail; coding/assessment workspaces additionally at 390 px.
- Extra cases: reduced-motion home, simulated analytics failure, and populated
  analytics/leaderboard fixtures.
- Viewport height is 900 px. Captures are viewport-sized, with finite animations
  settled using Playwright's `animations: 'disabled'`; screenshots alone do not
  measure entrance animation timing.
- Recommendations are always a controlled 503 to avoid paid model calls. Catalogue,
  learning paths, new-user stats/activity, and QA assessment responses use the real
  local API. Populated analytics and leaderboard use explicitly synthetic browser
  fixtures so no other users' data is committed.

## Baseline findings and phase ownership

| ID | Observed baseline | Owning phase |
|---|---|---|
| UI-01 | At 768 px, desktop navigation clips Analytics/theme/account controls; overflow remains at 1024 px | 1 |
| UI-02 | Keyboard Enter opens the mobile menu, but Escape does not close it and `aria-expanded` is absent | 1 |
| UI-03 | Four infinite animations continue with `prefers-reduced-motion: reduce` | 1, then each page phase |
| UI-04 | Authenticated direct loads emit hydration mismatch diagnostics at `Protected`; real form login followed by reload reproduces it. Final audit: 32 occurrences across ten routes | 1 |
| UI-05 | Recommendation 503 produces a heading-only dashboard panel; analytics 503 presents “No data yet” | 3 |
| UI-06 | Problem discovery shows only three complete, prose-heavy cards in a 1440×900 viewport | 4 |
| UI-07 | Phone coding/assessment toolbars clip Run/Submit and other controls; coding/console headers compete for limited vertical space | 5 |
| UI-08 | Desktop coding layout works well enough to preserve; light-theme Monaco remains dark by current design | 5 |
| UI-09 | Populated analytics fixture dates display one calendar day earlier in the local browser (e.g. `2026-09-10` appears as `9/9`); the top donut label is clipped | 3 |

The mobile landing page fits 320 px without visible horizontal clipping. Its hero
occupies much of the first viewport; Phase 2 can tighten spacing while preserving
readability. The path-detail page displays six clear steps; progress grouping is
an opportunity for refinement rather than a demonstrated functional defect.

## Limits

- Baseline compilation was run on host Node 25.4.0/npm 11.14.1; existing CI uses
  Node 20. This local pass is not a claim that hosted CI ran.
- No live model calls, actual speech, full interview progression, deadline expiry,
  real code submission, account credential changes, or report export were exercised.
  Their owning phases must verify those interactions when changed.
- Keyboard coverage here is a focused menu/auth/theme sample, not a complete
  accessibility audit. 200% browser zoom and full screen-reader/contrast verification
  remain mandatory for the relevant changed layouts in later phases.
- Production timings are local, unthrottled homepage navigation samples (one cold,
  two warm), not Lighthouse scores or field Web Vitals. Script decoded-byte totals
  are observed script resources; layout-shift sum is observed over navigation/idle,
  not a standardized session-window CLS or a long-duration stability guarantee.
- Existing product defects are recorded rather than fixed in this baseline phase.

## Exit checklist

- [x] Separate branch established; main unchanged.
- [x] Approved plan, phase workflow, and model-name attribution documented.
- [x] Route inventory and focused frontend testing approach recorded.
- [x] Lint, standalone typecheck, and isolated production build captured.
- [x] Browser access available through user-authorized Playwright.
- [x] Corrected browser pass and screenshot/evidence integrity verified.
- [x] Final docs/diff independently reviewed; included in the Phase 0 commit.

**Commit title:** `chore(ui): establish the UI polish branch and baseline`.
Use `git log --oneline --grep='establish the UI polish branch'` to locate its hash.

**Checkpoint:** Phase 0 evidence is ready. Phase 1 starts only after user approval.
