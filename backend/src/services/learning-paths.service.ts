import * as paths from "../repositories/learning-paths.repository";
import { badRequest, notFound } from "./errors";

const pathNotFound = () => notFound("Learning path not found");

export async function listPaths(userId: string | undefined) {
  const rows = await paths.listPathSummaries();
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
  }));
}

export async function getPath(slug: string, userId: string | undefined) {
  const path = await paths.findPathBySlug(slug);
  if (!path) throw pathNotFound();

  const problemRows = await paths.listPathProblems(path.id);
  const completed = userId ? await paths.completedProblemIds(userId, path.id) : new Set<string>();

  const problems = problemRows.map((p) => ({
    problemId: p.problem_id,
    position: p.position,
    title: p.title,
    slug: p.slug,
    difficulty: p.difficulty,
    isCompleted: completed.has(p.problem_id),
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
    },
    problems,
  };
}

export async function completeProblem(userId: string, slug: string, problemId: string): Promise<void> {
  const pathId = await paths.findPathIdBySlug(slug);
  if (!pathId) throw pathNotFound();
  if (!(await paths.isPathMember(pathId, problemId))) throw badRequest("Problem is not part of this path");
  await paths.markCompleted(userId, pathId, problemId);
}
