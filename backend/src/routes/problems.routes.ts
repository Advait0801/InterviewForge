import { Router } from "express";
import { optionalAuth, type AuthRequest } from "../middleware/auth.middleware";
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
