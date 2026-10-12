import { Router } from "express";
import { AuthRequest, requireAuth } from "../middleware/auth.middleware";
import { getMyRatings, getNextProblems } from "../services/elo.service";
import { sendInternalError } from "./http";

/** Elo-rated adaptive difficulty (D-076): the caller's ratings, and what to solve next. */
const router = Router();

router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    return res.json(await getMyRatings(req.user!.id));
  } catch (err) {
    return sendInternalError(res, "Get ratings error", err);
  }
});

router.get("/next", requireAuth, async (req: AuthRequest, res) => {
  const topic = req.query.topic;
  if (topic !== undefined && (typeof topic !== "string" || topic.length === 0 || topic.length > 64)) {
    return res.status(400).json({ error: "topic must be a non-empty string of at most 64 characters" });
  }
  try {
    return res.json(await getNextProblems(req.user!.id, { topic: topic as string | undefined }));
  } catch (err) {
    return sendInternalError(res, "Next problem error", err);
  }
});

export default router;
