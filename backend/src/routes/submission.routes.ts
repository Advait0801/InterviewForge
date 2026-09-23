import { Router } from "express";
import { query } from "../db";
import { AuthRequest, requireAuth } from "../middleware/auth.middleware";
import { llmLimiter } from "../middleware/rate-limit.middleware";
import { AIServiceError, reviewCode } from "../services/ai.service";
import { clientSubmitResults, exampleCases, type TestCase } from "../services/test-cases";

const router = Router();
const CODE_RUNNER_URL = process.env.CODE_RUNNER_URL || "http://code-runner:5000";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What code-runner executes (code-runner/src/types.ts SupportedLanguage). */
const LANGUAGES = ["python3", "c", "cpp", "java"] as const;
const MODES = ["run", "submit"] as const;


router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const problemId = req.query.problemId as string | undefined;
  const status = req.query.status as string | undefined;
  const language = req.query.language as string | undefined;
  const parsedLimit = Number(req.query.limit ?? 50);
  const parsedOffset = Number(req.query.offset ?? 0);
  const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 200)) : 50;
  const offset = Number.isFinite(parsedOffset) ? Math.max(0, parsedOffset) : 0;

  if (problemId && !UUID_REGEX.test(problemId)) {
    return res.status(400).json({ error: "Invalid problemId" });
  }
  if (status && !["passed", "failed"].includes(status)) {
    return res.status(400).json({ error: "Invalid status filter" });
  }

  try {
    const conditions = ["s.user_id = $1"];
    const params: (string | number)[] = [userId];

    if (problemId) {
      params.push(problemId);
      conditions.push(`s.problem_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`s.status = $${params.length}`);
    }
    if (language) {
      params.push(language);
      conditions.push(`s.language = $${params.length}`);
    }

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const totalResult = await query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM submissions s
       WHERE ${conditions.join(" AND ")}`,
      params.slice(0, offsetIdx - 2)
    );

    const result = await query<{
      id: string;
      problem_id: string;
      problem_title: string;
      language: string;
      status: string;
      runtime_ms: number | null;
      memory_kb: number | null;
      created_at: string;
    }>(
      `SELECT s.id, s.problem_id, p.title AS problem_title, s.language, s.status,
              s.runtime_ms, s.memory_kb, s.created_at
       FROM submissions s
       JOIN problems p ON p.id = s.problem_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY s.created_at DESC
       LIMIT $${limitIdx}
       OFFSET $${offsetIdx}`,
      params
    );

    return res.json({
      submissions: result.rows,
      total: parseInt(totalResult.rows[0]?.count ?? "0", 10),
      limit,
      offset,
    });
  } catch (err) {
    console.error("List submissions error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/review", requireAuth, llmLimiter, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];

  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: "Invalid submission id" });
  }

  try {
    const row = await query<{
      code: string;
      language: string;
      title: string;
      description: string;
      difficulty: string;
    }>(
      `SELECT s.code, s.language, p.title, p.description, p.difficulty
       FROM submissions s
       JOIN problems p ON p.id = s.problem_id
       WHERE s.id = $1 AND s.user_id = $2`,
      [id, userId]
    );

    if (row.rows.length === 0) {
      return res.status(404).json({ error: "Submission not found" });
    }

    const s = row.rows[0];
    const review = await reviewCode({
      code: s.code,
      language: s.language,
      problem_title: s.title,
      problem_description: s.description,
      problem_difficulty: s.difficulty,
    });

    return res.json({ review });
  } catch (err) {
    if (err instanceof AIServiceError) {
      return res.status(err.statusCode >= 500 ? 503 : err.statusCode).json({
        error: err.message,
        details: err.details,
      });
    }
    console.error("AI review error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const id = typeof req.params.id === "string" ? req.params.id : req.params.id?.[0];

  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: "Invalid submission id" });
  }

  try {
    const result = await query<{
      id: string;
      problem_id: string;
      language: string;
      code: string;
      status: string;
      runtime_ms: number | null;
      memory_kb: number | null;
      created_at: string;
    }>(
      `SELECT id, problem_id, language, code, status, runtime_ms, memory_kb, created_at
       FROM submissions WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Submission not found" });
    }

    return res.json({ submission: result.rows[0] });
  } catch (err) {
    console.error("Get submission error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { problemId, language, code, mode = "submit" } = req.body as {
    problemId?: string;
    language?: string;
    code?: string;
    mode?: "run" | "submit";
  };

  if (!problemId || !language || !code) {
    return res.status(400).json({
      error: "problemId, language, and code are required",
    });
  }
  // Checked here rather than left to Postgres and the runner (D-056): a malformed id
  // was a 500 from the uuid cast, and an unsupported language reached the runner and
  // came back as a misleading "Code runner unavailable".
  if (!UUID_REGEX.test(problemId)) {
    return res.status(400).json({ error: "Invalid problemId" });
  }
  if (!(LANGUAGES as readonly string[]).includes(language)) {
    return res.status(400).json({ error: `language must be one of: ${LANGUAGES.join(", ")}` });
  }
  if (!(MODES as readonly string[]).includes(mode)) {
    return res.status(400).json({ error: "mode must be run or submit" });
  }

  try {
    const problemResult = await query<{ id: string; slug: string; test_cases: TestCase[] }>(
      "SELECT id, slug, test_cases FROM problems WHERE id = $1",
      [problemId]
    );

    if (problemResult.rows.length === 0) {
      return res.status(404).json({ error: "Problem not found" });
    }

    const problem = problemResult.rows[0];
    const allTestCases = problem.test_cases || [];
    // Run uses the public examples; Submit uses the full suite, hidden cases included.
    const testCases = mode === "run" ? exampleCases(allTestCases) : allTestCases;

    let runRes: Response;
    try {
      runRes = await fetch(`${CODE_RUNNER_URL}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code, testCases, slug: problem.slug }),
      });
    } catch (err) {
      // code-runner is unreachable (connection refused, DNS failure, timeout).
      // A dependency being down is a retryable 503, not a 500 that implies a bug
      // in this handler -- mirrors the ai-service Chroma-down response so callers
      // can treat every dependency outage the same way.
      console.error("Code runner unreachable", err);
      return res
        .status(503)
        .json({ error: "Code runner unavailable", retryable: true });
    }

    if (!runRes.ok) {
      const text = await runRes.text();
      console.error("Code runner error", text);
      return res.status(502).json({ error: "Code runner unavailable" });
    }

    const runResult = (await runRes.json()) as {
      passed: boolean;
      results: Array<{ passed: boolean; actualOutput?: string; error?: string }>;
      runtimeMs?: number;
      memoryKb?: number;
    };

    if (mode === "run") {
      return res.json({
        mode: "run",
        passed: runResult.passed,
        results: runResult.results,
        testCases,
        runtimeMs: runResult.runtimeMs,
      });
    }

    const status = runResult.passed ? "passed" : "failed";

    const insertResult = await query<{ id: string }>(
      `INSERT INTO submissions (user_id, problem_id, language, code, status, runtime_ms, memory_kb)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [userId, problemId, language, code, status, runResult.runtimeMs ?? null, runResult.memoryKb ?? null]
    );

    if (status === "passed") {
      await query(
        `INSERT INTO user_path_progress (user_id, path_id, problem_id)
         SELECT $1, lpp.path_id, lpp.problem_id
         FROM learning_path_problems lpp
         WHERE lpp.problem_id = $2
         ON CONFLICT (user_id, path_id, problem_id) DO NOTHING`,
        [userId, problemId]
      );
    }

    return res.status(201).json({
      mode: "submit",
      submissionId: insertResult.rows[0].id,
      status,
      passed: runResult.passed,
      // Hidden cases are reduced to pass/fail, except the first failing one (D-057).
      results: clientSubmitResults(testCases, runResult.results),
      runtimeMs: runResult.runtimeMs,
    });
  } catch (err) {
    console.error("Submission error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;