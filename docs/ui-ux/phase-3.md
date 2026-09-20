# UI Phase 3 — Dashboard and useful progress visualizations

**Goal:** Help users understand their progress and choose the next practice action
without confusing failed requests with real zeroes. **Status:** Complete; awaiting
approval for Phase 4. **Completed:** 2026-09-15.

## What changed

- Reorganized the dashboard around one primary coding action, a compact progress
  snapshot, practice activity, a personalized practice plan, and secondary modes.
- Split profile, statistics, activity, and recommendation requests into independent
  resource states. Each has its own retry; successful panels remain usable when another
  endpoint fails. Missing values display as unavailable rather than `0`.
- Replaced hover-only recommendation reasoning with a keyboard/touch-accessible detail.
  Recommendations and revisit items now use responsive grids, truthful empty states,
  and explicit links to the full catalogue.
- Rebuilt analytics with summary values and four responsive visualizations. Every
  populated chart has a data table, while sparse/empty chart sections explain what is
  missing. Theme tokens replace hardcoded dark tooltip and axis colors.
- Corrected analytics language: topic data counts solved problems by tag and does not
  claim to measure “strength.” Date-only API values use stable UTC formatting, avoiding
  the previous local-date shift.
- Made the activity heatmap keyboard and touch usable with one roving tab stop, arrow-key
  navigation, 24-pixel target spacing, focus/touch tooltips, a visible-period total,
  future-cell suppression, and a readable active-day list. Narrow layouts open on the
  latest week instead of making users scroll through a year of older activity.
- Disabled Recharts animation for reduced-motion users and added focused tests for the
  new state, retry, total, date, and keyboard behavior.

## Three iterations

### Iteration 1 — Establish honest hierarchy and states

Replaced optimistic zero defaults with nullable resource values and independent status
handling. Added local retry functions for statistics, activity, recommendations, and
analytics. Rebuilt the dashboard hierarchy and analytics cards, added semantic summaries
and tables, corrected metric labels, and rewrote the heatmap interaction model.

Four focused tests were added. They prove that dashboard failures remain distinct,
retrying statistics does not refetch activity or recommendations, analytics failures do
not render as empty progress, partial response totals and dates remain exact, a truly
empty account gets a useful first action, out-of-range heatmap data is excluded, and
arrow keys move the single heatmap tab stop.

### Iteration 2 — Challenge normal, empty, failed, and partial states

The Playwright matrix used deterministic fixtures for populated and new accounts, plus
statistics, activity, recommendation, and analytics failures. It covered both themes at
320, 390, 720, 768, 1024, and 1440 CSS pixels. Local retry request counters proved that
statistics and recommendation retries called only their own endpoints. An analytics 503
showed an error, never the new-user message, then recovered to the exact total of ten.

The heatmap moved from September 15 to September 14 with Arrow Up and exposed the new
date through both focus and its tooltip. At 390 pixels, the latest week starts in view
and the touch tooltip stays inside the viewport. Opening the analytics details produced
four data tables, including the topic table. The final matrix has zero page overflow,
clipped visible controls, nested interactive elements, unexpected console errors, or
page errors.

### Iteration 3 — Settle charts, motion, and production behavior

Visual review found that screenshots taken during Recharts' JavaScript animation could
show partially drawn graphics. The harness now waits through that animation, and the
charts themselves turn animation off when reduced motion is requested. A reduced-motion
browser check confirms the preference, zero active infinite animations, and an unchanged
chart path across observations. Final phone and desktop screenshots show settled charts
and balanced dashboard, empty, and failed layouts in both themes.

The final production build was compared with an isolated build of Phase 2 using five
local navigations per route, the same fixtures, browser, viewport, and machine. Both
builds load 28 scripts. Phase 3 adds 14,405 decoded bytes (0.7%). Across four current-build
runs, analytics post-response load ranged from about 1% faster to 12% slower than control.
Dashboard post-response load rose from 31.6 to 42.8 ms in the designated final run; the
repeated range was 22–35%. The small bundle delta and richer initial dashboard DOM explain
the direction, while the relative percentage is amplified by the control's roughly
32–33 ms local load time. Final layout shift improved by about 0.002. These measurements
are directional and do not represent deployed user performance.

## Verification results

| Check | Result |
|---|---|
| `npm test` | 6 files, 22 tests passed |
| `npm run lint` | Passed with no diagnostics |
| `npx tsc --noEmit` | Passed |
| `npm run build` | Passed; production route manifest generated successfully |
| Browser observations | 27 across 320–1440 CSS pixels and both themes |
| Screenshots | 9 files; 9 unique SHA-256 hashes |
| Layout and semantics | 0 page overflows; 0 clipped visible controls; 0 nested interactive elements |
| Browser diagnostics | 0 unexpected console errors; 0 page errors; 4 expected 503 resource diagnostics |
| Retry isolation | Statistics and suggestions each retried without refetching unrelated panels |
| Analytics states | Populated, partial, empty, failed, and recovered states passed |
| Accessible data | 4 chart tables; heatmap arrows, latest-week mobile view, and tooltip bounds passed |
| Reduced motion | Preference detected; 0 infinite animations; chart path remained static |
| Production shape | 28 scripts; +0.7% decoded bytes; negligible layout-shift delta |

The 720 CSS-pixel viewport is a reflow-space proxy for a 1440-pixel browser window at
200% zoom. It verifies available layout space, not screen-reader behavior.

## Evidence

| Evidence | Contents |
|---|---|
| [browser-phase3.json](evidence/phase-3/browser-phase3.json) | Route matrix, local retries, keyboard, data-table, diagnostics, and motion results |
| [tests.txt](evidence/phase-3/tests.txt) | Full 22-test frontend suite |
| [lint.txt](evidence/phase-3/lint.txt) | ESLint run |
| [typecheck.txt](evidence/phase-3/typecheck.txt) | Standalone TypeScript run |
| [build.txt](evidence/phase-3/build.txt) | Final Next.js production build |
| [production-final.json](evidence/phase-3/production-final.json) | Final Phase 3 versus Phase 2 production measurements |
| [production-comparison-timing.json](evidence/phase-3/production-comparison-timing.json) | Response/post-response timing investigation |
| [screenshot-sha256.txt](evidence/phase-3/screenshot-sha256.txt) | Hashes for all nine screenshots |
| [integrity.txt](evidence/phase-3/integrity.txt) | Evidence count and final result summary |

The evidence directory also contains the screenshots, repeated timing samples, and
control build transcript. `capture-phase3.mjs` and `measure-phase3-production.mjs` are
the reproducible browser harnesses.

## Limits and next phase

- Browser states use deterministic API fixtures so failures and partial responses remain
  reproducible. No paid recommendation-model calls were made in this phase.
- The browser matrix checks keyboard behavior and programmatic names but is not a full
  assistive-technology certification. Heatmap improvements also affect public profiles,
  which reuse the shared component; Phase 7 owns full profile regression review.
- Production timing is local, unthrottled, and low-latency. It is useful for bundle,
  layout, and directional comparison, not Core Web Vitals or deployed-device claims.
- The dashboard intentionally keeps recommendations independent because the AI-backed
  endpoint can be unavailable while statistics and activity remain healthy.

**Commit title:** `feat(ui): clarify dashboard progress and analytics`.
Use `git log --oneline --grep='clarify dashboard progress and analytics'` after the
checkpoint commit to locate its hash.

**Checkpoint:** Phase 4 will streamline the problem catalogue and learning paths,
separate bookmark and navigation actions, refine filters and result counts, and cap
catalogue motion. It begins only after explicit user approval.
