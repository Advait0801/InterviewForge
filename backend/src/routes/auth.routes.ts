import { Router } from "express";
import { query } from "../db";
import { hashPassword, verifyPassword, signAccessToken } from "../auth";
import { randomToken, hoursFromNow } from "../auth-tokens";

const router = Router();

const frontendUrl = () => process.env.FRONTEND_URL || "http://localhost:3000";

function verificationLink(token: string): string {
  return `${frontendUrl()}/verify-email?token=${encodeURIComponent(token)}`;
}

function resetLink(token: string): string {
  return `${frontendUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}

router.post("/register", async (req, res) => {
  const { username, email, password, fullName } = req.body as {
    username?: string;
    email?: string;
    password?: string;
    fullName?: string;
  };

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Username, email, and password are required" });
  }

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: "Username must be 3-20 characters (letters, numbers, underscore)" });
  }

  try {
    const existingEmail = await query<{ id: string }>("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", [email]);
    if (existingEmail.rows.length > 0) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const existingUsername = await query<{ id: string }>(
      "SELECT id FROM users WHERE LOWER(username) = LOWER($1)",
      [username]
    );
    if (existingUsername.rows.length > 0) {
      return res.status(409).json({ error: "Username already taken" });
    }

    const passwordHash = await hashPassword(password);
    const verifyToken = randomToken();
    const verifyExpires = hoursFromNow(24 * 7);

    const result = await query<{ id: string }>(
      `INSERT INTO users (
         username, email, password_hash, name,
         email_verified, email_verification_token, email_verification_expires_at
       )
       VALUES ($1, $2, $3, $4, FALSE, $5, $6)
       RETURNING id`,
      [username, email, passwordHash, fullName ?? null, verifyToken, verifyExpires]
    );

    const userId = result.rows[0].id;
    const link = verificationLink(verifyToken);
    console.log("[email-verify] Send verification email to", email, "link:", link);

    const token = signAccessToken({ userId });
    return res.status(201).json({ token });
  } catch (err) {
    console.error("Register error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  const { identifier, password } = req.body as { identifier?: string; password?: string };

  if (!identifier || !password) {
    return res.status(400).json({ error: "Email/username and password are required" });
  }

  try {
    const isEmail = identifier.includes("@");
    const result = await query<{ id: string; password_hash: string | null }>(
      isEmail
        ? "SELECT id, password_hash FROM users WHERE LOWER(email) = LOWER($1)"
        : "SELECT id, password_hash FROM users WHERE LOWER(username) = LOWER($1)",
      [identifier]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    if (!user.password_hash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signAccessToken({ userId: user.id });
    return res.json({ token });
  } catch (err) {
    console.error("Login error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** Always returns 200 to avoid email enumeration */
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email?.trim()) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const r = await query<{ id: string }>(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND password_hash IS NOT NULL",
      [email.trim()]
    );
    if (r.rows.length > 0) {
      const resetToken = randomToken();
      const expires = hoursFromNow(1);
      await query(
        `UPDATE users SET password_reset_token = $1, password_reset_expires_at = $2 WHERE id = $3`,
        [resetToken, expires, r.rows[0].id]
      );
      const link = resetLink(resetToken);
      console.log("[password-reset] Send reset email to", email.trim(), "link:", link);
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("Forgot password error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body as { token?: string; newPassword?: string };
  if (!token || !newPassword) {
    return res.status(400).json({ error: "Token and new password are required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    const r = await query<{ id: string }>(
      `SELECT id FROM users
       WHERE password_reset_token = $1
         AND password_reset_expires_at IS NOT NULL
         AND password_reset_expires_at > NOW()`,
      [token]
    );
    if (r.rows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired reset link" });
    }

    const passwordHash = await hashPassword(newPassword);
    await query(
      `UPDATE users SET
         password_hash = $1,
         password_reset_token = NULL,
         password_reset_expires_at = NULL,
         updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, r.rows[0].id]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error("Reset password error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/verify-email", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token) {
    return res.redirect(`${frontendUrl()}/verify-email?error=missing`);
  }

  try {
    const r = await query<{ id: string }>(
      `SELECT id FROM users
       WHERE email_verification_token = $1
         AND email_verification_expires_at IS NOT NULL
         AND email_verification_expires_at > NOW()`,
      [token]
    );
    if (r.rows.length === 0) {
      return res.redirect(`${frontendUrl()}/verify-email?error=invalid`);
    }

    await query(
      `UPDATE users SET
         email_verified = TRUE,
         email_verification_token = NULL,
         email_verification_expires_at = NULL,
         updated_at = NOW()
       WHERE id = $1`,
      [r.rows[0].id]
    );
    return res.redirect(`${frontendUrl()}/verify-email?verified=1`);
  } catch (err) {
    console.error("Verify email error", err);
    return res.redirect(`${frontendUrl()}/verify-email?error=server`);
  }
});

export default router;
