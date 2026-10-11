import { createHash } from "node:crypto";
import { withTransaction } from "../db";
import * as paths from "../repositories/learning-paths.repository";
import { DomainError, badRequest, notFound } from "./errors";
import { NoPlanError, planPath, type FocusTopic } from "./weakness";

const pathNotFound = () => notFound("Learning path not found");

/** A personal path is visible only to its owner; to anyone else it doesn't exist. */
function visibleTo(path: { owner_user_id: string | null }, userId: string | undefined): boolean {
  return path.owner_user_id === null || path.owner_user_id === userId;
}

export async function listPaths(userId: string | undefined) {
  const rows = await paths.listPathSummaries(userId ?? null);
  const completedByPath = userId ? await paths.completedCountsByPath(userId) : {};

  return rows.map((row) => ({
    id: row.slug,
    slug: row.slug,
    title: row.title,
    description: row.description,
    topic: row.topic,
    difficultyLevel: row.difficulty_level,
    problemCount: parseInt(row.problem_count, 10),
    completedCount: completedByPath[row.id] ?? 0,
    isPersonal: row.owner_user_id !== null,
  }));
}

export async function getPath(slug: string, userId: string | undefined) {
  const path = await paths.findPathBySlug(slug);
  if (!path || !visibleTo(path, userId)) throw pathNotFound();

  const problemRows = await paths.listPathProblems(path.id);
  const completed = userId ? await paths.completedProblemIds(userId, path.id) : new Set<string>();
  const focus = path.owner_user_id !== null ? (path.focus_json as PersonalFocus | null) : null;

  const problems = problemRows.map((p) => ({
    problemId: p.problem_id,
    position: p.position,
    title: p.title,
    slug: p.slug,
    difficulty: p.difficulty,
    isCompleted: completed.has(p.problem_id),
    ...(focus?.reasons[p.problem_id] ? { focusTopic: focus.reasons[p.problem_id] } : {}),
  }));

  return {
    path: {
      slug: path.slug,
      title: path.title,
      description: path.description,
      topic: path.topic,
      difficultyLevel: path.difficulty_level,
      problemCount: problems.length,
      completedCount: problems.filter((x) => x.isCompleted).length,
      isPersonal: path.owner_user_id !== null,
      ...(focus ? { focusTopics: focus.topics } : {}),
    },
    problems,
  };
}

export async function completeProblem(userId: string, slug: string, problemId: string): Promise<void> {
  const path = await paths.findPathBySlug(slug);
  if (!path || !visibleTo(path, userId)) throw pathNotFound();
  if (!(await paths.isPathMember(path.id, problemId))) throw badRequest("Problem is not part of this path");
  await paths.markCompleted(userId, path.id, problemId);
}

/** Stored with a personal path: the weak topics it was built from, and which topic each problem practises. */
type PersonalFocus = { topics: FocusTopic[]; reasons: Record<string, string> };

/** Stable per user, without putting the user's id in a URL. */
export function personalSlug(userId: string): string {
  return `focus-${createHash("sha256").update(userId).digest("hex").slice(0, 12)}`;
}

function joinTopics(topics: string[]): string {
  return topics.length > 1 ? `${topics.slice(0, -1).join(", ")} and ${topics[topics.length - 1]}` : topics[0];
}

/**
 * Build (or rebuild) the user's personal path from their weakest topics. Deterministic: the
 * same history gives the same path (weakness.ts). Replacing the old path and writing the new
 * one happen in one transaction.
 */
export async function generatePath(userId: string) {
  const [stats, total, unsolved] = await Promise.all([
    paths.topicStats(userId),
    paths.submissionCount(userId),
    paths.unsolvedProblems(userId),
  ]);

  let plan;
  try {
    plan = planPath(
      stats.map((s) => ({
        topic: s.topic,
        submissions: s.submissions,
        failed: s.failed,
        lapses: s.lapses,
        hintedProblems: s.hinted_problems,
        problemsSolved: s.problems_solved,
      })),
      total,
      unsolved
    );
  } catch (err) {
    if (err instanceof NoPlanError) throw new DomainError(409, err.message, { code: err.code });
    throw err;
  }

  const names = plan.focus.map((f) => f.topic);
  const focus: PersonalFocus = {
    topics: plan.focus,
    reasons: Object.fromEntries(plan.problems.map((p) => [p.id, p.reason])),
  };
  const slug = personalSlug(userId);
  await withTransaction((tx) =>
    paths.replacePersonalPath(
      tx,
      userId,
      {
        slug,
        title: `Your focus: ${joinTopics(names)}`,
        description: `Built from your submissions: ${plan.focus
          .map((f) => `${f.topic} (${f.failed} of ${f.submissions} submissions failed)`)
          .join("; ")}. Easier problems first, alternating between topics.`,
        topic: names[0],
        difficultyLevel: plan.difficultyLevel,
        focus,
      },
      plan.problems.map((p) => p.id)
    )
  );
  return getPath(slug, userId);
}
