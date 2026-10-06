# Phase 0 — Homepage performance, accessibility and microphone audit

**Date:** 2026-10-06 · **Branch:** `feat/phase0-perf-a11y` · **Decisions:** D-059, D-060

Three questions: why the homepage warm load rose from 24.2 ms to 35.1 ms while decoded script
grew 14.7% (D-052); what axe reports on the main pages; and what the voice features do when the
microphone is denied or missing. The fixes outside `web/` shipped on this branch. The `web/` fixes
are specified below for the Group A UI handoff.

## 1. Homepage performance

### Method

The same method as `docs/ui-ux/phase-7.md`: production `next build` + `next start`, one browser
context at 1440×900, one cold and then two warm navigations with `waitUntil: networkidle`, reading
`loadEventEnd`, FCP and decoded script bytes. Two changes make the result trustworthy. First, every
build is served at once and the builds are measured **interleaved**, 10–15 rounds each, reporting
medians, so host drift affects them all equally. Second, it uses Playwright's Chromium 153
headless, whose absolute times are about half of Phase 7's headed Chrome. Compare rows, not
absolutes.

The Phase 0 baseline build (`961c93a`) reproduces Phase 0's script bytes **exactly** (1,942,620),
so the builds are like-for-like.

### Result: two separate effects

| Build | Warm load | Warm FCP | Cold load | Script bytes |
|---|---|---|---|---|
| Baseline `961c93a` | 12.4 ms | 38 ms | 41.8 ms | 1,942,620 |
| HEAD | 18.1 ms | 50 ms | 55.2 ms | 2,231,826 |
| HEAD + the fix below | 19.1 ms | **32 ms** | 51.9 ms | 2,232,029 |

**Commit bisect** (`evidence/commit-bisect.json`):

| Commit | Warm load | Script bytes |
|---|---|---|
| baseline | 12.3 | 1,942,620 |
| `857b259` navigation | 13.5 | 1,961,235 |
| **`b6d4824` landing + auth** | **17.8** | 1,982,079 |
| `f39c0cc` … `e91ef69` | 17.7–18.0 | 1,996,484 → 2,012,173 |
| `be6e344` interview | 18.2 | **2,161,963** |
| `cec060b` polish | 18.0 | **2,227,629** |

The time arrived in one commit. The bytes arrived in two others and didn't move the time at all.

**The bytes are prefetched code for other routes, loaded after the page.** The scripts in the
homepage's own HTML grew 19 KB (678,390 → 697,787, +2.9%). Scripts fetched after load grew 270 KB
(1,264,230 → 1,534,039). Both builds prefetch the same 11 routes linked from the homepage and
navbar; those routes' code grew as the interview and other pages were built out. This is not on the
critical path.

**The time is the landing page's paint cost.** A file-group bisect of `b6d4824` (applied on top of
`857b259`) puts all of it in the landing slice (`page.tsx`, the preview, `button.tsx`). The CSS,
auth-page, and navbar/logo slices each measure within noise of the parent. Swapping the **old
`page.tsx` into HEAD** restores the baseline exactly (12.7 ms, layout 1.5 ms). So it's the
homepage markup, not the shared code. Removing one thing at a time (the preview, framer-motion,
the mount gate, the monospace font, the animated gradient, below-the-fold sections,
`content-visibility`, or a server-component rewrite) did **not** fix it. Traces showed why:

- **Raster work before first paint doubled.** It was 66–69 ms on the parent and 129–133 ms on
  HEAD (`raster.mjs`). The cause is large `filter: blur()` layers: two 384 px `blur-[130px]` blobs,
  now positioned on screen and animated, plus a `blur-3xl` glow covering the preview figure. FCP is a
  presentation time, so the raster cost lands directly on it: **36 → 60 ms cold, 32 → 50 ms warm.**
- **`loadEventEnd` rose by ordering, not by cost.** The new page's first style and layout are
  heavier (1.1 → 1.8 ms and 1.5 → 3.4 ms). Chrome now renders a frame *before* the last bootstrap
  chunk runs, and `load` waits for that chunk, so a full layout + paint frame (~4.5 ms) falls
  inside the load window. Main-thread script time barely changed. The first frame actually happens
  *earlier* (13.9 vs 17.6 ms).

### The fix (for UI A)

Draw the same glows with `radial-gradient` backgrounds instead of `filter: blur`. Prototyped on
HEAD: raster before FCP falls to **27 ms** (below the baseline's 66), and warm FCP to **32 ms**
(baseline 38). Visually it's the same soft glow.

- `web/src/app/page.tsx`, the two decorative blobs: drop `rounded-full bg-primary/10 blur-[130px]`
  (and the secondary equivalent). Size them `h-[40rem] w-[40rem]` with
  `bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--primary)_14%,transparent),transparent)]`.
  Keep `animate-blob`; a transform on an unfiltered layer is composited for free.
- `web/src/components/landing/interview-workspace-preview.tsx`, the glow `div`: replace
  `inset-8 rounded-full bg-gradient-to-r … blur-3xl` with `-inset-8` and a radial-gradient of
  `--primary` (22%) fading through `--secondary` (10%) to transparent.
- Card `backdrop-blur-sm` was measured and doesn't matter here (27.2 vs 27.5 ms). Leave it.
- **Optional, bytes only:** the navbar shows guests 8 links to sign-in-only routes, and Next
  prefetches each one. `prefetch={false}` on those links while `isAuthed !== true` stops guests from
  downloading code for pages they can't open. The saving wasn't measured; it doesn't affect timing.

**Warm `loadEventEnd` stays about 6 ms over the baseline even with the fix.** Only a lighter first
layout (essentially the old homepage) removes it, and it isn't something a user sees, so the UI A
exit criterion moves to FCP (D-059).

## 2. Accessibility (axe)

`axe.mjs` ran axe-core 4.13 (WCAG 2.0/2.1/2.2 A and AA, plus best practice) on 18 routes in both
themes, which is 36 page audits against the live dev stack with a disposable account: 8 guest
routes (`/`, login, register, forgot/reset password, verify email, leaderboard, a profile) and 10
signed-in ones (dashboard, problems, a problem, interview, system design, assessments, paths, a
path, analytics, settings). Entrance animations were allowed to settle first.

**Critical: none.**

**Serious: color contrast (646 nodes).** Almost all of it comes from four light-theme colour
pairings, so the fix belongs at the token or component level, not per page:

| Nodes | Where | Pair (light theme) | Ratio | Source |
|---|---|---|---|---|
| 450 | `/problems` tag chips | `--text-secondary` #64748b on `bg-primary/5` | 4.38 | `app/problems/page.tsx:88` |
| 70 | difficulty / level badges | `--warning` #b45309 on `bg-warning/15` | 4.04 | `components/ui/badge.tsx`, `app/paths/page.tsx`, `app/paths/[slug]/page.tsx` |
| 48 | the same badges | `--error` #dc2626 on `bg-error/15` (and `/10`) | 3.8–4.0 | same |
| 51 | the same badges | `--accent` #047857 on `bg-accent/15` | 4.2–4.4 | same |
| 20 | navbar avatar initials, every signed-in page, both themes | white on `bg-teal-600` | 3.66 | `components/ui/avatar.tsx:21` |
| 3 | dashboard "Best streak" card | `--text-secondary` on its warm tint | 4.1 | `app/dashboard/page.tsx` |
| 3 | homepage preview | `text-slate-500` code comment on #090d16; `text-primary-light` "JavaScript" chip (light) | 4.07 / 3.93 | `interview-workspace-preview.tsx` |

Suggested fixes:
- Light theme: darken `--text-secondary` to about #475569 and the status colours by one step
  (`--warning` → #92400e, `--error` → #b91c1c, `--accent` → #065f46), **or** keep the tokens
  and use darker text inside tinted badges only. Either way, check every pairing reaches 4.5:1.
- Avatar: the palette's `emerald-600`, `amber-600`, `cyan-600` and `teal-600` all fail with white
  text; teal was simply the one this account's name hashed to. Use the `-700` shades.
- Preview: `text-slate-400` for the comment line; `text-primary` (not `-light`) for the chip in
  light theme.

**Serious: `aria-prohibited-attr` (homepage, both themes).** The preview's
"Audio response visualization" `div` (`interview-workspace-preview.tsx`, `.items-end`) has an
`aria-label` but no role. Make it `aria-hidden`, since it's decorative and the figure already has a
caption, or give it `role="img"`.

**Moderate: `heading-order` on `/problems/[id]`.** The page `h1` is followed by `h3`s ("Examples",
editorial section headings in `components/editorial-view.tsx`) with no `h2`. Promote the first
level under the title to `h2`.

The dark theme is nearly clean: only the avatar and the preview's code comment line.

## 3. Microphone: denied, missing, granted

Both voice entry points (`app/interview/page.tsx` `toggleRecording`, `app/system-design/page.tsx`
`toggleRecording`) use the same pattern. They were driven in real Chromium 153 (`mic.mjs`) against
the live stack.

| Case | What happens | Verdict |
|---|---|---|
| API missing (`getUserMedia` or `MediaRecorder` absent) | Friendly "Microphone recording is unavailable in this browser. You can still type your answer." | Good |
| **Permission denied** | `NotAllowedError`. The UI shows the raw browser message **"Permission denied"** as a toast and an inline alert. Nothing says how to re-enable the mic or that typing still works | Needs copy |
| **No input device** | Code path: `NotFoundError` shows the raw **"Requested device not found"** | Needs copy (not reproducible here: with permission granted, Chromium on macOS used the host microphone) |
| Device busy or failing (`NotReadableError`), insecure origin | Raw DOMException text | Needs copy |
| Granted | Records, transcribes (200), appends the transcript. Tracks are released after stop and after navigating away mid-recording (0 live tracks) | Good |
| Recording rejected by the provider (too short, unreadable) | **Before:** 503 "Speech transcription failed: …", `retryable: true`. **Now:** 422, `retryable: false`, "The recording could not be transcribed…" | Fixed on this branch |

**Fixed on this branch (outside `web/`):**
- `ai-service/app/api/speech.py`
  - The OpenAI transcription call was synchronous inside `async` endpoints, so it blocked the
    ai-service event loop (every RAG and interview request on that worker) for the whole
    transcription. It now runs in the threadpool.
  - Provider errors are classified: rejected audio (`BadRequestError`) → 422 with an actionable
    message; rate limit → 429; anything else → 503.
  - Silence (an empty transcript) → 422 "No speech was detected".
  - A non-audio `mimeType` → 400, and over 25 MB → 413, both before any provider call.
  - The upload filename's extension now follows `mimeType`. Whisper detects the format from the
    extension, so a Safari `audio/mp4` recording sent as `recording.webm` would have been rejected.
- `backend/src/routes/interviews.routes.ts`: the speech routes pass the ai-service's 400/413/422
  through with `retryable: false`. `sendAIServiceError` turned every AI error into a retryable 503,
  which told the user to retry audio that can never succeed.

**For UI A (`web/`):**
- Map `getUserMedia` errors to plain copy, and always say typing still works:
  - `NotAllowedError`: "Microphone access is blocked. Allow it from the address-bar site
    settings, or type your answer."
  - `NotFoundError` / `OverconstrainedError`: "No microphone was found…"
  - `NotReadableError`: "The microphone is in use by another app…"
  - `SecurityError`: insecure context.
- Pass the real recording type. Create the recorder with a supported `mimeType`
  (`MediaRecorder.isTypeSupported`, webm/opus first, then mp4), build the `Blob` with
  `recorder.mimeType` rather than a hard-coded `audio/webm`, and send `mimeType` in
  `transcribeSpeech` / `evaluateExplanation`. The API now names the upload from it.
- Don't upload empty recordings: if the blob is under about 1 KB or shorter than about 0.5 s,
  show "That recording was too short" locally.
- Use `retryable` from the response. When it's `false` (400/413/422), show the message with
  "Record again", not a retry of the same audio.
- Whisper turns silence or a tone into short filler ("You"). When the transcript is one word or
  less, consider flagging it rather than appending it silently.

## Reproduce

```sh
npm install --prefix /tmp/pw playwright @axe-core/playwright && npx --prefix /tmp/pw playwright install chromium
export PLAYWRIGHT_MODULE=/tmp/pw/node_modules/playwright/index.mjs AXE_MODULE=/tmp/pw/node_modules/@axe-core/playwright/dist/index.mjs
# serve each build with `next start -p <port>`, then:
TARGETS='{"base":"http://localhost:3020","head":"http://localhost:3021"}' ROUNDS=15 OUT=out.json node docs/audits/phase-0/measure.mjs
TARGETS='{"head":"http://localhost:3021"}' node docs/audits/phase-0/raster.mjs
OUT=axe.json node docs/audits/phase-0/axe.mjs                 # needs the dev stack (web :3002, API :4000)
TOKEN=<disposable JWT> OUT=mic.json node docs/audits/phase-0/mic.mjs   # uses the host mic when permission is granted
```

## Limits

- Local loopback, headless, unthrottled. The ratios are meaningful; the absolute milliseconds are
  not field Web Vitals. On a GPU-rastering desktop, blur costs less than under headless software
  raster, but the direction holds, and low-end devices raster in software too.
- `mic.mjs` used fake and host devices; there was no real VoiceOver or real-device pass. That
  remains Advait's 5-minute check after UI A.
- axe can't judge focus order, meaningful alt text, or screen-reader announcements. Zero axe
  violations is necessary, not sufficient.
