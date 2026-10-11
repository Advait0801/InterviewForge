/**
 * SM-2 spaced repetition (Woźniak, 1987), as SuperMemo 2 specifies it.
 *
 * After each review, graded 0-5:
 *   EF' = max(1.3, EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
 *   q < 3:  start over -- repetitions 0, next review in 1 day (a lapse)
 *   q >= 3: repetitions + 1; interval 1, then 6, then round(previous interval * EF')
 *
 * The ease factor is updated first and the new one sets the interval. Pure: the review
 * queue (review.service.ts) stores the state and decides the grade.
 */

export type Sm2State = { easeFactor: number; intervalDays: number; repetitions: number; lapses: number };

export const INITIAL_STATE: Sm2State = { easeFactor: 2.5, intervalDays: 0, repetitions: 0, lapses: 0 };

const MIN_EASE = 1.3;

export function sm2(state: Sm2State, quality: number): Sm2State {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) throw new Error(`SM-2 quality must be 0-5, got ${quality}`);
  const miss = 5 - quality;
  // Rounded so repeated reviews don't accumulate float noise in the stored value.
  const easeFactor = Math.max(MIN_EASE, Math.round((state.easeFactor + (0.1 - miss * (0.08 + miss * 0.02))) * 1000) / 1000);

  if (quality < 3) {
    return { easeFactor, intervalDays: 1, repetitions: 0, lapses: state.lapses + 1 };
  }
  const repetitions = state.repetitions + 1;
  const intervalDays = repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round(state.intervalDays * easeFactor);
  return { easeFactor, intervalDays, repetitions, lapses: state.lapses };
}

/** A failed submission: the user didn't recall how to solve it. */
export const FAILED_QUALITY = 1;

/**
 * A passing submission's grade: 5 for a clean pass, one less for each failed attempt since
 * the last review (at most two less), and one less if hints were shown -- never below 3,
 * because a pass is a successful recall, however hard-won.
 */
export function passQuality(failuresSinceReview: number, hinted: boolean): number {
  return Math.max(3, 5 - Math.min(failuresSinceReview, 2) - (hinted ? 1 : 0));
}
