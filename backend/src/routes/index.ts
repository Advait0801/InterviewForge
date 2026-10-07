import type { Router } from "express";
import authRoutes from "./auth.routes";
import usersRoutes from "./users.routes";
import problemsRoutes from "./problems.routes";
import problemBookmarksRoutes from "./problemBookmarks.routes";
import submissionRoutes from "./submission.routes";
import interviewsRoutes from "./interviews.routes";
import assessmentsRoutes from "./assessments.routes";
import leaderboardRoutes from "./leaderboard.routes";
import learningPathsRoutes from "./learningPaths.routes";
import recommendationsRoutes from "./recommendations.routes";
import resumesRoutes from "./resumes.routes";
import openapiRoutes from "./openapi.routes";

/**
 * Every router and where it's mounted under /api. index.ts mounts these; the contract
 * test reads the same list, so a route can't be added without the spec noticing.
 */
export const API_ROUTES: ReadonlyArray<readonly [mountPath: string, router: Router]> = [
  ["/auth", authRoutes],
  ["/users", usersRoutes],
  ["/problems", problemsRoutes],
  ["/problem-bookmarks", problemBookmarksRoutes],
  ["/submissions", submissionRoutes],
  ["/interviews", interviewsRoutes],
  ["/assessments", assessmentsRoutes],
  ["/leaderboard", leaderboardRoutes],
  ["/learning-paths", learningPathsRoutes],
  ["/recommendations", recommendationsRoutes],
  ["/resumes", resumesRoutes],
  ["/openapi.json", openapiRoutes],
];
