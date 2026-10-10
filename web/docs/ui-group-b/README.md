# UI B verification

Branch: `feat/ui-group-b`, created from the latest `origin/main` (`062f63d`). Work is confined to `web/`; no merge or push. Verified on 2026-10-09 (America/Los_Angeles).

## Changes

- `src/lib/sse.ts`: byte-safe JSON SSE reader with CRLF, comments, abort/cancellation, frame validation and incomplete-stream handling.
- `src/lib/api.ts`: typed streaming start/answer methods, hint method, optional request signals, and error `code`/`availableAt`; existing JSON methods and session-invalid middleware remain.
- `src/lib/useNow.ts`: optional second resolution for hint countdowns; existing consumers still default to minutes.
- `src/app/interview/page.tsx`: integrates streaming, start preferences, hint controls and session progress. Reduced from 733 to 447 lines.
- `src/components/interview/{use-interview,conversation,preferences,hints,question-details,result-cards}.tsx`: request lifecycle/reconciliation, provisional text/evaluations, accessible radio groups, countdowns, transcript hints, penalty details, pushback, agent disclosure and existing report/voice cards.
- `src/components/ui/status-pill.tsx`: adds a neutral tone to fix session badge contrast without changing existing consumers.
- `src/lib/__tests__/{sse,api-contract}.test.ts` and `src/app/__tests__/{interview-upgrades,interview-design}.test.tsx`: new coverage and migration of the existing interview fixtures to the streaming facade. Existing voice, four-stage, report and PDF assertions remain.

## Acceptance results

| Criterion | Verification |
| --- | --- |
| 1. Tests/lint/build | Baseline: 14 files, 96 tests. Final: 16 files, 132 tests. `npm test`, bare `npm run lint`, and `npm run build` pass. Output is saved in the adjacent text files. |
| 2. Contract and client-only requests | `bash scripts/ci/check_api_contract.sh` passes. Generated schema has no Git diff. `grep -rn 'fetch(' web/src` returns only `src/lib/api.ts`'s existing client adapter. |
| 3. Streaming | Unit/component tests exercise byte splits, UTF-8, CRLF, comments, opening/answer deltas, immediate evaluation, authoritative replacement and completion. Chrome live observations are in `browser.json`. |
| 4. Navigation/cancellation | Component tests exercise unmount, pagehide, Cancel and cancelling an answer without losing the draft. Live pending opening and answer cancellation compare backend session/transcript state before/after; no turn is recorded. Chrome has no console/page errors. |
| 5. Stream error recovery | Explicit retryable errors retain and resend exactly the submitted answer. Non-retryable 409s reload; reload failures require GET recovery. Missing terminal events/transport loss reconcile before any repeat POST. Provisional evaluation/question output is discarded on failure. |
| 6. Preferences and agent moves | Tests verify chosen persona/mode request body, omitted default mode, server preferences in the header, pivot in the same stage, disclosure/search count and normal fallback/not_consulted notes. Chrome traverses preferences, start, hints, answers, disclosure and export using Tab, arrows, typing and Enter; a pivot and probe reach questions 2 and 3 in the same stage. |
| 7. Hints | Fake-clock component flow: 409 lock → 30-second countdown → hint 1 → lock → hint 2 → lock → hint 3 → no hints left. Draft is sent; hints render inline; penalties and raw scores render from stored evaluation metadata. Exhausted, service errors and question-changed reloads are distinct. Chrome checks inline hints and penalty text. |
| 8. Pushback | Mocked outcome and stored transcript fixtures render quoted claim vs evidence above the question; screenshots show the callout. |
| 9. Type cleanup | Generated metadata is narrowed on `kind`; no `as never`, `String(x as string)` or `Record<string, never>` workaround is used for metadata/report. Generated types are unchanged. |
| 10. Accessibility/reflow | Chrome axe audits setup, active interview and report in light and dark. Zero serious/critical violations. Light desktop and dark 320 px screenshots; no page overflow; keyboard traversal recorded; reduced motion has no running infinite animations. One persistent polite live region announces authoritative question text; streamed tokens are outside it. |
| 11. Report/PDF | Existing generate/report/PDF component tests pass. Chrome generates a mocked report and downloads the actual PDF in both themes. |

## Evidence and reproduction

- `browser.json`: Chrome fixture/live results and diagnostics.
- `interview-light-1440.png`, `interview-dark-320.png`: final UI screenshots, visually reviewed.
- `tests.txt`, `lint.txt`, `build.txt`: final required checks.
- `verify-browser.mjs`: browser harness. With the dev stack running, install Playwright outside the repo and run:

```sh
npm install --prefix /tmp/interviewforge-ui-b playwright
PLAYWRIGHT_MODULE=/tmp/interviewforge-ui-b/node_modules/playwright/index.mjs node web/docs/ui-group-b/verify-browser.mjs
```

The harness creates a disposable QA account, intercepts interview fixtures, runs actual start/answer requests for streaming/cancellation, and downloads fixture report PDFs. It never stores the QA token/password in evidence. Set `SKIP_LIVE=1` to run fixtures only.

## Limits and API findings

No missing endpoint or generated type was found; no API workaround was added. Pushback, adaptive decisions, hints and reports use deterministic fixtures rather than relying on paid model output or the challenge feature flag. Live checks cover opening/answer streaming and pending-generation cancellation, rather than completing a whole live interview. Real microphone and assistive-technology behavior are outside this browser run; existing mocked voice tests pass.

An initial attempt to cancel after the first visible delta raced completed generation and produced a session. The subsequent cancellation checks stop at the question envelope while generation is still pending and verify no persistence. An abort cannot undo a turn the backend has already committed; the frontend preserves reconciliation when a terminal result is uncertain.
