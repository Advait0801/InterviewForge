import { Router } from "express";
import { AuthRequest, requireAuth } from "../middleware/auth.middleware";
import { DomainError } from "../services/errors";
import * as users from "../services/users.service";
import { sendDomainError, sendInternalError } from "./http";

const router = Router();

const MIN_PASSWORD_LENGTH = 6;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,32}$/;
const AVATAR_MAX_BYTES = 500_000;
const AVATAR_MIME_RE = /^data:image\/(jpeg|png|webp);base64,/;

router.post("/change-password", requireAuth, async (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current password and new password are required" });
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({ error: "New password must be different from current password" });
  }

  try {
    const token = await users.changePassword(req.user!.id, currentPassword, newPassword);
    return res.json({ ok: true, token });
  } catch (err) {
    if (err instanceof DomainError) return sendDomainError(res, err);
    return sendInternalError(res, "Change password error", err);
  }
});

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    return res.json({ user: await users.getAccount(req.user!.id) });
  } catch (err) {
    if (err instanceof DomainError) return sendDomainError(res, err);
    return sendInternalError(res, "Get me error", err);
  }
});

router.post("/avatar", requireAuth, async (req: AuthRequest, res) => {
  const { avatar } = req.body as { avatar?: string };
  if (!avatar || typeof avatar !== "string") {
    return res.status(400).json({ error: "avatar (base64 data URI) is required" });
  }
  if (!AVATAR_MIME_RE.test(avatar)) {
    return res.status(400).json({ error: "Avatar must be a JPEG, PNG, or WebP image" });
  }
  if (Buffer.byteLength(avatar, "utf-8") > AVATAR_MAX_BYTES) {
    return res.status(400).json({ error: "Avatar must be under 500KB" });
  }
  try {
    await users.setAvatar(req.user!.id, avatar);
    return res.json({ ok: true, avatar_url: avatar });
  } catch (err) {
    return sendInternalError(res, "Upload avatar error", err);
  }
});

router.delete("/avatar", requireAuth, async (req: AuthRequest, res) => {
  try {
    await users.removeAvatar(req.user!.id);
    return res.json({ ok: true });
  } catch (err) {
    return sendInternalError(res, "Delete avatar error", err);
  }
});

router.get("/stats", requireAuth, async (req: AuthRequest, res) => {
  try {
    return res.json(await users.getStats(req.user!.id));
  } catch (err) {
    return sendInternalError(res, "Get user stats error", err);
  }
});

router.get("/activity", requireAuth, async (req: AuthRequest, res) => {
  try {
    return res.json(await users.getActivity(req.user!.id));
  } catch (err) {
    return sendInternalError(res, "Get activity error", err);
  }
});

router.get("/analytics", requireAuth, async (req: AuthRequest, res) => {
  try {
    return res.json(await users.getAnalytics(req.user!.id));
  } catch (err) {
    return sendInternalError(res, "Get analytics error", err);
  }
});

router.get("/:username", async (req, res) => {
  const username = req.params.username;
  if (!USERNAME_REGEX.test(username)) {
    return res.status(400).json({ error: "Invalid username" });
  }

  try {
    return res.json(await users.getPublicProfile(username));
  } catch (err) {
    if (err instanceof DomainError) return sendDomainError(res, err);
    return sendInternalError(res, "Get public profile error", err);
  }
});

export default router;
