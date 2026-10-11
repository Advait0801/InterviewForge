/**
 * Assessment integrity from browser events (D-071). Pure: the service loads the events and
 * the window they belong to.
 *
 * The signals are what a browser can honestly report: the tab hidden or shown, the window
 * losing focus, a paste or copy (its length only), leaving fullscreen. They indicate; they
 * don't prove -- a notification can blur the window, and pasting your own snippet is fine --
 * so the summary raises flags for a reviewer to look at rather than changing the score.
 */

export const EVENT_TYPES = [
  "tab_hidden",
  "tab_visible",
  "window_blur",
  "window_focus",
  "paste",
  "copy",
  "fullscreen_exit",
  "fullscreen_enter",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export type IntegrityEvent = { type: EventType; at: string | Date; chars: number | null };

export const FLAG_TAB_SWITCHES = 3;
export const FLAG_HIDDEN_SECONDS = 60;
export const FLAG_PASTE_CHARS = 200;

export type Integrity = {
  events: number;
  tabSwitches: number;
  hiddenSeconds: number;
  windowBlurs: number;
  pastes: number;
  pastedChars: number;
  largestPaste: number;
  copies: number;
  fullscreenExits: number;
  flags: string[];
};

/**
 * `end` closes a tab that was hidden and never shown again: the assessment's finish, or now
 * if it's still running (capped at its deadline by the caller).
 */
export function summarize(events: IntegrityEvent[], end: Date): Integrity {
  const sorted = [...events].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  let hiddenMs = 0;
  let hiddenSince: number | null = null;
  const out: Integrity = {
    events: events.length,
    tabSwitches: 0,
    hiddenSeconds: 0,
    windowBlurs: 0,
    pastes: 0,
    pastedChars: 0,
    largestPaste: 0,
    copies: 0,
    fullscreenExits: 0,
    flags: [],
  };
  for (const e of sorted) {
    const t = new Date(e.at).getTime();
    switch (e.type) {
      case "tab_hidden":
        out.tabSwitches++;
        if (hiddenSince === null) hiddenSince = t;
        break;
      case "tab_visible":
        if (hiddenSince !== null) hiddenMs += Math.max(0, t - hiddenSince);
        hiddenSince = null;
        break;
      case "window_blur":
        out.windowBlurs++;
        break;
      case "paste":
        out.pastes++;
        out.pastedChars += e.chars ?? 0;
        out.largestPaste = Math.max(out.largestPaste, e.chars ?? 0);
        break;
      case "copy":
        out.copies++;
        break;
      case "fullscreen_exit":
        out.fullscreenExits++;
        break;
    }
  }
  if (hiddenSince !== null) hiddenMs += Math.max(0, end.getTime() - hiddenSince);
  out.hiddenSeconds = Math.round(hiddenMs / 1000);

  if (out.tabSwitches >= FLAG_TAB_SWITCHES) out.flags.push(`Left the tab ${out.tabSwitches} times`);
  if (out.hiddenSeconds >= FLAG_HIDDEN_SECONDS) out.flags.push(`Away from the tab for ${out.hiddenSeconds} seconds`);
  if (out.largestPaste >= FLAG_PASTE_CHARS) out.flags.push(`Pasted ${out.largestPaste} characters at once`);
  return out;
}
