import { hashPassword, verifyPassword, signAccessToken } from "../auth";
import { randomToken, hoursFromNow } from "../auth-tokens";
import * as users from "../repositories/users.repository";
import { DomainError, badRequest } from "./errors";

const frontendUrl = () => process.env.FRONTEND_URL || "http://localhost:3000";

export function verificationRedirect(outcome: "verified" | "missing" | "invalid" | "server"): string {
  const query = outcome === "verified" ? "verified=1" : `error=${outcome}`;
  return `${frontendUrl()}/verify-email?${query}`;
}

function verificationLink(token: string): string {
  return `${frontendUrl()}/verify-email?token=${encodeURIComponent(token)}`;
}

function resetLink(token: string): string {
  return `${frontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}

const invalidCredentials = () => new DomainError(401, "Invalid credentials");

/** Creates an unverified account and returns its first access token. */
export async function register(input: {
  username: string;
  email: string;
  password: string;
  fullName?: string;
}): Promise<string> {
  if (await users.emailInUse(input.email)) throw new DomainError(409, "Email already in use");
  if (await users.usernameTaken(input.username)) throw new DomainError(409, "Username already taken");

  const passwordHash = await hashPassword(input.password);
  const verifyToken = randomToken();
  const verifyExpires = hoursFromNow(24 * 7);

  const { id: userId, token_version: tokenVersion } = await users.insertUser({
    username: input.username,
    email: input.email,
    passwordHash,
    name: input.fullName ?? null,
    verifyToken,
    verifyExpires,
  });

  // Email delivery isn't wired up yet; the link is logged (F-07).
  console.log("[email-verify] Send verification email to", input.email, "link:", verificationLink(verifyToken));
  return signAccessToken({ userId, tokenVersion });
}

/** Every failure is the same 401, so the response never reveals which part was wrong. */
export async function login(identifier: string, password: string): Promise<string> {
  const user = await users.findLoginByIdentifier(identifier);
  if (!user || !user.password_hash) throw invalidCredentials();
  if (!(await verifyPassword(password, user.password_hash))) throw invalidCredentials();
  return signAccessToken({ userId: user.id, tokenVersion: user.token_version });
}

/** Silent whether or not the email exists, so it can't be used to enumerate accounts. */
export async function requestPasswordReset(email: string): Promise<void> {
  const userId = await users.findPasswordUserIdByEmail(email);
  if (!userId) return;
  const resetToken = randomToken();
  await users.setPasswordResetToken(userId, resetToken, hoursFromNow(1));
  console.log("[password-reset] Send reset email to", email, "link:", resetLink(resetToken));
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const userId = await users.findUserIdByLiveResetToken(token);
  if (!userId) throw badRequest("Invalid or expired reset link");
  await users.resetPassword(userId, await hashPassword(newPassword));
}

/** Sign out everywhere, the calling session included (D-055). */
export function logoutEverywhere(userId: string): Promise<void> {
  return users.bumpTokenVersion(userId);
}

export async function verifyEmail(token: string): Promise<boolean> {
  const userId = await users.findUserIdByLiveVerificationToken(token);
  if (!userId) return false;
  await users.markEmailVerified(userId);
  return true;
}
