import { Router } from "express";
import { getLeaderboardPage } from "../services/leaderboard.service";
import { sendInternalError } from "./http";

const router = Router();

router.get("/", async (req, res) => {
  const parsedPage = Number(req.query.page ?? 1);
  const parsedLimit = Number(req.query.limit ?? 20);
  const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
  const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 100)) : 20;

  try {
    return res.json(await getLeaderboardPage(page, limit));
  } catch (err) {
    return sendInternalError(res, "Leaderboard error", err);
  }
});

export default router;
