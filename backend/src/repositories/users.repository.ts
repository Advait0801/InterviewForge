import { query } from "../db";

/** Account rows: identity, credentials, verification and reset tokens, avatar. */

export async function emailInUse(email: string): Promise<boolean> {
  const result = await query<{ id: string }>("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", [email]);
  return result.rows.length > 0;
}

export async function usernameTaken(username: string): Promise<boolean> {
  const result = await query<{ id: string }>(
    "SELECT id FROM users WHERE LOWER(username) = LOWER($1)",
    [username]
  );
  return result.rows.length > 0;
}

export async function insertUser(user: {
  username: string;
  email: string;
  passwordHash: string;
  name: string | null;
  verifyToken: string;
  verifyExpires: Date;
}): Promise<{ id: string; token_version: number }> {
  const result = await query<{ id: string; token_version: number }>(
    `INSERT INTO users (
         username, email, password_hash, name,
         email_verified, email_verification_token, email_verification_expires_at
       )
       VALUES ($1, $2, $3, $4, FALSE, $5, $6)
       RETURNING id, token_version`,
    [user.username, user.email, user.passwordHash, user.name, user.verifyToken, user.verifyExpires]
  );
  return result.rows[0];
}

export type LoginRow = { id: string; password_hash: string | null; token_version: number };

/** By email when the identifier contains "@", by username otherwise. */
export async function findLoginByIdentifier(identifier: string): Promise<LoginRow | null> {
  const isEmail = identifier.includes("@");
  const result = await query<LoginRow>(
    isEmail
      ? "SELECT id, password_hash, token_version FROM users WHERE LOWER(email) = LOWER($1)"
      : "SELECT id, password_hash, token_version FROM users WHERE LOWER(username) = LOWER($1)",
    [identifier]
  );
  return result.rows[0] ?? null;
}

/** Only accounts that have a password can reset one. */
export async function findPasswordUserIdByEmail(email: string): Promise<string | null> {
  const result = await query<{ id: string }>(
    "SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND password_hash IS NOT NULL",
    [email]
  );
  return result.rows[0]?.id ?? null;
}

export async function setPasswordResetToken(userId: string, token: string, expires: Date): Promise<void> {
  await query(
    `UPDATE users SET password_reset_token = $1, password_reset_expires_at = $2 WHERE id = $3`,
    [token, expires, userId]
  );
}

export async function findUserIdByLiveResetToken(token: string): Promise<string | null> {
  const result = await query<{ id: string }>(
    `SELECT id FROM users
       WHERE password_reset_token = $1
         AND password_reset_expires_at IS NOT NULL
         AND password_reset_expires_at > NOW()`,
    [token]
  );
  return result.rows[0]?.id ?? null;
}

/** Sets the password, consumes the reset token and revokes every session. */
export async function resetPassword(userId: string, passwordHash: string): Promise<void> {
  await query(
    `UPDATE users SET
         password_hash = $1,
         password_reset_token = NULL,
         password_reset_expires_at = NULL,
         -- Whoever needed a reset may have lost control of a session; end them all.
         token_version = token_version + 1,
         updated_at = NOW()
       WHERE id = $2`,
    [passwordHash, userId]
  );
}

/** Revokes every token issued so far (D-055). */
export async function bumpTokenVersion(userId: string): Promise<void> {
  await query(
    "UPDATE users SET token_version = token_version + 1, updated_at = NOW() WHERE id = $1",
    [userId]
  );
}

export async function findUserIdByLiveVerificationToken(token: string): Promise<string | null> {
  const result = await query<{ id: string }>(
    `SELECT id FROM users
       WHERE email_verification_token = $1
         AND email_verification_expires_at IS NOT NULL
         AND email_verification_expires_at > NOW()`,
    [token]
  );
  return result.rows[0]?.id ?? null;
}

export async function markEmailVerified(userId: string): Promise<void> {
  await query(
    `UPDATE users SET
         email_verified = TRUE,
         email_verification_token = NULL,
         email_verification_expires_at = NULL,
         updated_at = NOW()
       WHERE id = $1`,
    [userId]
  );
}

/** `undefined` when the user doesn't exist; `null` when they have no password. */
export async function findPasswordHash(userId: string): Promise<string | null | undefined> {
  const result = await query<{ password_hash: string | null }>(
    "SELECT password_hash FROM users WHERE id = $1",
    [userId]
  );
  return result.rows.length === 0 ? undefined : result.rows[0].password_hash;
}

/** Sets the password and revokes every session; returns the new token version. */
export async function changePassword(userId: string, passwordHash: string): Promise<number> {
  const result = await query<{ token_version: number }>(
    `UPDATE users
       SET password_hash = $1, token_version = token_version + 1, updated_at = NOW()
       WHERE id = $2
       RETURNING token_version`,
    [passwordHash, userId]
  );
  return result.rows[0].token_version;
}

export type AccountRow = {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export async function findAccount(userId: string): Promise<AccountRow | null> {
  const result = await query<AccountRow>(
    "SELECT id, email, username, name, avatar_url, created_at FROM users WHERE id = $1",
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function setAvatar(userId: string, avatar: string | null): Promise<void> {
  if (avatar === null) {
    await query("UPDATE users SET avatar_url = NULL, updated_at = NOW() WHERE id = $1", [userId]);
    return;
  }
  await query("UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2", [avatar, userId]);
}

export type PublicUserRow = {
  id: string;
  username: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export async function findPublicUser(username: string): Promise<PublicUserRow | null> {
  const result = await query<PublicUserRow>(
    "SELECT id, username, name, avatar_url, created_at FROM users WHERE LOWER(username) = LOWER($1)",
    [username]
  );
  return result.rows[0] ?? null;
}
