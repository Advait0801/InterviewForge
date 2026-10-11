import { describe, expect, it } from "vitest";
import { summarize, type IntegrityEvent } from "../services/integrity";

const t0 = Date.parse("2026-10-11T10:00:00Z");
const ev = (type: IntegrityEvent["type"], s: number, chars: number | null = null): IntegrityEvent => ({ type, at: new Date(t0 + s * 1000).toISOString(), chars });
const end = new Date(t0 + 3600 * 1000);

describe("summarize", () => {
  it("is empty and unflagged with no events", () => {
    expect(summarize([], end)).toMatchObject({ events: 0, tabSwitches: 0, hiddenSeconds: 0, flags: [] });
  });

  it("sums hidden time between hide and show, in any arrival order", () => {
    const s = summarize([ev("tab_visible", 40), ev("tab_hidden", 10), ev("tab_hidden", 100), ev("tab_visible", 105)], end);
    expect(s).toMatchObject({ tabSwitches: 2, hiddenSeconds: 35 });
  });

  it("a tab hidden and never shown again counts until the end", () => {
    expect(summarize([ev("tab_hidden", 3500)], end).hiddenSeconds).toBe(100);
  });

  it("a second hide while already hidden doesn't restart the clock", () => {
    expect(summarize([ev("tab_hidden", 0), ev("tab_hidden", 30), ev("tab_visible", 50)], end)).toMatchObject({ tabSwitches: 2, hiddenSeconds: 50 });
  });

  it("flags at the thresholds, not below", () => {
    const below = summarize([ev("tab_hidden", 0), ev("tab_visible", 59), ev("tab_hidden", 60), ev("tab_visible", 60), ev("paste", 70, 199)], end);
    expect(below.flags).toEqual([]);
    const at = summarize([ev("tab_hidden", 0), ev("tab_visible", 30), ev("tab_hidden", 40), ev("tab_visible", 60), ev("tab_hidden", 70), ev("tab_visible", 80), ev("paste", 90, 200)], end);
    expect(at.flags).toEqual(["Left the tab 3 times", "Away from the tab for 60 seconds", "Pasted 200 characters at once"]);
  });

  it("counts pastes, copies, blurs and fullscreen exits; pasted chars add up", () => {
    const s = summarize([ev("paste", 1, 10), ev("paste", 2, 30), ev("copy", 3, 5), ev("window_blur", 4), ev("fullscreen_exit", 5)], end);
    expect(s).toMatchObject({ pastes: 2, pastedChars: 40, largestPaste: 30, copies: 1, windowBlurs: 1, fullscreenExits: 1 });
  });
});
