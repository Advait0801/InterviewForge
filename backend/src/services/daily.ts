/**
 * Problem of the Day: which problem a date gets. Pure and deterministic -- the same date and
 * catalogue always give the same problem, on any machine, with no state.
 *
 * - The weekday sets the difficulty, as on LeetCode where the week gets harder: Monday and
 *   Tuesday easy, Wednesday to Friday medium, the weekend hard.
 * - Each difficulty walks a seeded shuffle of its problems, one per day of that difficulty,
 *   so no problem repeats until the whole pool has been used. Every pass through the pool
 *   (a "cycle") gets its own shuffle, and a cycle never starts with the problem the previous
 *   one ended on.
 *
 * Adding problems changes the shuffle, so the service records each day's pick the first time
 * it's asked for (daily_problems) and never recomputes a recorded day. Days are UTC.
 */

export type Difficulty = "easy" | "medium" | "hard";
export type CatalogueEntry = { id: string; slug: string; difficulty: string };

const DAY_MS = 86_400_000;

/** 0 = Sunday … 6 = Saturday. */
const DIFFICULTY_BY_WEEKDAY: Difficulty[] = ["hard", "easy", "easy", "medium", "medium", "medium", "hard"];

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Days since 1970-01-01 for a YYYY-MM-DD date (UTC), or null if it isn't a real date. */
export function dayNumber(date: string): number | null {
  if (!ISO_DATE.test(date)) return null;
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== date) return null;
  return Math.round(ms / DAY_MS);
}

export function dateOf(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** Today's UTC date. */
export function todayUtc(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return dateOf(dayNumber(date)! + days);
}

/** 1970-01-01 was a Thursday. */
function weekday(day: number): number {
  return (((day + 4) % 7) + 7) % 7;
}

export function difficultyFor(date: string): Difficulty {
  return DIFFICULTY_BY_WEEKDAY[weekday(dayNumber(date)!)];
}

/** How many earlier days (since the epoch) had the same difficulty as `day`. */
function ordinalWithinDifficulty(day: number): number {
  const difficulty = DIFFICULTY_BY_WEEKDAY[weekday(day)];
  const perWeek = DIFFICULTY_BY_WEEKDAY.filter((d) => d === difficulty).length;
  const weekStart = day - weekday(day);
  let ordinal = Math.floor(weekStart / 7) * perWeek;
  for (let d = weekStart; d < day; d++) if (DIFFICULTY_BY_WEEKDAY[weekday(d)] === difficulty) ordinal++;
  return ordinal;
}

/** Which pass through its difficulty's pool a date falls in (for tests and debugging). */
export function cycleOf(date: string, poolSize: number): number {
  return Math.floor(ordinalWithinDifficulty(dayNumber(date)!) / poolSize);
}

/** FNV-1a: a stable 32-bit seed from a string. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small seeded PRNG, identical across platforms. */
function random(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  const next = random(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function cycleOrder(pool: CatalogueEntry[], difficulty: Difficulty, cycle: number): CatalogueEntry[] {
  const order = shuffle(pool, hash(`${difficulty}:${cycle}`));
  if (cycle > 0 && order.length > 1) {
    const previous = shuffle(pool, hash(`${difficulty}:${cycle - 1}`));
    // The same problem on the last day of one cycle and the first of the next would be a
    // repeat on consecutive days of that difficulty.
    if (order[0].slug === previous[previous.length - 1].slug) [order[0], order[1]] = [order[1], order[0]];
  }
  return order;
}

/** The problem for `date`, or null when the catalogue has none of that day's difficulty. */
export function pickDaily(date: string, catalogue: CatalogueEntry[]): CatalogueEntry | null {
  const day = dayNumber(date);
  if (day === null) throw new Error(`Invalid date ${date}`);
  const difficulty = difficultyFor(date);
  // Sorted by slug, so the pick doesn't depend on the order rows come back in.
  const pool = catalogue
    .filter((p) => p.difficulty.toLowerCase() === difficulty)
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  if (!pool.length) return null;
  const ordinal = ordinalWithinDifficulty(day);
  const cycle = Math.floor(ordinal / pool.length);
  return cycleOrder(pool, difficulty, cycle)[ordinal % pool.length];
}

/**
 * Daily-challenge streaks from the days a user solved that day's problem on the day.
 * `current` counts back from today, or from yesterday if today isn't solved yet, so a
 * streak isn't shown as broken before the day is over.
 */
export function dailyStreaks(solvedDays: string[], today: string): { current: number; best: number } {
  const days = [...new Set(solvedDays.map((d) => dayNumber(d)!))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] === days[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const solved = new Set(days);
  let cursor = dayNumber(today)!;
  if (!solved.has(cursor)) cursor--;
  let current = 0;
  while (solved.has(cursor)) {
    current++;
    cursor--;
  }
  return { current, best };
}
