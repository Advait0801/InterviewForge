import { describe, expect, it } from "vitest";
import { INITIAL_STATE, passQuality, sm2, type Sm2State } from "../services/sm2";

const run = (qualities: number[], start: Sm2State = INITIAL_STATE) => {
  const states: Sm2State[] = [];
  let s = start;
  for (const q of qualities) states.push((s = sm2(s, q)));
  return states;
};

describe("SM-2", () => {
  it("perfect recalls: intervals 1, 6, then x EF (EF grows 0.1 a time)", () => {
    // EF: 2.6, 2.7, 2.8, 2.9. Intervals: 1, 6, round(6 * 2.8) = 17, round(17 * 2.9) = 49.
    expect(run([5, 5, 5, 5]).map((s) => [s.intervalDays, s.easeFactor])).toEqual([
      [1, 2.6],
      [6, 2.7],
      [17, 2.8],
      [49, 2.9],
    ]);
  });

  it("quality 4 leaves EF unchanged; 3 lowers it by 0.14", () => {
    expect(sm2(INITIAL_STATE, 4).easeFactor).toBe(2.5);
    expect(sm2(INITIAL_STATE, 3).easeFactor).toBe(2.36);
  });

  it("a lapse (q < 3) restarts the repetitions: due tomorrow, EF still updated", () => {
    const [, , third, lapse, after] = run([5, 5, 5, 1, 4]);
    expect(third.repetitions).toBe(3);
    // q=1: EF 2.8 + (0.1 - 4 * (0.08 + 4 * 0.02)) = 2.8 - 0.54 = 2.26.
    expect(lapse).toEqual({ easeFactor: 2.26, intervalDays: 1, repetitions: 0, lapses: 1 });
    expect(after).toMatchObject({ intervalDays: 1, repetitions: 1, lapses: 1 });
  });

  it("EF never drops below 1.3", () => {
    const states = run([0, 0, 0, 0, 0, 0]);
    expect(Math.min(...states.map((s) => s.easeFactor))).toBe(1.3);
    expect(states.at(-1)!.easeFactor).toBe(1.3);
  });

  it("rejects a grade outside 0-5", () => {
    expect(() => sm2(INITIAL_STATE, 6)).toThrow();
    expect(() => sm2(INITIAL_STATE, 2.5)).toThrow();
  });
});

describe("passQuality", () => {
  it.each([
    [0, false, 5],
    [0, true, 4],
    [1, false, 4],
    [1, true, 3],
    [2, false, 3],
    [9, true, 3],
  ])("%i failures, hinted=%s -> %i (never below 3: a pass is a recall)", (failures, hinted, expected) => {
    expect(passQuality(failures, hinted)).toBe(expected);
  });
});
