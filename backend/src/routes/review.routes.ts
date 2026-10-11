import { Router } from "express";
import { AuthRequest, requireAuth } from "../middleware/auth.middleware";
import { DomainError } from "../services/errors";
import { addToQueue, getQueue, removeFromQueue } from "../services/review.service";
import { UUID_REGEX, sendDomainError, sendInternalError } from "./http";

/** The caller's spaced-repetition review queue (review.service.ts). */
const router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    return res.json(await getQueue(req.user!.id));
  } catch (err) {
    return sendInternalError(res, "Review queue error", err);
  }
});

router.post("/:problemId", requireAuth, async (req: AuthRequest, res) => {
  const problemId = String(req.params.problemId);
  if (!UUID_REGEX.test(problemId)) return res.status(400).json({ error: "Invalid problem id" });
  try {
    const added = await addToQueue(req.user!.id, problemId);
    return res.status(added ? 201 : 200).json({ added });
  } catch (err) {
    if (err instanceof DomainError) return sendDomainError(res, err);
    return sendInternalError(res, "Add to review queue error", err);
  }
});

router.delete("/:problemId", requireAuth, async (req: AuthRequest, res) => {
  const problemId = String(req.params.problemId);
  if (!UUID_REGEX.test(problemId)) return res.status(400).json({ error: "Invalid problem id" });
  try {
    await removeFromQueue(req.user!.id, problemId);
    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof DomainError) return sendDomainError(res, err);
    return sendInternalError(res, "Remove from review queue error", err);
  }
});

export default router;
