import { Router } from "express";
import { query } from "../db";
import { AuthRequest, requireAuth } from "../middleware/auth.middleware";

const router = Router();
const CODE_RUNNER_URL = process.env.CODE_RUNNER_URL || "http://code-runner:5000";

type TestCase = { input: string; expectedOutput: string };

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { problemId, language, code } = req.body as {
    problemId?: string;
    language?: string;
    code?: string;
  };

  if (!problemId || !language || !code) {
    return res.status(400).json({
      error: "problemId, language, and code are required",
    });
  }

  try {
    const problemResult = await query<{ id: string; test_cases: TestCase[] }>(
      "SELECT id, test_cases FROM problems WHERE id = $1",
      [problemId]
    );

    if (problemResult.rows.length === 0) {
      return res.status(404).json({ error: "Problem not found" });
    }

    const problem = problemResult.rows[0];
    const testCases = problem.test_cases || [];

    const runRes = await fetch(`${CODE_RUNNER_URL}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, code, testCases }),
    });

    if (!runRes.ok) {
      const text = await runRes.text();
      console.error("Code runner error", text);
      return res.status(502).json({ error: "Code runner unavailable" });
    }

    const runResult = (await runRes.json()) as {
      passed: boolean;
      results: Array<{ passed: boolean }>;
      runtimeMs?: number;
    };

    const status = runResult.passed ? "passed" : "failed";

    const insertResult = await query<{ id: string }>(
      `INSERT INTO submissions (user_id, problem_id, language, code, status, runtime_ms)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [userId, problemId, language, code, status, runResult.runtimeMs ?? null]
    );

    return res.status(201).json({
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