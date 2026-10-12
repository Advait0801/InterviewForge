# UI Group D verification

Completed 2026-10-11 (America/Los_Angeles) on `feat/ui-group-d`, created from freshly fetched `origin/main` at `111bbf3`. Changes stay in `web/`; the generated schema and all backend services are unchanged. Commit locally only; no push.

The active chat's `turn_context` records `gpt-6.1-sol`; the app's configured model matches. Commit attribution names GPT 6.1 Sol.

## Delivered

- Accepted submissions expose empirical complexity after Submit and in submission detail. Availability, saved analysis, measurement, cancellation, missing/failed availability, rate limits and retryable service failures have distinct UI states. Charts use logarithmic axes and theme colors; an accessible table preserves every timing. Ambiguous candidates, inconclusive runs, partial/error runs and every reviewer verdict are explained. Stored AI reviews refresh the comparison, including subsequent reviews.
- Submit outcomes display first-game Elo changes and predicted success; hints explain the half-win. Dashboard picks support an optional topic filter, independent loading/error/empty states and problem links. Analytics shows overall and topic ratings, games and provisional/new-user states.
- `/peer` lists sessions and hosts interviews with role, optional searched problem and 15–90-minute duration. Invite tokens appear once, only in a fragment URL. Copy has recovery and dismissal removes the link.
- `/peer/join` consumes and clears the hash before its request. Tab-scoped pending invites survive login, including expired authentication. Strict Mode does not double-consume an invite. Missing/full invites and transient failures have appropriate recovery.
- `/peer/[id]` uses authenticated Socket.IO with join acknowledgements, reconnects, presence, server deadlines, shared code/language, bounded debounce, protocol notices, confirmed End and distinct Leave. Edits made during a socket outage survive rejoining; stale events after disposal cannot sign out or replace code. A completed join acknowledgement refreshes feedback, and hosts refresh partner details when someone arrives.
- WebRTC uses candidate-politeness perfect negotiation, queued ICE candidates, serialized signalling, expiring ICE configuration, and a data channel to connect without media. Microphone/camera are explicitly opt-in, with denied/missing/in-use states, mute/off, remote playback recovery, and complete cleanup. Adding media later renegotiates. Network failures explain TURN while shared code remains usable.
- Per-role feedback accepts the documented categories, 1–5 ratings and up to 2,000 characters once. Partner feedback can be refreshed. Cancelled/expired invitations explain that feedback requires a completed interview.
- Peer navigation fits the existing 1440 px breakpoint; the interview setup links to peer practice. Workspaces share the language catalogue; Monaco preserves the local selection on remote edits. The shared badge's background tint was adjusted after an actual light-theme contrast failure. Existing Group C test typing errors were corrected.

## Evidence

- [Tests](tests.txt): **24 files, 327 tests pass**, up from 228 tests. Fetch, Socket.IO, RTCPeerConnection and media devices are mocked; no unit test accesses actual devices.
- [Bare ESLint](lint.txt): no errors or warnings.
- [Production build](build.txt): passes, including all three peer routes.
- [Standalone TypeScript](types.txt): passes. Rebuilding cleared stale generated Next route types; the prior Group C `getByRole` errors are fixed.
- [Browser matrix](browser.json): **50 axe observations**, both themes at **320 and 1440 px**, with zero serious/critical violations, zero horizontal overflow and zero page errors. Invite/session/feedback/join-error screens, picks and ratings data/empty states, complexity after Submit/in detail, mobile navigation and session errors are exercised. Every observation confirms zero media permission calls. Twenty screenshots accompany the matrix.
- [Native WebRTC](webrtc.json): two real Chrome peer connections, candidate hosting, connect with no media. Simultaneously added synthetic audio/video tracks renegotiate and render both remote videos. Real Monaco code/language sync and Leave pass. Two screenshots accompany this check.

The native WebRTC check uses fixture REST and documented Engine.IO/Socket.IO signalling packets. It mocks `getUserMedia` with generated audio and canvas streams. The isolated QA browser disables `WebRtcHideLocalIpsWithMdns`: without that flag, this machine's host candidates did not connect, although offer/answer/ICE exchange completed. This is consistent with the documented local mDNS limitation. This run does not certify production TURN, real device permissions, or a connection across different networks. Those paths are covered by mocked lifecycle tests and the existing backend protocol/deployment documentation.

Run the browser scripts from the repository root with Node 25 and Playwright/Chrome available:

```sh
node web/docs/ui-group-d/verify-browser.mjs
node web/docs/ui-group-d/verify-webrtc.mjs
```

`PLAYWRIGHT_MODULE` overrides the existing local tool path; `WEB_URL` overrides `http://localhost:3002`. The API/signalling fixtures stay in the isolated browser contexts and make no paid AI calls.

## Backend follow-up

No missing or incorrect API contract was found; no backend code change is required. TURN must be configured for restrictive networks, as already described in `docs/peer-interviews.md` and D-078. The existing ICE endpoint supplies its credentials; the UI refreshes them at expiry.

## Local commit

`feat(ui): add Group D complexity ratings and peer interviews` contains the implementation, regression tests and this verification evidence. Its body records why the screens are needed and what passed; its final trailer attributes GPT 6.1 Sol. Use `git log -1 --format=full feat/ui-group-d` for the hash and full attribution.
