import { hashPassword, verifyPassword, signAccessToken } from "../auth";
import * as users from "../repositories/users.repository";
import * as activity from "../repositories/activity.repository";
import { DomainError, badRequest, notFound } from "./errors";
import { bumpCacheVersion } from "./cache";

const acceptanceRate = (accepted: number, submissions: number) =>
  submissions > 0 ? Math.round((accepted / submissions) * 100) : 0;

/**
 * Revokes every other session (D-055) and returns a token for the new version, so the
 * user who just changed their password stays signed in where they did it.
 */
export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<string> {
  const hash = await users.findPasswordHash(userId);
  if (hash === undefined) throw notFound("User not found");
  if (!hash) {
    throw badRequest("No password is set for this account. Use Forgot password with your email to create one.");
  }
  // A 401 without code "session_invalid": the client keeps the session (D-055).
  if (!(await verifyPassword(currentPassword, hash))) throw new DomainError(401, "Current password is incorrect");

  const tokenVersion = await users.changePassword(userId, await hashPassword(newPassword));
  return signAccessToken({ userId, tokenVersion });
}

export async function getAccount(userId: string) {
  const account = await users.findAccount(userId);
  if (!account) throw notFound("User not found");
  return account;
}

// Avatars appear on the cached leaderboard.
export async function setAvatar(userId: string, avatar: string): Promise<void> {
  await users.setAvatar(userId, avatar);
  await bumpCacheVersion("leaderboard");
}

export async function removeAvatar(userId: string): Promise<void> {
  await users.setAvatar(userId, null);
  await bumpCacheVersion("leaderboard");
}

export async function getStats(userId: string) {
  const [problemsAttempted, problemsSolved, interviewsStarted, bestStreak, totals] = await Promise.all([
    activity.countAttemptedProblems(userId),
    activity.countSolvedProblems(userId),
    activity.countInterviews(userId),
    activity.bestStreak(userId),
    activity.acceptanceTotals(userId),
  ]);

  return {
    problemsAttempted,
    problemsSolved,
    interviewsStarted,
    bestStreak,
    submissionsCount: totals.submissions,
    acceptanceRate: acceptanceRate(totals.accepted, totals.submissions),
  };
}

export async function getActivity(userId: string) {
  const [activityMap, streaks] = await Promise.all([activity.activityByDay(userId), activity.streaks(userId)]);
  return { currentStreak: streaks.current, bestStreak: streaks.best, activityMap };
}

export async function getAnalytics(userId: string) {
  const [solvedOverTime, byDifficulty, topics, trend] = await Promise.all([
    activity.solvedOverTime(userId),
    activity.solvedByDifficulty(userId),
    activity.topSolvedTopics(userId),
    activity.weeklyAcceptance(userId),
  ]);

  const difficultyDistribution: Record<string, number> = {};
  for (const row of byDifficulty) {
    difficultyDistribution[row.difficulty] = parseInt(row.count, 10);
  }

  return {
    solvedOverTime: solvedOverTime.map((r) => ({ day: r.day, count: parseInt(r.count, 10) })),
    difficultyDistribution,
    topicStrengths: topics.map((r) => ({ topic: r.topic, count: parseInt(r.count, 10) })),
    acceptanceTrend: trend.map((r) => ({ week: r.week, rate: parseInt(r.rate, 10) })),
  };
}

/** What anyone can see about a user: no email, no ids. */
export async function getPublicProfile(username: string) {
  const user = await users.findPublicUser(username);
  if (!user) throw notFound("User not found");

  const [totals, problemsSolved, interviewsStarted, recentActivity, activityMap] = await Promise.all([
    activity.submissionTotals(user.id),
    activity.countSolvedProblemsForProfile(user.id),
    activity.countInterviews(user.id),
    activity.recentActivity(user.id),
    activity.activityByDay(user.id),
  ]);

  return {
    profile: {
      username: user.username,
      name: user.name,
      avatar_url: user.avatar_url,
      createdAt: user.created_at,
    },
    stats: {
      problemsAttempted: totals.attempted,
      problemsSolved,
      interviewsStarted,
      submissionsCount: totals.submissions,
      acceptanceRate: acceptanceRate(totals.accepted, totals.submissions),
    },
    recentActivity,
    activityMap,
  };
}
