import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  GENERAL_TOPIC,
  INITIAL_USER_RATING,
  OVERALL,
  TOPIC_SHRINK,
  expectedScore,
  pickNext,
  problemK,
  problemStartRating,
  rateGame,
  scoreFor,
  topicRating,
  topicsOf,
  userK,
  userRatingFor,
  type Rating,
} from "../services/elo";
import { simulateElo } from "../eval/elo-simulation";

const ratings = (entries: Array<[string, number, number]>) =>
  new Map<string, Rating>(entries.map(([t, rating, games]) => [t, { rating, games }]));

describe("the Elo curve", () => {
  it("is 0.5 at equal ratings, ~0.91 at +400, and symmetric", () => {
    expect(expectedScore(1500, 1500)).toBe(0.5);
    expect(expectedScore(1900, 1500)).toBeCloseTo(0.909, 3);
    expect(expectedScore(1500, 1700) + expectedScore(1700, 1500)).toBeCloseTo(1, 12);
  });

  it("starts problems at their label and unknown labels at medium", () => {
    expect([problemStartRating("easy"), problemStartRating("medium"), problemStartRating("hard")]).toEqual([1200, 1500, 1800]);
    expect(problemStartRating("weird")).toBe(1500);
  });

  it("scores a pass 1, a hinted pass 0.5, a fail 0", () => {
    expect([scoreFor(true, false), scoreFor(true, true), scoreFor(false, true), scoreFor(false, false)]).toEqual([1, 0.5, 0, 0]);
  });

  it("uses larger steps while provisional", () => {
    expect([userK(0), userK(9), userK(10)]).toEqual([40, 40, 24]);
    expect([problemK(0), problemK(19), problemK(20)]).toEqual([24, 24, 12]);
  });
});

describe("topics", () => {
  it("are deduplicated and sorted; none at all is 'general'; the overall pseudo-topic is never one", () => {
    expect(topicsOf(["graph", "array", "graph"])).toEqual(["array", "graph"]);
    expect(topicsOf([])).toEqual([GENERAL_TOPIC]);
    expect(topicsOf(null)).toEqual([GENERAL_TOPIC]);
    expect(topicsOf([OVERALL, "array"])).toEqual(["array"]);
  });

  it("an unplayed topic is the overall rating; a sparse one is blended toward it", () => {
    const r = ratings([[OVERALL, 1700, 30], ["array", 1500, TOPIC_SHRINK]]);
    expect(topicRating(r, "graph")).toBe(1700);
    expect(topicRating(r, "array")).toBe(1600); // half weight at TOPIC_SHRINK games
    expect(userRatingFor(r, ["array", "graph"])).toBe(1650);
  });

  it("a brand-new user is at the start rating everywhere", () => {
    expect(userRatingFor(new Map(), ["array"])).toBe(INITIAL_USER_RATING);
  });
});

describe("rateGame", () => {
  const problem = { rating: 1500, games: 0 };

  it("moves the user and the problem in opposite directions by their K times the surprise", () => {
    const g = rateGame({ ratings: new Map(), topics: ["array"], problem, score: 1 });
    expect(g.expected).toBe(0.5);
    expect(g.delta).toBe(20); // 40 x 0.5
    expect(g.topics).toEqual([{ topic: "array", rating: 1520, games: 1 }]);
    expect(g.overall).toEqual({ rating: 1520, games: 1 });
    expect(g.problem).toEqual({ rating: 1488, games: 1 }); // 24 x 0.5
  });

  it("a fail against a much weaker problem costs more than a fail against a stronger one", () => {
    const weak = rateGame({ ratings: new Map(), topics: ["a"], problem: { rating: 1100, games: 50 }, score: 0 });
    const strong = rateGame({ ratings: new Map(), topics: ["a"], problem: { rating: 1900, games: 50 }, score: 0 });
    expect(weak.delta).toBeLessThan(strong.delta);
    expect(strong.delta).toBeLessThan(0);
  });

  it("every topic of the problem moves by the same delta; a new topic starts from the overall", () => {
    const r = ratings([[OVERALL, 1700, 12], ["array", 1600, 12]]);
    const g = rateGame({ ratings: r, topics: ["array", "hash-table"], problem: { rating: 1650, games: 40 }, score: 0 });
    const [array, hash] = g.topics;
    expect(array.rating - 1600).toBeCloseTo(g.delta, 12);
    expect(hash.rating - 1700).toBeCloseTo(g.delta, 12);
    expect(hash.games).toBe(1);
    // A new topic's K is provisional, so the game moves both topics by 40, not 24.
    expect(Math.abs(g.delta)).toBeCloseTo(40 * g.expected, 12);
  });
});

describe("pickNext", () => {
  const problems = [
    { id: "1", slug: "easy-one", rating: 1200, topics: ["array"] },
    { id: "2", slug: "medium-one", rating: 1500, topics: ["array"] },
    { id: "3", slug: "near-target", rating: 1392, topics: ["graph"] },
    { id: "4", slug: "hard-one", rating: 1800, topics: ["graph"] },
  ];

  it("picks the problem whose predicted success is closest to the target", () => {
    const [best] = pickNext(new Map(), problems, { target: 0.65 });
    expect(best.problem.slug).toBe("near-target");
    expect(best.predicted).toBeCloseTo(0.65, 2);
  });

  it("skips excluded problems and filters by topic", () => {
    expect(pickNext(new Map(), problems, { target: 0.65, exclude: new Set(["3"]) })[0].problem.slug).toBe("medium-one");
    expect(pickNext(new Map(), problems, { target: 0.65, topic: "array" }).map((p) => p.problem.slug)).toEqual(["medium-one", "easy-one"]);
  });

  it("is deterministic on ties: lower rating, then slug", () => {
    const twins = [
      { id: "b", slug: "b", rating: 1392, topics: ["x"] },
      { id: "a", slug: "a", rating: 1392, topics: ["x"] },
    ];
    expect(pickNext(new Map(), twins, { target: 0.65 }).map((p) => p.problem.slug)).toEqual(["a", "b"]);
  });

  it("a stronger user is offered harder problems", () => {
    const strong = ratings([[OVERALL, 1900, 40]]);
    expect(pickNext(strong, problems, { target: 0.65 })[0].problem.slug).toBe("hard-one");
  });
});

describe("the simulation (src/eval/elo-simulation.ts)", () => {
  const problems = (JSON.parse(readFileSync(join(__dirname, "..", "..", "leetcode_problems.json"), "utf8")) as Array<{
    slug: string;
    difficulty: string;
    topics: string[];
  }>).map(({ slug, difficulty, topics }) => ({ slug, difficulty: difficulty.toLowerCase(), topics }));
  const report = simulateElo({ problems, users: 120, picks: 35, warmup: 10, seed: 3 });

  it("realised first-try success lands in the target band", () => {
    expect(report.elo.successRate).toBeGreaterThanOrEqual(0.6);
    expect(report.elo.successRate).toBeLessThanOrEqual(0.7);
    expect(Math.abs(report.elo.meanPredicted! - 0.65)).toBeLessThan(0.02);
  });

  it("holds each user near the target far better than random or a difficulty-label ladder", () => {
    expect(report.elo.meanUserGap).toBeLessThan(report.random.meanUserGap * 0.6);
    expect(report.elo.meanUserGap).toBeLessThan(report.labelLadder.meanUserGap * 0.75);
    // ...and close to a picker that knows every true skill and difficulty.
    expect(report.elo.meanUserGap).toBeLessThan(report.oracle.meanUserGap + 0.02);
  });

  it("learns problem difficulty beyond what the labels say", () => {
    expect(report.problemRatingCorrelation).toBeGreaterThan(report.labelCorrelation);
  });

  it("is deterministic", () => {
    expect(simulateElo({ problems, users: 20, picks: 12, seed: 5 })).toEqual(simulateElo({ problems, users: 20, picks: 12, seed: 5 }));
  });
});
