import type { Queryable } from "../db";
import * as review from "../repositories/review.repository";
import { addDays, todayUtc } from "./daily";
import { badRequest, notFound } from "./errors";
import { FAILED_QUALITY, INITIAL_STATE, passQuality, sm2, type Sm2State } from "./sm2";

/**
 * The review queue: problems a user struggled with, rescheduled by SM-2 (sm2.ts).
 *
 * Every Submit (never Run) updates it, in the submission's own transaction:
 * - A failure always counts as a lapse (quality 1, due tomorrow), and enrols the problem if
 *   it isn't in the queue yet.
 * - A pass enrols a problem the user struggled with (failed attempts, or hints shown) and
 *   grades it at once. A clean first pass never enters the queue.
 * - A pass on a queued problem is graded only once it's due; solving it early is practice
 *   and leaves the schedule alone, as SM-2 intends.
 * The grade for a pass (passQuality) comes from failed attempts and hints since the last
 * review. Dates are UTC days.
 */

export type ReviewOutcome =
  | { action: "enrolled" | "reviewed" | "lapsed"; quality: number; dueOn: string; intervalDays: number }
  | { action: "unchanged"; dueOn: string }
  | null;

const stateOf = (row: review.ReviewItemRow): Sm2State => ({
  easeFactor: row.ease_factor,
  intervalDays: row.interval_days,
  repetitions: row.repetitions,
  lapses: row.lapses,
});

export async function recordSubmission(
  db: Queryable,
  input: { userId: string; problemId: string; passed: boolean },
  now = Date.now()
): Promise<ReviewOutcome> {
  const { userId, problemId, passed } = input;
  const today = todayUtc(now);
  const item = await review.findItemForUpdate(db, userId, problemId);

  if (!item) {
    let quality: number;
    if (passed) {
      const [failures, hinted] = await Promise.all([
        review.failuresSince(db, userId, problemId, null),
        review.hintedSince(db, userId, problemId, null),
      ]);
      if (failures === 0 && !hinted) return null; // a clean first pass: nothing to review
      quality = passQuality(failures, hinted);
    } else {
      quality = FAILED_QUALITY;
    }
    const next = sm2(INITIAL_STATE, quality);
    const dueOn = addDays(today, next.intervalDays);
    await review.insertItem(db, userId, problemId, { ...next, dueOn, quality, reviewed: true }, passed ? "struggled" : "failed");
    return { action: "enrolled", quality, dueOn, intervalDays: next.intervalDays };
  }

  if (passed && item.due_on > today) return { action: "unchanged", dueOn: item.due_on };

  let quality = FAILED_QUALITY;
  if (passed) {
    const since = item.last_reviewed_at ?? item.created_at;
    const [failures, hinted] = await Promise.all([
      review.failuresSince(db, userId, problemId, since),
      review.hintedSince(db, userId, problemId, since),
    ]);
    quality = passQuality(failures, hinted);
  }
  const next = sm2(stateOf(item), quality);
  const dueOn = addDays(today, next.intervalDays);
  await review.updateItem(db, userId, problemId, { ...next, dueOn, quality, reviewed: true });
  return { action: passed ? "reviewed" : "lapsed", quality, dueOn, intervalDays: next.intervalDays };
}

const item = (r: review.QueueRow) => ({
  problemId: r.problem_id,
  slug: r.slug,
  title: r.title,
  difficulty: r.difficulty,
  topics: r.topics,
  dueOn: r.due_on,
  intervalDays: r.interval_days,
  repetitions: r.repetitions,
  easeFactor: r.ease_factor,
  lapses: r.lapses,
  lastQuality: r.last_quality,
  lastReviewedAt: r.last_reviewed_at,
  source: r.source,
});

/** How many not-yet-due items the queue shows. */
export const UPCOMING_LIMIT = 20;

export async function getQueue(userId: string, now = Date.now()) {
  const today = todayUtc(now);
  const rows = await review.listItems(userId);
  const due = rows.filter((r) => r.due_on <= today);
  return {
    today,
    due: due.map(item),
    upcoming: rows.filter((r) => r.due_on > today).slice(0, UPCOMING_LIMIT).map(item),
    counts: { due: due.length, total: rows.length },
  };
}

/** Add a problem by hand, due today. False when it was already queued. */
export async function addToQueue(userId: string, problemId: string, now = Date.now()): Promise<boolean> {
  if ((await review.hintCount(problemId)) === null) throw notFound("Problem not found");
  return review.addManualItem(userId, problemId, todayUtc(now));
}

export async function removeFromQueue(userId: string, problemId: string): Promise<void> {
  if (!(await review.deleteItem(userId, problemId))) throw notFound("Problem isn't in your review queue");
}

export async function recordHintViews(userId: string, problemId: string, count: number): Promise<number> {
  const hints = await review.hintCount(problemId);
  if (hints === null) throw notFound("Problem not found");
  if (count > hints) throw badRequest(`This problem has ${hints} hint${hints === 1 ? "" : "s"}`);
  return review.recordHintViews(userId, problemId, count);
}
