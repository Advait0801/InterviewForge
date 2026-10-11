import { describe, expect, it } from "vitest";
import { addDays, cycleOf, dailyStreaks, dayNumber, difficultyFor, pickDaily, todayUtc, type CatalogueEntry } from "../services/daily";

const catalogue: CatalogueEntry[] = [
  ...Array.from({ length: 43 }, (_, i) => ({ id: `e${i}`, slug: `easy-${String(i).padStart(2, "0")}`, difficulty: "easy" })),
  ...Array.from({ length: 64 }, (_, i) => ({ id: `m${i}`, slug: `medium-${String(i).padStart(2, "0")}`, difficulty: "medium" })),
  ...Array.from({ length: 43 }, (_, i) => ({ id: `h${i}`, slug: `hard-${String(i).padStart(2, "0")}`, difficulty: "hard" })),
];
const year = Array.from({ length: 365 * 2 }, (_, i) => addDays("2026-01-01", i));

describe("pickDaily", () => {
  it("is deterministic, and independent of the catalogue's row order", () => {
    const shuffled = [...catalogue].reverse();
    for (const date of year.slice(0, 60)) {
      expect(pickDaily(date, catalogue)).toEqual(pickDaily(date, catalogue));
      expect(pickDaily(date, shuffled)!.slug).toBe(pickDaily(date, catalogue)!.slug);
    }
  });

  it("sets difficulty by weekday: Mon-Tue easy, Wed-Fri medium, weekend hard", () => {
    // 2026-10-05 is a Monday.
    const week = Array.from({ length: 7 }, (_, i) => difficultyFor(addDays("2026-10-05", i)));
    expect(week).toEqual(["easy", "easy", "medium", "medium", "medium", "hard", "hard"]);
    for (const date of year) expect(pickDaily(date, catalogue)!.difficulty).toBe(difficultyFor(date));
  });

  it("never repeats a problem until its difficulty's pool is used up, across two years", () => {
    for (const difficulty of ["easy", "medium", "hard"]) {
      const days = year.filter((d) => difficultyFor(d) === difficulty);
      const picks = days.map((d) => pickDaily(d, catalogue)!.slug);
      const pool = catalogue.filter((p) => p.difficulty === difficulty).length;
      const byCycle = new Map<number, string[]>();
      days.forEach((d, i) => byCycle.set(cycleOf(d, pool), [...(byCycle.get(cycleOf(d, pool)) ?? []), picks[i]]));
      expect(byCycle.size).toBeGreaterThan(2);
      for (const [cycle, slugs] of byCycle) {
        expect(new Set(slugs).size, `${difficulty} cycle ${cycle}`).toBe(slugs.length);
      }
    }
  });

  it("never gives a difficulty the same problem twice running, even across a cycle boundary", () => {
    // A cycle's shuffle ends on its first problem about once in 43-64 boundaries; a century
    // of days crosses hundreds of boundaries, so the guard in cycleOrder is exercised.
    const century = Array.from({ length: 36_500 }, (_, i) => addDays("2000-01-01", i));
    for (const difficulty of ["easy", "medium", "hard"]) {
      const picks = century.filter((d) => difficultyFor(d) === difficulty).map((d) => pickDaily(d, catalogue)!.slug);
      for (let i = 1; i < picks.length; i++) expect(picks[i], `${difficulty} #${i}`).not.toBe(picks[i - 1]);
    }
  });

  it("uses every problem", () => {
    const used = new Set(year.map((d) => pickDaily(d, catalogue)!.slug));
    expect(used.size).toBe(catalogue.length);
  });

  it("returns null when there's nothing of that day's difficulty", () => {
    expect(pickDaily("2026-10-05", catalogue.filter((p) => p.difficulty !== "easy"))).toBeNull();
  });
});

describe("dates", () => {
  it("rejects dates that don't exist", () => {
    expect(dayNumber("2026-02-30")).toBeNull();
    expect(dayNumber("2026-1-1")).toBeNull();
    expect(dayNumber("2026-02-28")).not.toBeNull();
  });

  it("today is the UTC date", () => {
    expect(todayUtc(Date.parse("2026-10-09T23:30:00-07:00"))).toBe("2026-10-10");
  });
});

describe("dailyStreaks", () => {
  it("counts back from today, or from yesterday while today is unsolved", () => {
    expect(dailyStreaks(["2026-10-08", "2026-10-09", "2026-10-10"], "2026-10-10")).toEqual({ current: 3, best: 3 });
    expect(dailyStreaks(["2026-10-08", "2026-10-09"], "2026-10-10")).toEqual({ current: 2, best: 2 });
    expect(dailyStreaks(["2026-10-07", "2026-10-08"], "2026-10-10")).toEqual({ current: 0, best: 2 });
  });

  it("keeps the best run, across month boundaries", () => {
    const days = ["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06"];
    expect(dailyStreaks(days, "2026-10-06")).toEqual({ current: 2, best: 4 });
  });

  it("is zero with no history", () => {
    expect(dailyStreaks([], "2026-10-10")).toEqual({ current: 0, best: 0 });
  });
});
