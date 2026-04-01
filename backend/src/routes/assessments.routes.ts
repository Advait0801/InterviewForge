import { Router } from "express";
import { query } from "../db";
import { AuthRequest, requireAuth } from "../middleware/auth.middleware";

const router = Router();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getSingleParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

type AssessmentRow = {
  id: string;
  user_id: string;
  status: string;
  time_limit_minutes: number;
  difficulty_mix: string;
  problem_count: number;
  started_at: string;
  finished_at: string | null;
  score: number | null;
  created_at: string;
};

type AssessmentProblemRow = {
  id: string;
  assessment_id: string;
  problem_id: string;
  problem_order: number;
  submission_id: string | null;
  title: string;
  slug: string;
  difficulty: string;
  submission_status: string | null;
};

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    const result = await query<AssessmentRow>(
      `SELECT id, user_id, status, time_limit_minutes, difficulty_mix, problem_count,
              started_at, finished_at, score, created_at
       FROM assessments
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );
    return res.json({ assessments: result.rows });
  } catch (err) {
    console.error("List assessments error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const {
    timeLimitMinutes = 60,
    problemCount = 3,
    difficultyMix = "mixed",
  } = req.body as {
    timeLimitMinutes?: number;
    problemCount?: number;
    difficultyMix?: string;
  };

  const count = Math.min(Math.max(problemCount, 1), 10);
  const timeLimit = Math.min(Math.max(timeLimitMinutes, 15), 180);

  try {
    let whereClause = "";
    const params: (string | number)[] = [count];

    if (difficultyMix !== "mixed") {
      whereClause = "WHERE difficulty = $2";
      params.push(difficultyMix);
    }

    const problemsResult = await query<{ id: string }>(
      `SELECT id FROM problems ${whereClause} ORDER BY RANDOM() LIMIT $1`,
      params
    );

    if (problemsResult.rows.length === 0) {
      return res.status(400).json({ error: "No problems available for the selected criteria" });
    }

    const assessmentResult = await query<{ id: string }>(
      `INSERT INTO assessments (user_id, status, time_limit_minutes, difficulty_mix, problem_count, started_at)
       VALUES ($1, 'active', $2, $3, $4, NOW())
       RETURNING id`,
      [userId, timeLimit, difficultyMix, problemsResult.rows.length]
    );
    const assessmentId = assessmentResult.rows[0].id;

    for (let i = 0; i < problemsResult.rows.length; i++) {
      await query(
        `INSERT INTO assessment_problems (assessment_id, problem_id, problem_order)
         VALUES ($1, $2, $3)`,
        [assessmentId, problemsResult.rows[i].id, i]
      );
    }

    return res.status(201).json({ assessmentId, problemCount: problemsResult.rows.length, timeLimitMinutes: timeLimit });
  } catch (err) {
    console.error("Create assessment error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const id = getSingleParam(req.params.id);

  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: "Invalid assessment id" });
  }

  try {
    const assessmentResult = await query<AssessmentRow>(
      `SELECT id, user_id, status, time_limit_minutes, difficulty_mix, problem_count,
              started_at, finished_at, score, created_at
       FROM assessments
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (assessmentResult.rows.length === 0) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    const problemsResult = await query<AssessmentProblemRow>(
      `SELECT ap.id, ap.assessment_id, ap.problem_id, ap.problem_order, ap.submission_id,
              p.title, p.slug, p.difficulty,
              s.status AS submission_status
       FROM assessment_problems ap
       JOIN problems p ON p.id = ap.problem_id
       LEFT JOIN submissions s ON s.id = ap.submission_id
       WHERE ap.assessment_id = $1
       ORDER BY ap.problem_order ASC`,
      [id]
    );

    const assessment = assessmentResult.rows[0];
    if (problemsResult.rows.length === 0) {
      return res.status(500).json({ error: "Assessment has no assigned problems. Please create a new assessment." });
    }
    if (problemsResult.rows.length !== assessment.problem_count) {
      return res.status(500).json({
        error: `Assessment problem mismatch: expected ${assessment.problem_count}, found ${problemsResult.rows.length}`,
      });
    }
    const elapsed = Date.now() - new Date(assessment.started_at).getTime();
    const remainingMs = Math.max(0, assessment.time_limit_minutes * 60 * 1000 - elapsed);

    return res.json({
      assessment,
      problems: problemsResult.rows,
      remainingMs: assessment.status === "active" ? remainingMs : 0,
    });
  } catch (err) {
    console.error("Get assessment error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/solve", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const id = getSingleParam(req.params.id);
  const { problemId, submissionId } = req.body as { problemId?: string; submissionId?: string };

  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: "Invalid assessment id" });
  }
  if (!problemId || !submissionId) {
    return res.status(400).json({ error: "problemId and submissionId are required" });
  }
  if (!UUID_REGEX.test(problemId)) {
    return res.status(400).json({ error: "Invalid problemId" });
  }
  if (!UUID_REGEX.test(submissionId)) {
    return res.status(400).json({ error: "Invalid submissionId" });
  }

  try {
    const assessmentResult = await query<AssessmentRow>(
      `SELECT id, user_id, status, started_at, time_limit_minutes
       FROM assessments WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (assessmentResult.rows.length === 0) {
      return res.status(404).json({ error: "Assessment not found" });
    }
    if (assessmentResult.rows[0].status !== "active") {
      return res.status(400).json({ error: "Assessment is no longer active" });
    }

    const updateRes = await query(
      `UPDATE assessment_problems SET submission_id = $1
       WHERE assessment_id = $2 AND problem_id = $3`,
      [submissionId, id, problemId]
    );
    if (updateRes.rowCount === 0) {
      return res.status(404).json({ error: "Problem is not part of this assessment" });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Link assessment submission error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/submit", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const id = getSingleParam(req.params.id);

  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({ error: "Invalid assessment id" });
  }

  try {
    const assessmentResult = await query<AssessmentRow>(
      `SELECT id, user_id, status FROM assessments WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (assessmentResult.rows.length === 0) {
      return res.status(404).json({ error: "Assessment not found" });
    }
    if (assessmentResult.rows[0].status !== "active") {
      return res.status(400).json({ error: "Assessment already submitted" });
    }

    const problemsResult = await query<{ submission_status: string | null }>(
      `SELECT s.status AS submission_status
       FROM assessment_problems ap
       LEFT JOIN submissions s ON s.id = ap.submission_id
       WHERE ap.assessment_id = $1`,
      [id]
    );

    const total = problemsResult.rows.length;
    const passed = problemsResult.rows.filter((r) => r.submission_status === "passed").length;
    const score = total > 0 ? Math.round((passed / total) * 100 * 100) / 100 : 0;

    await query(
      `UPDATE assessments SET status = 'completed', finished_at = NOW(), score = $2 WHERE id = $1`,
      [id, score]
    );

    return res.json({ score, passed, total, status: "completed" });
  } catch (err) {
    console.error("Submit assessment error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
