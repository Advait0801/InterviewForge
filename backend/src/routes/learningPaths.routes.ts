import { Router } from "express";
import { AuthRequest, optionalAuth, requireAuth } from "../middleware/auth.middleware";
import { DomainError } from "../services/errors";
import { completeProblem, getPath, listPaths } from "../services/learning-paths.service";
import { UUID_REGEX, sendDomainError, sendInternalError } from "./http";

const router = Router();
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

router.get("/", optionalAuth, async (req: AuthRequest, res) => {
  try {
    return res.json({ paths: await listPaths(req.user?.id) });
  } catch (err) {
    return sendInternalError(res, "List learning paths error", err);
  }
});

router.get("/:slug", optionalAuth, async (req: AuthRequest, res) => {
  const slug = typeof req.params.slug === "string" ? req.params.slug : "";
  if (!SLUG_REGEX.test(slug)) {
    return res.status(400).json({ error: "Invalid path slug" });
  }

  try {
    return res.json(await getPath(slug, req.user?.id));
  } catch (err) {
    if (err instanceof DomainError) return sendDomainError(res, err);
    return sendInternalError(res, "Get learning path error", err);
  }
});

router.post("/:slug/complete/:problemId", requireAuth, async (req: AuthRequest, res) => {
  const slug = typeof req.params.slug === "string" ? req.params.slug : "";
  const problemId = typeof req.params.problemId === "string" ? req.params.problemId : "";

  if (!SLUG_REGEX.test(slug)) {
    return res.status(400).json({ error: "Invalid path slug" });
  }
  if (!UUID_REGEX.test(problemId)) {
    return res.status(400).json({ error: "Invalid problem id" });
  }

  try {
    await completeProblem(req.user!.id, slug, problemId);
    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof DomainError) return sendDomainError(res, err);
    return sendInternalError(res, "Complete path problem error", err);
  }
});

export default router;
