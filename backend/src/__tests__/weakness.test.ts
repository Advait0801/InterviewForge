import { describe, expect, it } from "vitest";
import { NoPlanError, PATH_LENGTH, planPath, scoreTopic, weakTopics, type Candidate, type TopicStats } from "../services/weakness";

const stat = (topic: string, submissions: number, failed: number, extra: Partial<TopicStats> = {}): TopicStats => ({
  topic,
  submissions,
  failed,
  lapses: 0,
  hintedProblems: 0,
  problemsSolved: 0,
  ...extra,
});

const problem = (slug: string, difficulty: string, topics: string[]): Candidate => ({ id: `id-${slug}`, slug, title: slug, difficulty, topics });

describe("scoreTopic", () => {
  it("is a Laplace-smoothed struggle rate", () => {
    expect(scoreTopic(stat("a", 1, 1))).toBe(0.667);
    expect(scoreTopic(stat("a", 10, 6))).toBe(0.583);
    expect(scoreTopic(stat("a", 3, 0))).toBe(0.2);
    expect(scoreTopic(stat("a", 4, 1, { lapses: 1, hintedProblems: 1 }))).toBe(0.667);
  });
});

describe("weakTopics", () => {
  it("keeps topics at 0.4+ with 2+ submissions, weakest first, at most 3", () => {
    const topics = weakTopics([
      stat("Arrays", 10, 1), // 0.167
      stat("Graphs", 4, 3), // 0.667
      stat("DP", 6, 4), // 0.625
      stat("Trees", 1, 1), // one submission: not enough
      stat("Heaps", 8, 4), // 0.5
      stat("Tries", 5, 2), // 0.429
    ]);
    expect(topics.map((t) => t.topic)).toEqual(["Graphs", "DP", "Heaps"]);
  });

  it("breaks ties by more evidence, then by name", () => {
    expect(weakTopics([stat("B", 2, 1), stat("A", 2, 1), stat("C", 6, 3)]).map((t) => t.topic)).toEqual(["C", "A", "B"]);
  });
});

describe("planPath", () => {
  const unsolved = [
    problem("g-hard", "hard", ["Graphs"]),
    problem("g-easy", "easy", ["Graphs"]),
    problem("g-med", "medium", ["Graphs"]),
    problem("dp-easy", "easy", ["DP"]),
    problem("dp-graph-easy", "easy", ["DP", "Graphs"]),
    problem("dp-med", "medium", ["DP"]),
    problem("array", "easy", ["Arrays"]),
  ];
  const stats = [stat("Graphs", 4, 3), stat("DP", 6, 4), stat("Arrays", 10, 0)];

  it("alternates weak topics, easiest first, preferring problems that cover several", () => {
    const plan = planPath(stats, 20, unsolved);
    expect(plan.focus.map((f) => f.topic)).toEqual(["Graphs", "DP"]);
    expect(plan.problems.map((p) => [p.slug, p.reason])).toEqual([
      ["dp-graph-easy", "Graphs"], // easy, and covers both
      ["dp-easy", "DP"],
      ["g-easy", "Graphs"],
      ["dp-med", "DP"],
      ["g-med", "Graphs"],
      ["g-hard", "Graphs"],
    ]);
    expect(plan.problems.some((p) => p.slug === "array")).toBe(false);
  });

  it("is deterministic: same input, same path, whatever order the problems arrive in", () => {
    const a = planPath(stats, 20, unsolved);
    const b = planPath([...stats].reverse(), 20, [...unsolved].reverse());
    expect(b).toEqual(a);
  });

  it(`stops at ${PATH_LENGTH} problems`, () => {
    const many = Array.from({ length: 30 }, (_, i) => problem(`g${String(i).padStart(2, "0")}`, "medium", ["Graphs"]));
    expect(planPath([stat("Graphs", 4, 3)], 4, many).problems).toHaveLength(PATH_LENGTH);
  });

  it("matches topics case-insensitively", () => {
    expect(planPath([stat("graphs", 4, 3)], 4, [problem("x", "easy", ["Graphs"])]).problems).toHaveLength(1);
  });

  it.each([
    ["not_enough_history", [stat("Graphs", 2, 2)], 2, unsolved],
    ["no_weak_topics", [stat("Graphs", 10, 0)], 10, unsolved],
    ["nothing_left_to_practise", [stat("Graphs", 4, 3)], 4, [problem("array", "easy", ["Arrays"])]],
  ] as const)("refuses with %s", (code, s, total, candidates) => {
    try {
      planPath([...s], total, [...candidates]);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(NoPlanError);
      expect((err as NoPlanError).code).toBe(code);
    }
  });

  it("labels the overall difficulty", () => {
    expect(planPath([stat("Graphs", 4, 3)], 4, [problem("a", "easy", ["Graphs"])]).difficultyLevel).toBe("beginner");
    expect(planPath([stat("Graphs", 4, 3)], 4, [problem("a", "hard", ["Graphs"])]).difficultyLevel).toBe("advanced");
  });
});
