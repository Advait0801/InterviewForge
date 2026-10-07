import { Router } from "express";
import { AuthRequest, requireAuth } from "../middleware/auth.middleware";
import { llmLimiter } from "../middleware/rate-limit.middleware";
import { AIServiceError } from "../services/ai.service";
import { getRecommendations } from "../services/recommendations.service";
import { sendInternalError } from "./http";

const router = Router();

router.get("/", requireAuth, llmLimiter, async (req: AuthRequest, res) => {
  try {
    return res.json(await getRecommendations(req.user!.id));
  } catch (err) {
    if (err instanceof AIServiceError) {
      return res.status(err.statusCode >= 500 ? 503 : err.statusCode).json({
        error: err.message,
        details: err.details,
      });
    }
    return sendInternalError(res, "Recommendations error", err);
  }
});

export default router;
