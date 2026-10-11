/**
 * Weak topics, and a personal path that practises them. Pure and deterministic: the same
 * history always gives the same topics and the same problems, in the same order. (The
 * recommendations endpoint picks with random(); a path a user follows over days must not
 * reshuffle every time they look at it.)
 *
 * A topic's struggle score is a smoothed rate of struggles over events:
 *
 *   struggles = failed submissions + review lapses + hinted problems
 *   score     = (struggles + 1) / (submissions + lapses + hinted problems + 2)
 *
 * A lapse or a hint is an event as well as a struggle, so the score stays below 1 however
 * many there are, and still rises with each one. (D-070 divided by submissions alone, which
 * reached 1.75; D-074.) The +1/+2 (Laplace) keeps one bad attempt from outranking a long
 * record: 1 fail of 1 scores 0.67, 6 fails of 10 scores 0.58, 0 of 3 scores 0.2. A topic is
 * weak at 0.4 and up, with at least two submissions behind it.
 */

export type TopicStats = {
  topic: string;
  submissions: number;
  failed: number;
  lapses: number;
  hintedProblems: number;
  problemsSolved: number;
};

export type FocusTopic = TopicStats & { score: number };

export type Candidate = { id: string; slug: string; title: string; difficulty: string; topics: string[] };

export type PathPlan = {
  focus: FocusTopic[];
  problems: Array<Candidate & { reason: string }>;
  difficultyLevel: "beginner" | "intermediate" | "advanced";
};

export const MIN_SUBMISSIONS = 3;
export const WEAK_SCORE = 0.4;
const MIN_TOPIC_SUBMISSIONS = 2;
const FOCUS_TOPICS = 3;
export const PATH_LENGTH = 10;
const DIFFICULTY_RANK: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

/** Why a plan can't be made; the service turns these into a 409 with a `code`. */
export class NoPlanError extends Error {
  constructor(readonly code: "not_enough_history" | "no_weak_topics" | "nothing_left_to_practise", message: string) {
    super(message);
  }
}

export function scoreTopic(t: TopicStats): number {
  const extra = t.lapses + t.hintedProblems;
  return Math.round(((t.failed + extra + 1) / (t.submissions + extra + 2)) * 1000) / 1000;
}

export function weakTopics(stats: TopicStats[]): FocusTopic[] {
  return stats
    .filter((t) => t.submissions >= MIN_TOPIC_SUBMISSIONS)
    .map((t) => ({ ...t, score: scoreTopic(t) }))
    .filter((t) => t.score >= WEAK_SCORE)
    .sort((a, b) => b.score - a.score || b.submissions - a.submissions || (a.topic < b.topic ? -1 : 1))
    .slice(0, FOCUS_TOPICS);
}

const norm = (t: string) => t.trim().toLowerCase();

export function planPath(stats: TopicStats[], totalSubmissions: number, unsolved: Candidate[]): PathPlan {
  if (totalSubmissions < MIN_SUBMISSIONS) {
    throw new NoPlanError("not_enough_history", `Submit at least ${MIN_SUBMISSIONS} solutions first, so there's something to learn from.`);
  }
  const focus = weakTopics(stats);
  if (!focus.length) {
    throw new NoPlanError("no_weak_topics", "No topic stands out as weak yet: every topic you've practised is going well.");
  }

  const focusNames = focus.map((f) => norm(f.topic));
  const covers = (c: Candidate) => c.topics.filter((t) => focusNames.includes(norm(t))).length;
  // Per topic: easiest first, then problems that practise several focus topics at once.
  const queues = focus.map((f) =>
    unsolved
      .filter((c) => c.topics.some((t) => norm(t) === norm(f.topic)))
      .sort(
        (a, b) =>
          (DIFFICULTY_RANK[a.difficulty] ?? 3) - (DIFFICULTY_RANK[b.difficulty] ?? 3) ||
          covers(b) - covers(a) ||
          (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)
      )
  );

  // Round-robin, weakest topic first, so every focus topic is practised early on.
  // A problem already taken for an earlier topic is skipped, not counted as that topic's turn.
  const picked: PathPlan["problems"] = [];
  const seen = new Set<string>();
  const next = queues.map(() => 0);
  let progressed = true;
  while (picked.length < PATH_LENGTH && progressed) {
    progressed = false;
    queues.forEach((queue, i) => {
      while (next[i] < queue.length && seen.has(queue[next[i]].id)) next[i]++;
      if (next[i] < queue.length && picked.length < PATH_LENGTH) {
        const c = queue[next[i]++];
        seen.add(c.id);
        picked.push({ ...c, reason: focus[i].topic });
        progressed = true;
      }
    });
  }
  if (!picked.length) {
    throw new NoPlanError("nothing_left_to_practise", "You've solved every problem in your weakest topics.");
  }

  const avg = picked.reduce((s, p) => s + (DIFFICULTY_RANK[p.difficulty] ?? 1), 0) / picked.length;
  return { focus, problems: picked, difficultyLevel: avg < 0.67 ? "beginner" : avg < 1.34 ? "intermediate" : "advanced" };
}
