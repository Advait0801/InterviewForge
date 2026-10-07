import * as problems from "../repositories/problems.repository";
import * as bookmarks from "../repositories/bookmarks.repository";
import { notFound } from "./errors";
import { exampleCases } from "./test-cases";

export type { ProblemListFilters, SolvedFilter } from "../repositories/problems.repository";

export function listProblems(filters: problems.ProblemListFilters) {
  return problems.listProblems(filters);
}

/** A problem as the client sees it: only the public examples leave the server (D-057). */
export async function getProblem(id: string, userId: string | null) {
  const row = await problems.findProblemDetail(id, userId);
  if (!row) throw notFound("Problem not found");

  const { test_cases, ...problem } = row;
  return {
    ...problem,
    test_cases: exampleCases(test_cases),
    test_case_count: test_cases?.length ?? 0,
  };
}

export function listBookmarks(userId: string) {
  return bookmarks.listBookmarkedProblemIds(userId);
}

export async function addBookmark(userId: string, problemId: string): Promise<void> {
  if (!(await problems.problemExists(problemId))) throw notFound("Problem not found");
  await bookmarks.addBookmark(userId, problemId);
}

export function removeBookmark(userId: string, problemId: string): Promise<void> {
  return bookmarks.removeBookmark(userId, problemId);
}
