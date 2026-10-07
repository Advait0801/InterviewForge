# UI Group A verification

Branch: `feat/ui-group-a`, based on `origin/main` at `b05f607`. Changes are confined to `web/`.

## Changes

- Homepage glows use radial gradients. The preview glow is clipped horizontally at narrow widths so its negative inset cannot widen the page. Existing card backdrop blur and animations remain.
- Light-theme secondary/status tokens and all eight avatar colors meet text contrast requirements. The fixed dark editor preview uses readable static colors; decorative audio bars are hidden from assistive technology; problem/editorial headings use h2. Narrow workspace pane switches use the established action gradient, and scrollable content/console regions have names and keyboard focus.
- Both voice entry points share recording behavior: actionable microphone errors, supported MIME selection, actual recorder MIME uploads, a 1 KiB / 500 ms minimum, retryability from API errors, and confirmation of one-word/empty transcripts. Tracks stop immediately on stop/unmount, and a permission request resolved after unmount releases its tracks. Unusable recordings cannot be retried or evaluated.
- Every application API request uses `openapi-fetch` with the unedited generated `paths`. Public method names and argument types remain compatible. All domain response types in `api.ts` alias the generated contract. Session revocation still requires a token-bearing 401 with `code: "session_invalid"`; ordinary 401s preserve the session. Assessment completion converts its numeric submit score to a string for the stored Assessment shape. Workspace results use the generated Run/Submit unions and narrow hidden cases without fetching them.

## Automated checks

Before each commit, in `web/`:

```sh
npm test
npm run lint
npm run build
```

The final suite has 96 passing tests in 14 files. Bare eslint, the production build, and standalone `npx tsc --noEmit` pass.

Generation and contract verification:

```sh
(cd backend && npm ci && npm run gen:web-client)
bash scripts/ci/check_api_contract.sh
rg -n 'fetch\(' web/src -g '*.ts' -g '*.tsx'
```

Both generated artifacts match their specifications. The fetch scan finds only the adapter supplied to `createClient<paths>()` in `api.ts`. No secrets were added; `web/.env` contains only `NEXT_PUBLIC_*` keys.

Existing tests changed:

- `interview-design.test.tsx`: microphone denial now expects actionable copy instead of the raw browser error. Its recorder fixture supports MP4, emits sufficient audio, and runs longer than 500 ms; evaluation asserts the actual MIME argument.
- `discovery.test.tsx`: adds the required problem `created_at` field.
- `workspaces.test.tsx`: adds required `created_at`, `test_case_count`, and assessment `user_id` fields. Existing assertions remain.

Added tests cover microphone lifecycle, device errors, accepted formats, unusable/temporarily rejected audio, short transcript confirmation, token freshness, optional authentication, URL encoding, payloads, error metadata, hidden results, and generated score/answer shapes.

## Browser evidence

`homepage-performance.json` comes from the repository's `docs/audits/phase-0/measure.mjs`, against `npm run build` + `npx next start -p 3020`, Chromium 153, 1440×900, 15 rounds with one cold/two warm navigations each. Final median warm FCP is **32 ms**, meeting the ≤38 ms gate. Both theme screenshots were visually inspected.

`axe.json` has zero violations across the 18 Phase 0 routes in both themes (36 audits). The original `docs/audits/phase-0/axe.mjs` passed twice. The final `axe-recheck.mjs` uses the same audit with a reused disposable QA account and a longer navigation timeout to accommodate live AI recommendation latency.

`responsive.json` records 38 route/theme observations at 320 px with reduced motion, no horizontal overflow, no running infinite animations, and no page exceptions. All eight workspace pane/theme audits have zero serious/critical findings. Both panes remain mounted across pane switches, and Escape restores focus to the mobile-menu trigger. All eight avatar palettes exceed 4.5:1 with white text (minimum 5.03:1).

`microphone.json` records 16 Chromium cases covering both entry points. Device errors, interview setup, and provider failure responses are explicit fixtures; recording/encoding uses the real MediaRecorder. Denied/missing/busy/security errors show plain recovery copy, short recordings make no request, 422 offers Record again, 503 retries identical audio, short transcripts require confirmation, MIME payloads contain no default filename, and tracks are released after stop. The recorder unit tests additionally cover late permission completion and unmount.

`registration-and-login.json` records real UI registration and login. `live-flows.json` records real local service interactions; synthetic spoken input is captured through Chromium's fake microphone and transcribed by the live speech provider. No response fixtures are used in that run. Real checks passed for problem Run/Submit (4 public examples / 50 submit cases), both assessment solves and linkage, completion/reload with a string score, paths, analytics, leaderboard, profile, password-error session preservation, password change, avatar upload, speech transcription in both entry points, voice evaluation, all four interview stages, report rendering, PDF download, and a populated six-node system-design diagram.

One design-analysis provider call took 129 seconds, beyond the original harness's two-minute wait; the targeted `system-design-live.mjs` continuation allowed five minutes and passed in 58 seconds. The application already retained its pending state through the wait. No service timeout or backend behavior was changed.

## Reproduction

The browser tools are external test dependencies, not application dependencies:

```sh
npm install --prefix /tmp/interviewforge-ui-a-tools playwright @axe-core/playwright
npx --prefix /tmp/interviewforge-ui-a-tools playwright install chromium
export PLAYWRIGHT_MODULE=/tmp/interviewforge-ui-a-tools/node_modules/playwright/index.mjs
export AXE_MODULE=/tmp/interviewforge-ui-a-tools/node_modules/@axe-core/playwright/dist/index.mjs
TARGETS='{"ui-a":"http://localhost:3020"}' ROUNDS=15 OUT=web/docs/ui-group-a/homepage-performance.json node docs/audits/phase-0/measure.mjs
OUT=web/docs/ui-group-a/axe.json node docs/audits/phase-0/axe.mjs
node web/docs/ui-group-a/microphone-audit.mjs
node web/docs/ui-group-a/responsive-audit.mjs
say -o /tmp/interviewforge-ui-a-speech.wav --file-format=WAVE --data-format=LEI16@24000 'I would use a hash map to store the numbers and find the complement in constant time. This uses linear space and takes linear time.'
SPEECH_WAV=/tmp/interviewforge-ui-a-speech.wav node web/docs/ui-group-a/live-flows.mjs
```

Run from the repository root against the local web/API stack on 3002/4000. Browser runs create disposable QA records. The responsive audit caches its private QA state under `/tmp/` so repeated checks respect auth-write limits; `QA_STATE` selects that file for the final axe recheck. The live run reaches actual AI endpoints and may take several minutes.

## API issue and deliberate omissions

The generator emits `Record<string, never>` for unconstrained object fields, notably `InterviewMessage.metadata_json` and `InterviewSession.report_json`. The API supplies metadata keys and report contents; its schema should declare those properties or explicitly allow additional properties, or its generator should use an appropriate empty-object option. The generated file remains unedited and no replacement response type was introduced. Existing runtime metadata rendering still works, and the client/contract checks pass.

Optional guest-navbar prefetch changes were omitted: the requested FCP target is already met. Backend, AI service, runner, and CI configuration were not changed. No PR was opened or branch pushed. Real hardware/browser-permission UX, Safari recording, and a manual screen-reader pass remain unverified; browser tests use real Chromium recording with controlled devices and synthesized speech.
