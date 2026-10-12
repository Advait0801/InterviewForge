/**
 * Elo-rated adaptive difficulty (Phase 12). Pure: no I/O, no randomness.
 *
 * Users are rated per topic, problems once. A rated game is a user's first Submit of a
 * problem: one game per user and problem, so retrying can't farm rating, and "success" means
 * succeeding first time, which is what the picker aims at. Score 1 for a pass, 0.5 for a pass
 * after viewing hints, 0 for a fail.
 *
 * A problem with several topics is played against the mean of the user's ratings in them,
 * and every one of those topics moves by the same delta: the game says how the user did on
 * the combination, not which topic carried it. A problem starts at its difficulty label's
 * rating and learns from everyone's games.
 *
 * Topics are sparse (40 problems spread over ~15 topics is 2-3 games each), so a user also
 * has an OVERALL rating that moves on every game. A topic's rating starts from the overall
 * one rather than from scratch, and until a topic has a few games of its own its rating is
 * blended toward the overall: weight games / (games + TOPIC_SHRINK). Measured in the
 * simulation: per-topic ratings alone put 46% of users within 0.10 of the target rate.
 *
 * The picker chooses, among problems the user hasn't attempted, the one whose predicted
 * success is closest to TARGET_SUCCESS: hard enough to learn from, likely enough to finish.
 */

export const INITIAL_USER_RATING = 1500;
export const DIFFICULTY_RATING: Record<string, number> = { easy: 1200, medium: 1500, hard: 1800 };
export const TARGET_SUCCESS = clampTarget(Number(process.env.ELO_TARGET_SUCCESS ?? 0.65));
/** A problem with no topics still rates the user somewhere. */
export const GENERAL_TOPIC = "general";
/** The user's rating across every game; stored like a topic, never shown as one. */
export const OVERALL = "__overall__";
/** Games after which a topic's own rating carries half the weight. */
export const TOPIC_SHRINK = 4;

function clampTarget(x: number): number {
  return Number.isFinite(x) && x > 0.05 && x < 0.95 ? x : 0.65;
}

/** Larger steps while a rating is provisional, so a new user or problem settles quickly. */
export const userK = (games: number) => (games < 10 ? 40 : 24);
export const problemK = (games: number) => (games < 20 ? 24 : 12);

export type Rating = { rating: number; games: number };
export type TopicRating = Rating & { topic: string };

export function expectedScore(userRating: number, problemRating: number): number {
  return 1 / (1 + 10 ** ((problemRating - userRating) / 400));
}

export function problemStartRating(difficulty: string): number {
  return DIFFICULTY_RATING[difficulty] ?? DIFFICULTY_RATING.medium;
}

export function topicsOf(topics: readonly string[] | null | undefined): string[] {
  const unique = [...new Set((topics ?? []).filter((t) => t && t !== OVERALL))].sort();
  return unique.length ? unique : [GENERAL_TOPIC];
}

export function overallOf(ratings: ReadonlyMap<string, Rating>): Rating {
  return ratings.get(OVERALL) ?? { rating: INITIAL_USER_RATING, games: 0 };
}

/** A topic's effective rating: its own, shrunk toward the overall while it has few games. */
export function topicRating(ratings: ReadonlyMap<string, Rating>, topic: string): number {
  const overall = overallOf(ratings).rating;
  const own = ratings.get(topic);
  if (!own) return overall;
  const w = own.games / (own.games + TOPIC_SHRINK);
  return w * own.rating + (1 - w) * overall;
}

/** The user's rating against a problem: the mean of its topics' effective ratings. */
export function userRatingFor(ratings: ReadonlyMap<string, Rating>, topics: readonly string[]): number {
  const ts = topicsOf(topics);
  return ts.reduce((acc, t) => acc + topicRating(ratings, t), 0) / ts.length;
}

export function scoreFor(passed: boolean, hinted: boolean): number {
  if (!passed) return 0;
  return hinted ? 0.5 : 1;
}

export type GameResult = {
  expected: number;
  score: number;
  userBefore: number;
  problemBefore: number;
  /** One entry per topic of the problem, after the game. */
  topics: TopicRating[];
  overall: Rating;
  problem: Rating;
  delta: number;
};

export function rateGame(input: {
  ratings: ReadonlyMap<string, Rating>;
  topics: readonly string[];
  problem: Rating;
  score: number;
}): GameResult {
  const ts = topicsOf(input.topics);
  const userBefore = userRatingFor(input.ratings, ts);
  const expected = expectedScore(userBefore, input.problem.rating);
  const surprise = input.score - expected;
  const overall = overallOf(input.ratings);
  // The provisional K of the least-played topic: a game in a new topic moves it quickly.
  const games = Math.min(...ts.map((t) => input.ratings.get(t)?.games ?? 0));
  const delta = userK(games) * surprise;
  return {
    expected,
    score: input.score,
    userBefore,
    problemBefore: input.problem.rating,
    topics: ts.map((topic) => {
      // A topic's first game starts from where the user stands overall.
      const r = input.ratings.get(topic) ?? { rating: overall.rating, games: 0 };
      return { topic, rating: r.rating + delta, games: r.games + 1 };
    }),
    overall: { rating: overall.rating + userK(overall.games) * surprise, games: overall.games + 1 },
    problem: { rating: input.problem.rating - problemK(input.problem.games) * surprise, games: input.problem.games + 1 },
    delta,
  };
}

export type Candidate = { id: string; slug: string; rating: number; topics: readonly string[] };
export type Pick<P extends Candidate> = { problem: P; predicted: number; userRating: number };

/**
 * The problems closest to the target success, best first. Ties go to the lower problem
 * rating, then the slug, so the same state always gives the same pick.
 */
export function pickNext<P extends Candidate>(
  ratings: ReadonlyMap<string, Rating>,
  problems: readonly P[],
  options: { target?: number; exclude?: ReadonlySet<string>; topic?: string; limit?: number } = {}
): Array<Pick<P>> {
  const target = options.target ?? TARGET_SUCCESS;
  const scored = problems
    .filter((p) => !options.exclude?.has(p.id))
    .filter((p) => !options.topic || topicsOf(p.topics).includes(options.topic))
    .map((p) => {
      const userRating = userRatingFor(ratings, p.topics);
      return { problem: p, userRating, predicted: expectedScore(userRating, p.rating) };
    });
  scored.sort(
    (a, b) =>
      Math.abs(a.predicted - target) - Math.abs(b.predicted - target) ||
      a.problem.rating - b.problem.rating ||
      a.problem.slug.localeCompare(b.problem.slug)
  );
  return scored.slice(0, options.limit ?? 3);
}
