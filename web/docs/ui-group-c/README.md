# UI Group C verification

Branch: `feat/ui-group-c`, created after pulling the latest `origin/main` (`787e627`). All changes are in `web/`. Committed locally; nothing pushed. Verified 2026-10-11 (America/Los_Angeles).

## Changes by file

| File | Change |
| --- | --- |
| `src/lib/api.ts` | Generated-client methods and exported types for daily practice, reviews, hints, path generation, replay/sharing/public replay, proctoring and email resend. Error envelopes retain retry seconds and indexed custom-input errors. Run optionally sends custom inputs; Submit excludes them. Seven-language validation; D-055 session handling retained. |
| `src/components/code-workspace-editor.tsx` | JavaScript/Go/Rust Monaco mappings. Copy reports only the model selection's character count to the assessment hook. |
| `src/app/problems/[id]/page.tsx` | Seven languages/preferences; saved custom cases, empty-input filtering and indexed error focus; custom results/diffs, review outcomes/addition. Anonymous problem/hint reading; execution requires sign-in. Late language history cannot replace code being edited. |
| `src/components/custom-cases.tsx` | Ten removable cases, example prefill, 10,000-character limit/counter, field errors, judged/unjudged results. |
| `src/components/output-diff.tsx` | Pure explanations for every variant and output path; marked string differences including end-of-string mismatches. |
| `src/components/review-outcome.tsx`, `add-to-review.tsx`, `progressive-hints.tsx` | Outcome wording/link, recoverable addition, signed-in-only hint reporting with no UI errors or reset reporting. |
| `src/components/daily-problem.tsx`, `review-due.tsx`, `email-confirmation.tsx` | Independent dashboard resources, daily badges/streaks, review counts and resend/dismiss/countdown/confirmed states. |
| `src/app/dashboard/page.tsx`, `settings/page.tsx` | Daily/review/email dashboard sections and settings confirmation/resend. |
| `src/app/daily/page.tsx`, `daily/error.tsx` | Optional-auth 30-day history, UTC dates, personal marks/streaks only when signed in, empty/error/retry states. |
| `src/app/review/page.tsx`, `review/error.tsx` | Protected due/upcoming lists, source explanations, practice links, confirmed removal and local recovery. |
| `src/components/layout/navbar.tsx` | Review destination and refreshed due badge; full navigation starts at 1440 px so the added destination fits. |
| `src/components/focus-path.tsx` | Build/rebuild with inline server conflicts and focus-topic breakdown. |
| `src/app/paths/page.tsx`, `paths/[slug]/page.tsx` | Personal-first ordering/badges, Built from panel and focus tags. Rebuild updates detail immediately even when its slug stays the same. |
| `src/components/interview/history.tsx`, `src/app/interview/page.tsx` | Setup history with company/date/status/persona and completed replay links. Active sessions remain unlinked. |
| `src/components/interview/replay-timeline.tsx` | Shared stage timeline, offsets, pushback/hints/evaluations/report; compressed 1x/2x/4x playback, Pause/Show all and reduced motion. No per-event live announcements. |
| `src/app/interview/[id]/page.tsx` | Protected replay, independent session details before sharing, report generation/recovery and share management. |
| `src/components/interview/share-links.tsx` | Native dialog with résumé notice before creation, name/expiry, once-visible URL/copy recovery, active metadata and confirmed revocation. |
| `src/app/share/[token]/page.tsx`, `layout.tsx`, `error.tsx` | Anonymous replay with separate public shell, candidate from the shared response only, uniform 404, route-only robots/referrer metadata and public recovery. |
| `src/hooks/use-proctoring.ts`, `src/components/integrity-summary.tsx` | Visibility/window/clipboard/fullscreen observations; immediate hidden/50-event flushes and 5-second batches; closed/limit stops and rejected-batch drops. Instrumentation retains/sends no text. Neutral summary/flags. |
| `src/app/assessments/[id]/page.tsx` | Seven languages, persistent notice, diffs and completed integrity results. Final submission starts a flush without waiting on telemetry; deadline/submission coordination remains. |
| `src/hooks/use-api-resource.ts` | Loading/error/404 separation, local retry and stale-route response protection. |
| `src/components/ui/button.tsx`, `app-toaster.tsx`, `theme-provider.tsx` | React 19 refs for focus return, theme-token toast contrast, and clearing/removal of account notifications on public sharing. |
| `src/test/group-c-fixtures.ts`, `setup.ts` | Typed fixtures, dialog support and session-storage cleanup. |
| New `src/app/__tests__/group-c.test.tsx`, `src/components/__tests__/group-c.test.tsx`, `src/hooks/__tests__/use-proctoring.test.tsx`, `src/components/ui/__tests__/app-toaster.test.tsx` | Integration/component/privacy/instrumentation coverage. |
| Existing discovery, interview-design, interview-upgrades, workspaces, navbar and API-contract tests | New resource mocks, language/client contracts, badge coverage and delayed-history regression. |
| This directory | Saved checks, browser/axe/live-event results, eight reviewed screenshots and reproducible harnesses. |

## Tests and checks

Before: **17 files, 135 tests**. After: **21 files, 211 tests**, all passing (+76).

- [Baseline tests](baseline-tests.txt)
- [Final npm test](tests.txt)
- [Bare npm run lint](lint.txt), with no warnings/errors
- [Production npm run build](build.txt)
- [API contract check](api-contract.txt)

The three required web checks passed before each commit. The generated schema has no diff from the base. `rg -n 'fetch\(' web/src` finds only `src/lib/api.ts`'s existing adapter. No environment file or file outside `web/` was changed.

## Acceptance criteria

| # | Criterion | How checked |
| --- | --- | --- |
| 1 | Checks/contract/schema/client-only requests | All saved checks pass; Git/rg confirm scope, unchanged schema and the sole fetch adapter. |
| 2 | Seven languages and new-language execution | Both workspace tests restore all seven starters/preferences; browser checks both selectors. Live JavaScript/Go/Rust each pass Run, a reference-judged custom case and **50 Submit cases**. |
| 3 | Custom reference result, malformed inline error, clean Submit body | Live reference output `[0,1]`; malformed input focuses its field without generic failure. Tests/browser map a sent index past an empty case. Submit bodies omit `customInputs`; session-storage reload is tested. |
| 4 | Visible diff and string marks | Every kind and string/end-of-string mark is tested. Examples/custom/revealed Submit cases and assessment execution use the shared renderer; browser evidence shows numeric diffs. |
| 5 | Review outcomes/add/list/remove/badge | Every action and null tested; fixture Submit enrollment, live add/remove, due/upcoming/empty/error/retry/source and navbar badge checks. |
| 6 | Signed-in-only hints; no reset request | Tests inspect counts/bodies and anonymous/reset absence. Live reveal reporting returns 200. |
| 7 | Daily card, personal marks/streak and 30 days | Signed-in/out tests; browser fixture card/streak and exactly 30 history rows. Daily rotation is not altered. |
| 8 | Personal path, generation/conflicts and focus | 201 navigation and all three 409 messages tested. Browser fixture Rebuild opens focus detail. Tests cover first ordering, tags and same-slug replacement. |
| 9 | History/replay/report/playback | Every event, offset, penalty, stage/report lists, active/completed history, fake-clock speeds/Pause/Show all/reduced motion tested. Browser operates controls in both themes. |
| 10 | Share warning, once-visible token and revoke | Notice verified before creation; fields, closing/reopening URL loss, active metadata and revoke confirmation tested. Fixture revocation produces public 404. |
| 11 | Public anonymity, metadata, no viewer content | Stored-token and fresh private-context checks; exact bearer-header assertions and actual HTML robots/referrer meta inspection. Public shell omits navbar/account data and account toasts. Live unknown-token 404 passes. |
| 12 | Notice, text-free events, stop and neutral integrity | Live native Monaco paste/copy record **22 pasted/105 copied characters**, no text, persisted GET/Submit integrity and visible results. Tests cover every event, 50-event cap, immediate hidden flush during a slow request, 400 drops, closed/limit stops, inactivity/timeout/submit and nonblocking completion. Flags/summary audited neutrally. Headless visibility limit below. |
| 13 | Email sent/countdown/confirmed/dismiss | Browser fixture resend success; unit dismissal, 200, 429 countdown/re-enable, 409 confirmation in both banner/settings presentations. |
| 14 | States/themes/reflow/keyboard/focus | Local loading/empty/404/error/retry and render recovery; tests preserve drafts/deadlines/panes. All 26 observations have no horizontal overflow. Native controls/dialog are keyboard operable; harness uses Tab/Enter in sharing and keyboard console resize. Screenshots visually reviewed. |
| 15 | Zero serious/critical axe violations | **26 audits, zero violations of any severity**, covering custom errors/results, review, daily, paths/focus path, replay, share dialog/public/revoked link, active/completed assessment and dashboard, in both themes. [axe.json](axe.json). |
| 16 | Attributed local commits; nothing pushed | Both commits below have Conventional Commit titles, why/verification bodies and final GPT-6 attribution. Scope is `web/`; no push was run. |

## Browser evidence and screenshots

[Browser results](browser.json), [saved output](browser-run.txt), [live proctoring results](live-proctoring.json) and [output](live-proctoring-run.txt) record the checks and character-only batches.

| Page | Light desktop, 1440 px | Dark, 320 px |
| --- | --- | --- |
| Problem with diff | [Screenshot](problem-light-1440.png) | [Screenshot](problem-dark-320.png) |
| Review | [Screenshot](review-light-1440.png) | [Screenshot](review-dark-320.png) |
| Replay | [Screenshot](replay-light-1440.png) | [Screenshot](replay-dark-320.png) |
| Public share | [Screenshot](share-light-1440.png) | [Screenshot](share-dark-320.png) |

With the dev stack running, run from the repository root using an externally installed Playwright module and the installed Chrome:

```sh
PLAYWRIGHT_MODULE=/tmp/interviewforge-ui-b/node_modules/playwright/index.mjs node web/docs/ui-group-c/verify-browser.mjs
PLAYWRIGHT_MODULE=/tmp/interviewforge-ui-b/node_modules/playwright/index.mjs node web/docs/ui-group-c/verify-live-proctoring.mjs
```

Harnesses create disposable QA accounts; credentials/tokens remain in memory. `SKIP_FIXTURES=1` runs only the main harness's live checks. Paid interview/report/recommendation generation is intercepted with deterministic fixtures.

## API findings and limits

No missing or incorrect Group C endpoint/type was found. No schema edit or API workaround was introduced.

Replay/report generation, sharing/revocation, personal paths, daily solved/streak states and email responses use fixtures. These verify UI/client contracts and lifecycle rather than a full paid live interview or delivered email. Live checks cover new-language Run/Submit, custom validation/reference judging, hints, review CRUD, public 404 and assessment event persistence/results.

Headless Chrome kept background tabs visible and emitted no native window blur when another tab came forward. The live-event harness records `nativeTabBecameHidden: false` and dispatches visibility events as a fallback. Native Monaco clipboard events and insertion are real. Visibility/window/fullscreen capture and terminal errors are also tested with fake events. Native background-tab/fullscreen and assistive-technology behavior in a headed browser remain unverified.

A live attempt exposed the need to wait for language restoration before inserting QA code; the workspace also protects real edits from delayed history. An early clipboard attempt lacked editor focus; the final run focuses the mounted editor and verifies insertion. Toast contrast was fixed, and animations settle before contrast measurement. Final evidence records successful runs.

## Local commits

1. `b41df65` — `feat(ui): expose Group C practice and interview features`
2. `docs(ui): record Group C verification` — this report and final check outputs (the documentation commit).

Both are on `feat/ui-group-c`, ending with `Co-Authored-By: GPT-6 <noreply@openai.com>`. Use `git log -2 --oneline feat/ui-group-c` for the documentation commit's hash; embedding its own hash would change it.

## Follow-up

- Navbar badges (desktop/mobile) and the dashboard link use “1 review due” and “0/2 reviews due”, with regression coverage for all three counts.
- Review actions include each problem title in their accessible names: “Practise Two Sum” and “Remove Two Sum from your review queue”. Visible labels stay unchanged; tests query both due and upcoming items by their exact names. The browser harness selectors match the new names.
- Integrity time away uses singular/plural seconds and minutes, omitting zero trailing seconds. Tests cover “1 second”, “45 seconds”, “1 minute”, “2 minutes 5 seconds” and boundary cases. Both paste character counts use “1 character”/“21 characters”, with zero also covered.

Before: **21 files, 211 passing tests** ([baseline output](followup-tests-before.txt)). After: **21 files, 228 passing tests**, adding 17 regressions ([test output](followup-tests.txt)). `npm test`, bare `npm run lint` ([output](followup-lint.txt)) and `npm run build` ([output](followup-build.txt)) all pass before the single local follow-up commit, `fix(ui): clarify review controls and integrity counts`. Changes remain in `web/`; nothing was pushed.
