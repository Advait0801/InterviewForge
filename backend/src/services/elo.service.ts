import type { Queryable } from "../db";
import * as repo from "../repositories/elo.repository";
import { hintedSince } from "../repositories/review.repository";
import {
  OVERALL,
  TARGET_SUCCESS,
  overallOf,
  pickNext,
  problemStartRating,
  rateGame,
  scoreFor,
  topicRating,
  userRatingFor,
  type Rating,
} from "./elo";

/** What a Submit reports about the rating; null when the submission wasn't a rated game. */
export type RatingOutcome = {
  score: number;
  /** The predicted chance of passing first time, before the game. */
  expected: number;
  before: number;
  after: number;
  delta: number;
} | null;

const toMap = (rows: repo.RatingRow[]) => new Map<string, Rating>(rows.map((r) => [r.topic, { rating: r.rating, games: r.games }]));
const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Rate the user's first Submit of a problem (D-076). Runs inside the submission's
 * transaction, after the submission is inserted; any later Submit of the problem is not a
 * game. Score: 1 pass, 0.5 pass after viewing hints, 0 fail.
 */
export async function recordRatedGame(
  db: Queryable,
  input: { userId: string; problemId: string; submissionId: string; passed: boolean }
): Promise<RatingOutcome> {
  if ((await repo.countSubmissions(db, input.userId, input.problemId)) !== 1) return null;
  const problem = await repo.findProblemForRating(db, input.problemId);
  if (!problem) return null;

  const ratings = toMap(await repo.lockUserRatings(db, input.userId));
  const problemRating = await repo.lockProblemRating(db, problem.id, problemStartRating(problem.difficulty.toLowerCase()));
  const hinted = input.passed && (await hintedSince(db, input.userId, input.problemId, null));
  const game = rateGame({ ratings, topics: problem.topics, problem: problemRating, score: scoreFor(input.passed, hinted) });

  const claimed = await repo.claimRatedGame(db, {
    userId: input.userId,
    problemId: problem.id,
    submissionId: input.submissionId,
    score: game.score,
    expected: game.expected,
    userRatingBefore: game.userBefore,
    problemRatingBefore: game.problemBefore,
    delta: game.delta,
  });
  if (!claimed) return null;

  await repo.saveUserRatings(db, input.userId, [...game.topics, { topic: OVERALL, ...game.overall }]);
  await repo.saveProblemRating(db, problem.id, game.problem);

  const after = new Map(ratings);
  for (const t of game.topics) after.set(t.topic, { rating: t.rating, games: t.games });
  after.set(OVERALL, game.overall);
  return {
    score: game.score,
    expected: Math.round(game.expected * 1000) / 1000,
    before: round1(game.userBefore),
    after: round1(userRatingFor(after, problem.topics)),
    delta: round1(game.delta),
  };
}

export async function getMyRatings(userId: string) {
  const ratings = toMap(await repo.findUserRatings(userId));
  const overall = overallOf(ratings);
  const topics = [...ratings.entries()]
    .filter(([topic]) => topic !== OVERALL)
    .map(([topic, r]) => ({ topic, rating: round1(topicRating(ratings, topic)), games: r.games }))
    .sort((a, b) => b.games - a.games || a.topic.localeCompare(b.topic));
  return { overall: { rating: round1(overall.rating), games: overall.games }, topics };
}

/** The unattempted problems whose predicted first-try success is closest to the target. */
export async function getNextProblems(userId: string, options: { topic?: string } = {}) {
  const ratings = toMap(await repo.findUserRatings(userId));
  const problems = (await repo.listUnattemptedProblems(userId)).map((p) => ({
    ...p,
    rating: p.rating ?? problemStartRating(p.difficulty.toLowerCase()),
  }));
  const picks = pickNext(ratings, problems, { topic: options.topic, limit: 3 });
  return {
    target: TARGET_SUCCESS,
    picks: picks.map(({ problem, predicted, userRating }) => ({
      problem: { id: problem.id, slug: problem.slug, title: problem.title, difficulty: problem.difficulty, topics: problem.topics },
      predictedSuccess: Math.round(predicted * 1000) / 1000,
      problemRating: round1(problem.rating),
      userRating: round1(userRating),
    })),
  };
}
