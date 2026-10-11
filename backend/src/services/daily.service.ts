import * as daily from "../repositories/daily.repository";
import { addDays, dailyStreaks, dayNumber, pickDaily, todayUtc } from "./daily";
import { badRequest, notFound } from "./errors";

/** How far back a day's problem can be looked up. */
export const HISTORY_LIMIT_DAYS = 365;
export const MAX_HISTORY_PAGE = 60;

const summary = (r: daily.DailyRow) => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  difficulty: r.difficulty,
  topics: r.topics,
});

/** The recorded problem for each date, recording (and so freezing) any day not yet asked for. */
async function ensureDays(from: string, to: string): Promise<Map<string, daily.DailyRow>> {
  const rows = await daily.recordedDays(from, to);
  const have = new Set(rows.map((r) => r.day));
  const missing: string[] = [];
  for (let d = to; d >= from; d = addDays(d, -1)) if (!have.has(d)) missing.push(d);
  if (!missing.length) return new Map(rows.map((r) => [r.day, r]));

  const catalogue = await daily.catalogue();
  const picks = missing.flatMap((day) => {
    const p = pickDaily(day, catalogue);
    return p ? [{ day, problemId: p.id }] : [];
  });
  await daily.recordDays(picks);
  // Read back rather than trust our picks: a concurrent request may have recorded first.
  const all = await daily.recordedDays(from, to);
  return new Map(all.map((r) => [r.day, r]));
}

function checkDate(date: string, today: string) {
  const day = dayNumber(date);
  if (day === null) throw badRequest("date must be a real date, YYYY-MM-DD");
  if (date > today) throw badRequest("No problem of the day for a future date");
  if (day < dayNumber(today)! - HISTORY_LIMIT_DAYS) throw badRequest(`date must be within the last ${HISTORY_LIMIT_DAYS} days`);
}

async function streakFor(userId: string, today: string) {
  return dailyStreaks(await daily.daysSolvedOnTheDay(userId), today);
}

/**
 * One day's problem (today by default, in UTC). Signed in, also whether the user solved it
 * on that day, has ever solved it, and their daily streak.
 */
export async function getDaily(date: string | undefined, userId: string | undefined, now = Date.now()) {
  const today = todayUtc(now);
  const day = date ?? today;
  checkDate(day, today);
  const row = (await ensureDays(day, day)).get(day);
  if (!row) throw notFound("No problems to choose from");

  const base = { date: day, problem: summary(row) };
  if (!userId) return base;
  const [solvedOnDay, solved, streak] = await Promise.all([
    daily.daysSolvedOnTheDay(userId, day, day),
    daily.solvedAmong(userId, [row.id]),
    streakFor(userId, today),
  ]);
  return { ...base, solvedOnDay: solvedOnDay.length > 0, solved: solved.has(row.id), streak };
}

/** The last `days` days, newest first. */
export async function getDailyHistory(days: number, userId: string | undefined, now = Date.now()) {
  const today = todayUtc(now);
  const from = addDays(today, -(days - 1));
  const recorded = await ensureDays(from, today);
  const entries = [...recorded.values()].sort((a, b) => (a.day < b.day ? 1 : -1));

  if (!userId) return { days: entries.map((r) => ({ date: r.day, problem: summary(r) })) };
  const [solvedDays, solved, streak] = await Promise.all([
    daily.daysSolvedOnTheDay(userId, from, today),
    daily.solvedAmong(userId, entries.map((r) => r.id)),
    streakFor(userId, today),
  ]);
  const onDay = new Set(solvedDays);
  return {
    days: entries.map((r) => ({ date: r.day, problem: summary(r), solvedOnDay: onDay.has(r.day), solved: solved.has(r.id) })),
    streak,
  };
}
