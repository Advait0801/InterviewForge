import { Router } from "express";
import { DomainError } from "../services/errors";
import { openSharedInterview } from "../services/sharing.service";
import { getSingleParam, sendDomainError, sendInternalError } from "./http";

/**
 * Pages anyone can open without signing in (D-071). Nothing here reads `req.user`: what's
 * served is decided by the token alone.
 */
const router = Router();

router.get("/interviews/:token", async (req, res) => {
  // The token is the credential: no shared cache may keep a copy (a revoked link must stop
  // working everywhere), search engines mustn't index it, and the page mustn't leak its URL
  // to sites it links to.
  res.set({
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
  });
  try {
    return res.json(await openSharedInterview(getSingleParam(req.params.token) ?? ""));
  } catch (err) {
    if (err instanceof DomainError) return sendDomainError(res, err);
    return sendInternalError(res, "Open shared interview error", err);
  }
});

export default router;
