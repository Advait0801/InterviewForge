# UI Phase 4 — Practice discovery and learning paths

**Goal:** Make finding a suitable problem quick, scannable, and predictable while
turning learning-path progress into a clear next action. **Status:** Complete; awaiting
approval for Phase 5. **Completed:** 2026-09-16.

## What changed

- Reorganized the problem catalogue around a compact summary, labeled filter panel,
  exact live result count, saved-only view, and one clear reset action. Search, status,
  topic, company, difficulty, and saved filters continue to combine locally across all
  150 loaded problems.
- Split every catalogue row into a real problem link and an independent 44-pixel bookmark
  control. Bookmark requests are tracked per problem, update the saved count, announce
  their result, and never trigger navigation.
- Replaced blank and toast-only catalogue outcomes with durable loading, unavailable,
  true-empty, and no-match states. Only the failed resource retries.
- Capped catalogue entrance delay at 120 ms instead of scaling with list length. The
  150th row reached full opacity in 645 ms from navigation in the final browser run;
  reduced-motion mode removes the entrance movement.
- Rebuilt the learning-path list with truthful summaries, semantic progress bars,
  start/continue/review actions, and distinct loading, error, and empty states. A path
  with zero steps shows “Sequence being prepared” instead of an invalid progress range.
- Added a prominent next-problem action and “Up next” marker to path detail. Path errors,
  missing paths, and empty sequences remain distinct, and superseded slug requests can no
  longer overwrite the current path.
- Corrected path progress at the API boundary: summary counts now join current path
  membership, excluding historical progress for removed steps. The UI also clamps counts
  defensively and presents the database's zero-based positions as one-based step labels.

## Three iterations

### Iteration 1 — Establish predictable discovery and progression

Removed the nested bookmark button/link markup, grouped and labeled every filter, added
selected-state semantics, exact counts, reset behavior, and per-item bookmark state.
Introduced clear resource states and local retries for the catalogue and both learning-
path routes. Path cards gained semantic progress, while detail gained a next-step action
and request-order protection.

Six focused UI tests cover all filters together, no-match reset, two concurrent bookmark
requests, catalogue failure versus empty recovery, stale progress clamping, next-step
selection, network failure versus missing content, and A-to-B path response races.

### Iteration 2 — Exercise the full catalogue and route states

The deterministic Chrome matrix covered problems, path list, and path detail in both
themes at 320, 390, 720, 768, 1024, and 1440 CSS pixels. It rendered all 150 problems,
the longest-title fixture, combined six catalogue filters to one exact result, reset a
no-match view to 150, and proved a bookmark request left the URL unchanged.

Catalogue, path-list, and path-detail 503 responses stayed distinct from empty or missing
content and recovered through their own retry. The path detail recovered to the correct
next problem, one “Up next” marker, a progress value of two, and step labels 1 through 4.
The final 39-observation matrix has zero page overflow, clipped visible controls, nested
interactive elements, unexpected console errors, or page errors.

### Iteration 3 — Audit seeded data, evidence, and production shape

Independent review found that real path positions begin at zero even though the first
fixtures began at one. The UI now derives the displayed ordinal from the sorted list,
fixtures match the real zero-based API, and the focused test asserts both step labels.
The review also prompted a backend route regression that simulates historical progress
for a removed member and fails unless the membership join excludes it.

The browser harness now throws when any recorded layout, console, semantics, filter,
bookmark, retry, next-step, motion, or reduced-motion invariant fails. Ten screenshots
have unique verified hashes. The final production build was compared twice with an
isolated Phase 3 build using the same fixtures, browser, viewport, and machine. Base
routes add 13,205 decoded script bytes (0.7%); path detail adds 19,463 bytes (1.0%), with
no script-count change or layout shift. Catalogue ready time stayed within about 1% of
control. Path list added roughly 5–14 ms and path detail roughly 1–7 ms after response;
the percentage ranges are amplified by 38–41 ms control times. These measurements are
directional and do not represent deployed user performance.

## Verification results

| Check | Result |
|---|---|
| Web `npm test` | 7 files, 28 tests passed |
| Backend `npm test` | 6 files, 73 tests passed |
| Web `npm run lint` | Passed with no diagnostics |
| Web and backend TypeScript | Passed |
| Web `npm run build` | Passed; production route manifest generated successfully |
| Browser observations | 39 across three routes, 320–1440 CSS pixels, and both themes |
| Screenshots | 10 files; 10 unique SHA-256 hashes |
| Layout and semantics | 0 page overflows; 0 clipped visible controls; 0 nested interactive elements |
| Browser diagnostics | 0 unexpected console errors; 0 page errors; 5 expected 503 resource diagnostics |
| Combined filters | Exact 1-of-150 result, no-match state, and 150-result reset passed |
| Bookmark behavior | One API call; URL unchanged; saved state updated |
| Learning paths | Error/empty/missing/recovered states and next-step progression passed |
| Catalogue motion | 150 rows; last row fully visible in 645 ms; cap assertion passed |
| Reduced motion | Preference detected; 0 infinite animations |
| Production shape | 0.7–1.0% decoded script delta; 0 script-count or layout-shift delta |

The 720 CSS-pixel viewport is a reflow-space proxy for a 1440-pixel browser window at
200% zoom. It verifies available layout space, not screen-reader behavior.

## Evidence

| Evidence | Contents |
|---|---|
| [browser-phase4.json](evidence/phase-4/browser-phase4.json) | Route matrix, filters, bookmark, retries, path progress, motion, and diagnostics |
| [web-tests.txt](evidence/phase-4/web-tests.txt) | Full 28-test frontend suite |
| [backend-tests.txt](evidence/phase-4/backend-tests.txt) | Full 73-test backend suite |
| [lint.txt](evidence/phase-4/lint.txt) | ESLint run |
| [web-typecheck.txt](evidence/phase-4/web-typecheck.txt) | Frontend TypeScript run |
| [backend-typecheck.txt](evidence/phase-4/backend-typecheck.txt) | Backend TypeScript run |
| [build.txt](evidence/phase-4/build.txt) | Final Next.js production build |
| [production-final.json](evidence/phase-4/production-final.json) | Final Phase 4 versus Phase 3 production measurements |
| [production-repeat.json](evidence/phase-4/production-repeat.json) | Repeated comparison in the opposite order |
| [screenshot-sha256.txt](evidence/phase-4/screenshot-sha256.txt) | Hashes for all ten screenshots |
| [integrity.txt](evidence/phase-4/integrity.txt) | Evidence count and final result summary |

The evidence directory also contains the ten screenshots and the Phase 3 control build
transcript. `capture-phase4.mjs` and `measure-phase4-production.mjs` are reproducible
browser harnesses.

## Limits and next phase

- Browser routes use deterministic API fixtures so 150 rows, failures, and sparse states
  remain reproducible. The backend regression isolates membership counting with a mocked
  database response; it does not replace a deployed-database integration suite.
- The matrix checks keyboard-reachable controls, programmatic state, focusable action
  separation, and reduced motion, but it is not a full assistive-technology certification.
- Production timing is local, unthrottled, and low-latency. It is useful for bundle,
  layout, and directional comparison rather than Core Web Vitals.
- Catalogue filters remain local to the loaded page. A full reload resets them, and the
  selected combination is not encoded into a shareable URL.

**Commit title:** `feat(ui): streamline problem discovery and learning paths`.
Use `git log --oneline --grep='streamline problem discovery and learning paths'` after
the checkpoint commit to locate its hash.

**Checkpoint:** Phase 5 will refine coding and timed-assessment workspaces while
preserving editor state, submission behavior, results, and timer semantics. It begins
only after explicit user approval.
