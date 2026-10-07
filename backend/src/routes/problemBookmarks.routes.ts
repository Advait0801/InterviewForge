import { Router } from "express";
import { AuthRequest, requireAuth } from "../middleware/auth.middleware";
import { DomainError } from "../services/errors";
import { addBookmark, listBookmarks, removeBookmark } from "../services/problems.service";
import { UUID_REGEX, sendDomainError, sendInternalError } from "./http";

const router = Router();

function problemIdParam(req: AuthRequest): string | null {
  const problemId = typeof req.params.problemId === "string" ? req.params.problemId : req.params.problemId?.[0];
  return problemId && UUID_REGEX.test(problemId) ? problemId : null;
}

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    return res.json({ bookmarks: await listBookmarks(req.user!.id) });
  } catch (err) {
    return sendInternalError(res, "List bookmarks error", err);
  }
});

router.post("/:problemId", requireAuth, async (req: AuthRequest, res) => {
  const problemId = problemIdParam(req);
  if (!problemId) {
    return res.status(400).json({ error: "Invalid problem id" });
  }
  try {
    await addBookmark(req.user!.id, problemId);
    return res.status(201).json({ ok: true });
  } catch (err) {
    if (err instanceof DomainError) return sendDomainError(res, err);
    return sendInternalError(res, "Create bookmark error", err);
  }
});

router.delete("/:problemId", requireAuth, async (req: AuthRequest, res) => {
  const problemId = problemIdParam(req);
  if (!problemId) {
    return res.status(400).json({ error: "Invalid problem id" });
  }
  try {
    await removeBookmark(req.user!.id, problemId);
    return res.json({ ok: true });
  } catch (err) {
    return sendInternalError(res, "Delete bookmark error", err);
  }
});

export default router;
