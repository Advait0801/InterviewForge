/**
 * Does the Elo picker hit its target success rate? (Phase 12) Verification only; no I/O.
 *
 * Synthetic users with a known true skill per topic play the real problem set (labels and
 * topics from leetcode_problems.json). Each problem's true difficulty is its label's rating
 * plus noise the system never sees, so problem ratings have to be learned from play. A user
 * asks for the next problem, succeeds first time with the *true* probability, and the game
 * is rated with the production code (elo.ts). Everything is seeded: same options, same report.
 *
 * Measured over each user's picks after a warm-up: the realised first-try success rate (the
 * target is 65%), how far each user's own rate is from it, and calibration (predicted vs
 * realised by decile). Two baselines run on identical users and problems: a random
 * unattempted problem, and "next difficulty label up after a pass, down after a fail".
 */
import {
  DIFFICULTY_RATING,
  OVERALL,
  TARGET_SUCCESS,
  pickNext,
  problemStartRating,
  rateGame,
  topicsOf,
  type Rating,
} from "../services/elo";

export type SimProblem = { slug: string; difficulty: string; topics: string[] };

export type SimOptions = {
  problems: SimProblem[];
  users?: number;
  picks?: number;
  warmup?: number;
  seed?: number;
  /** Spread of true problem difficulty around its label's rating. */
  problemNoise?: number;
  /** Where users' true skill is centred: independent of where the system starts them. */
  userCenter?: number;
  /** Spread of users' overall skill, and of each topic around it. */
  userSpread?: number;
  topicSpread?: number;
  /**
   * The scale of the true success curve. 400 is the model Elo assumes; anything else tests
   * a world that doesn't match the model.
   */
  trueScale?: number;
  target?: number;
};

export type PolicyReport = {
  policy: string;
  games: number;
  successRate: number;
  /** Mean over users of |their own success rate - target|. */
  meanUserGap: number;
  /** Share of users whose own rate is within 0.10 of the target. */
  usersWithin10: number;
  meanPredicted?: number;
  calibration?: Array<{ predicted: number; realised: number; games: number }>;
};

export type SimReport = {
  options: Required<Omit<SimOptions, "problems">> & { problems: number };
  /** Knows the truth: the best any picker could do with these users and problems. */
  oracle: PolicyReport;
  elo: PolicyReport;
  random: PolicyReport;
  labelLadder: PolicyReport;
  /** Correlation between learned problem ratings and true difficulty, after the run. */
  problemRatingCorrelation: number;
  /** The same before any games (labels only). */
  labelCorrelation: number;
};

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(r: () => number): number {
  const u = Math.max(r(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

function correlation(xs: number[], ys: number[]): number {
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let dx = 0;
  let dy = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my);
    dx += (x - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  });
  return num / Math.sqrt(dx * dy);
}

type World = {
  problems: Array<SimProblem & { id: string; truth: number; topics: string[] }>;
  users: Array<{ skill: Map<string, number> }>;
};

function makeWorld(o: Required<Omit<SimOptions, "problems">>, problems: SimProblem[]): World {
  const r = rng(o.seed);
  const ps = problems.map((p, i) => ({
    ...p,
    id: `p${i}`,
    topics: topicsOf(p.topics),
    truth: problemStartRating(p.difficulty) + o.problemNoise * gaussian(r),
  }));
  const allTopics = [...new Set(ps.flatMap((p) => p.topics))].sort();
  const users = Array.from({ length: o.users }, () => {
    const base = o.userCenter + o.userSpread * gaussian(r);
    return { skill: new Map(allTopics.map((t) => [t, base + o.topicSpread * gaussian(r)])) };
  });
  return { problems: ps, users };
}

const trueSkill = (skill: Map<string, number>, topics: string[]) =>
  topics.reduce((acc, t) => acc + skill.get(t)!, 0) / topics.length;

function summarise(policy: string, perUser: number[][], target: number, predicted?: Array<[number, number]>): PolicyReport {
  const all = perUser.flat();
  const rates = perUser.filter((u) => u.length).map((u) => u.reduce((a, b) => a + b, 0) / u.length);
  const report: PolicyReport = {
    policy,
    games: all.length,
    successRate: round(all.reduce((a, b) => a + b, 0) / all.length),
    meanUserGap: round(rates.reduce((acc, x) => acc + Math.abs(x - target), 0) / rates.length),
    usersWithin10: round(rates.filter((x) => Math.abs(x - target) <= 0.1).length / rates.length),
  };
  if (predicted) {
    report.meanPredicted = round(predicted.reduce((a, [p]) => a + p, 0) / predicted.length);
    const bins = new Map<number, Array<[number, number]>>();
    for (const [p, s] of predicted) {
      const b = Math.min(9, Math.floor(p * 10));
      bins.set(b, [...(bins.get(b) ?? []), [p, s]]);
    }
    report.calibration = [...bins.entries()]
      .sort(([a], [b]) => a - b)
      .filter(([, xs]) => xs.length >= 20)
      .map(([, xs]) => ({
        predicted: round(xs.reduce((a, [p]) => a + p, 0) / xs.length),
        realised: round(xs.reduce((a, [, s]) => a + s, 0) / xs.length),
        games: xs.length,
      }));
  }
  return report;
}

const round = (x: number) => Math.round(x * 1000) / 1000;

export function simulateElo(options: SimOptions): SimReport {
  const o = {
    users: options.users ?? 200,
    picks: options.picks ?? 40,
    warmup: options.warmup ?? 10,
    seed: options.seed ?? 7,
    problemNoise: options.problemNoise ?? 150,
    userCenter: options.userCenter ?? 1500,
    userSpread: options.userSpread ?? 250,
    topicSpread: options.topicSpread ?? 100,
    trueScale: options.trueScale ?? 400,
    target: options.target ?? TARGET_SUCCESS,
  };
  const world = makeWorld(o, options.problems);
  const success = (u: World["users"][number], p: World["problems"][number]) =>
    1 / (1 + 10 ** ((p.truth - trueSkill(u.skill, p.topics)) / o.trueScale));

  // ── Elo: users play in turn, so problem ratings learn from everyone as they go ──
  const outcome = rng(o.seed + 1);
  const problemRatings = new Map(world.problems.map((p) => [p.id, { rating: problemStartRating(p.difficulty), games: 0 } as Rating]));
  const userRatings = world.users.map(() => new Map<string, Rating>());
  const attempted = world.users.map(() => new Set<string>());
  const eloScores: number[][] = world.users.map(() => []);
  const predicted: Array<[number, number]> = [];
  for (let round_ = 0; round_ < o.picks; round_++) {
    world.users.forEach((u, ui) => {
      const candidates = world.problems.map((p) => ({ ...p, rating: problemRatings.get(p.id)!.rating }));
      const [pick] = pickNext(userRatings[ui], candidates, { target: o.target, exclude: attempted[ui], limit: 1 });
      if (!pick) return;
      const p = world.problems.find((x) => x.id === pick.problem.id)!;
      const passed = outcome() < success(u, p);
      const game = rateGame({ ratings: userRatings[ui], topics: p.topics, problem: problemRatings.get(p.id)!, score: passed ? 1 : 0 });
      for (const t of game.topics) userRatings[ui].set(t.topic, { rating: t.rating, games: t.games });
      userRatings[ui].set(OVERALL, game.overall);
      problemRatings.set(p.id, game.problem);
      attempted[ui].add(p.id);
      if (round_ >= o.warmup) {
        eloScores[ui].push(passed ? 1 : 0);
        predicted.push([pick.predicted, passed ? 1 : 0]);
      }
    });
  }

  // ── Baselines, same users and problems, their own outcome stream ──
  const pickR = rng(o.seed + 2);
  const randomOutcome = rng(o.seed + 3);
  const randomScores = world.users.map((u) => {
    const pool = [...world.problems];
    const scores: number[] = [];
    for (let k = 0; k < o.picks && pool.length; k++) {
      const p = pool.splice(Math.floor(pickR() * pool.length), 1)[0];
      if (k >= o.warmup) scores.push(randomOutcome() < success(u, p) ? 1 : 0);
    }
    return scores;
  });

  const ladderOutcome = rng(o.seed + 4);
  const labels = Object.keys(DIFFICULTY_RATING).sort((a, b) => DIFFICULTY_RATING[a] - DIFFICULTY_RATING[b]);
  const ladderScores = world.users.map((u) => {
    const pool = [...world.problems];
    const scores: number[] = [];
    let level = 1; // start at medium
    for (let k = 0; k < o.picks && pool.length; k++) {
      // Nearest available label to the current level, first by slug: deterministic.
      const order = [level, level - 1, level + 1, level - 2, level + 2].filter((l) => l >= 0 && l < labels.length);
      const lvl = order.find((l) => pool.some((p) => p.difficulty === labels[l]));
      if (lvl === undefined) break;
      const idx = pool.findIndex((p) => p.difficulty === labels[lvl]);
      const p = pool.splice(idx, 1)[0];
      const passed = ladderOutcome() < success(u, p);
      if (k >= o.warmup) scores.push(passed ? 1 : 0);
      level = Math.max(0, Math.min(labels.length - 1, lvl + (passed ? 1 : -1)));
    }
    return scores;
  });

  // The ceiling: a picker that knows every true skill and difficulty. With a finite problem
  // set and 30 coin flips per user, not even it puts every user within 0.10 of the target.
  const oracleOutcome = rng(o.seed + 5);
  const oracleScores = world.users.map((u) => {
    const pool = [...world.problems];
    const scores: number[] = [];
    for (let k = 0; k < o.picks && pool.length; k++) {
      let best = 0;
      pool.forEach((p, i) => {
        if (Math.abs(success(u, p) - o.target) < Math.abs(success(u, pool[best]) - o.target)) best = i;
      });
      const p = pool.splice(best, 1)[0];
      if (k >= o.warmup) scores.push(oracleOutcome() < success(u, p) ? 1 : 0);
    }
    return scores;
  });

  return {
    options: { ...o, problems: options.problems.length },
    oracle: summarise("oracle", oracleScores, o.target),
    elo: summarise("elo", eloScores, o.target, predicted),
    random: summarise("random", randomScores, o.target),
    labelLadder: summarise("label ladder", ladderScores, o.target),
    problemRatingCorrelation: round(correlation(world.problems.map((p) => problemRatings.get(p.id)!.rating), world.problems.map((p) => p.truth))),
    labelCorrelation: round(correlation(world.problems.map((p) => problemStartRating(p.difficulty)), world.problems.map((p) => p.truth))),
  };
}
