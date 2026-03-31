import { Router } from "express";
import { query } from "../db";
import { AuthRequest, requireAuth } from "../middleware/auth.middleware";

const router = Router();
const CODE_RUNNER_URL = process.env.CODE_RUNNER_URL || "http://code-runner:5000";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type TestCase = { input: string; expectedOutput: string };

/** First N cases used for Run; Submit uses full suite. */
const RUN_CASE_LIMIT = 4;

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const problemId = req.query.problemId as string | undefined;

  if (problemId && !UUID_REGEX.test(problemId)) {
    return res.status(400).json({ error: "Invalid problemId" });
  }

  try {
    const conditions = ["s.user_id = $1"];
    const params: (string | number)[] = [userId];

    if (problemId) {
      conditions.push(`s.problem_id = $2`);
      params.push(problemId);
    }

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
       LIMIT 50`,
      params
    );

    return res.json({ submissions: result.rows });
  } catch (err) {
    console.error("List submissions error", err);
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
    const testCases = mode === "run" ? allTestCases.slice(0, RUN_CASE_LIMIT) : allTestCases;

    const runRes = await fetch(`${CODE_RUNNER_URL}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, code, testCases, slug: problem.slug }),
    });

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

    return res.status(201).json({
      mode: "submit",
      submissionId: insertResult.rows[0].id,
      status,
      passed: runResult.passed,
      results: runResult.results,
      runtimeMs: runResult.runtimeMs,
    });
  } catch (err) {
    console.error("Submission error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;