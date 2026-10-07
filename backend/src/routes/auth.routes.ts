import { Router } from "express";
import { loginLimiter, authWriteLimiter } from "../middleware/rate-limit.middleware";
import { requireAuth, type AuthRequest } from "../middleware/auth.middleware";
import * as auth from "../services/auth.service";
import { DomainError } from "../services/errors";
import { sendDomainError, sendInternalError } from "./http";

const router = Router();

router.post("/register", authWriteLimiter, async (req, res) => {
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
    const token = await auth.register({ username, email, password, fullName });
    return res.status(201).json({ token });
  } catch (err) {
    if (err instanceof DomainError) return sendDomainError(res, err);
    return sendInternalError(res, "Register error", err);
  }
});

router.post("/login", loginLimiter, async (req, res) => {
  const { identifier, password } = req.body as { identifier?: string; password?: string };

  if (!identifier || !password) {
    return res.status(400).json({ error: "Email/username and password are required" });
  }

  try {
    return res.json({ token: await auth.login(identifier, password) });
  } catch (err) {
    if (err instanceof DomainError) return sendDomainError(res, err);
    return sendInternalError(res, "Login error", err);
  }
});

/** Always returns 200 to avoid email enumeration */
router.post("/forgot-password", authWriteLimiter, async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email?.trim()) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    await auth.requestPasswordReset(email.trim());
    return res.json({ ok: true });
  } catch (err) {
    return sendInternalError(res, "Forgot password error", err);
  }
});

router.post("/reset-password", authWriteLimiter, async (req, res) => {
  const { token, newPassword } = req.body as { token?: string; newPassword?: string };
  if (!token || !newPassword) {
    return res.status(400).json({ error: "Token and new password are required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    await auth.resetPassword(token, newPassword);
    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof DomainError) return sendDomainError(res, err);
    return sendInternalError(res, "Reset password error", err);
  }
});

/**
 * Sign out everywhere, this session included: bumping token_version revokes every token
 * issued so far (D-055). The client clears its own token and returns to login.
 */
router.post("/logout-all", requireAuth, async (req: AuthRequest, res) => {
  try {
    await auth.logoutEverywhere(req.user!.id);
    return res.json({ ok: true });
  } catch (err) {
    return sendInternalError(res, "Logout-all error", err);
  }
});

router.get("/verify-email", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token) {
    return res.redirect(auth.verificationRedirect("missing"));
  }

  try {
    const verified = await auth.verifyEmail(token);
    return res.redirect(auth.verificationRedirect(verified ? "verified" : "invalid"));
  } catch (err) {
    console.error("Verify email error", err);
    return res.redirect(auth.verificationRedirect("server"));
  }
});

export default router;
