import { Router } from "express";
import { optionalAuth, requireAuth, type AuthRequest } from "../middleware/auth.middleware";
import { MAX_HISTORY_PAGE, getDaily, getDailyHistory } from "../services/daily.service";
import { recordHintViews } from "../services/review.service";
import { DomainError } from "../services/errors";
import { getProblem, listProblems, type SolvedFilter } from "../services/problems.service";
import { UUID_REGEX, sendDomainError, sendInternalError } from "./http";

const router = Router();
const MAX_COMPANY_LENGTH = 64;

// optionalAuth rather than a local token decode: a hand-rolled check here skipped the
// revocation lookup, so a revoked token still got solved/bookmark flags (D-055).
router.get("/", optionalAuth, async (req: AuthRequest, res) => {
  const userId = req.user?.id ?? null;
  const difficulty = typeof req.query.difficulty === "string" ? req.query.difficulty.toLowerCase() : "all";
  const topic = typeof req.query.topic === "string" ? req.query.topic.trim() : "";
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const solved = typeof req.query.solved === "string" ? req.query.solved.toLowerCase() : "all";
  const company = typeof req.query.company === "string" ? req.query.company.trim() : "";

  if (company.length > MAX_COMPANY_LENGTH) {
    return res.status(400).json({ error: "Invalid company filter" });
  }
  if (!["all", "easy", "medium", "hard"].includes(difficulty)) {
    return res.status(400).json({ error: "Invalid difficulty filter" });
  }
  if (!["all", "solved", "unsolved"].includes(solved)) {
    return res.status(400).json({ error: "Invalid solved filter" });
  }
  if ((solved as SolvedFilter) !== "all" && !userId) {
    return res.status(401).json({ error: "Authentication required for solved filter" });
  }

  try {
    const problems = await listProblems({
      difficulty,
      topic,
      company,
      search,
      solved: solved as SolvedFilter,
      userId,
    });
    return res.json({ problems });
  } catch (err) {
    return sendInternalError(res, "List problems error", err);
  }
});

// Registered before /:id, which would reject "daily" as a malformed id.
router.get("/daily", optionalAuth, async (req: AuthRequest, res) => {
  const date = req.query.date;
  if (date !== undefined && typeof date !== "string") {
    return res.status(400).json({ error: "date must be YYYY-MM-DD" });
  }
  try {
    return res.json(await getDaily(date, req.user?.id));
  } catch (err) {
    if (err instanceof DomainError) return sendDomainError(res, err);
    return sendInternalError(res, "Problem of the day error", err);
  }
});

router.get("/daily/history", optionalAuth, async (req: AuthRequest, res) => {
  const raw = req.query.days ?? "30";
  const days = typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!(days >= 1 && days <= MAX_HISTORY_PAGE)) {
    return res.status(400).json({ error: `days must be a whole number from 1 to ${MAX_HISTORY_PAGE}` });
  }
  try {
    return res.json(await getDailyHistory(days, req.user?.id));
  } catch (err) {
    if (err instanceof DomainError) return sendDomainError(res, err);
    return sendInternalError(res, "Problem of the day history error", err);
  }
});

/** Hints are revealed in the browser; it reports how many it has shown (feeds the review queue). */
router.post("/:id/hints/viewed", requireAuth, async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  if (!UUID_REGEX.test(id)) {
    return res.status(400).json({ error: "Invalid problem id" });
  }
  const count = (req.body as { count?: unknown } | undefined)?.count;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1) {
    return res.status(400).json({ error: "count must be a whole number of hints, at least 1" });
  }
  try {
    return res.json({ hintsViewed: await recordHintViews(req.user!.id, id, count) });
  } catch (err) {
    if (err instanceof DomainError) return sendDomainError(res, err);
    return sendInternalError(res, "Record hint views error", err);
  }
});

router.get("/:id", optionalAuth, async (req: AuthRequest, res) => {
  // AuthRequest's params are string | string[]; an array fails the UUID check below.
  const id = String(req.params.id);
  if (!UUID_REGEX.test(id)) {
    return res.status(400).json({ error: "Invalid problem id" });
  }
  try {
    return res.json({ problem: await getProblem(id, req.user?.id ?? null) });
  } catch (err) {
    if (err instanceof DomainError) return sendDomainError(res, err);
    return sendInternalError(res, "Get problem error", err);
  }
});

export default router;
