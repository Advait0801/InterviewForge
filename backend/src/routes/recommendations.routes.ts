import { Router } from "express";
import { query } from "../db";
import { AuthRequest, requireAuth } from "../middleware/auth.middleware";
import { AIServiceError, recommendTopics } from "../services/ai.service";

const router = Router();

type ProblemRow = {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  topics: string[];
};

function normalizeTopicsForMatch(aiTopics: string[]): string[] {
  return aiTopics.map((t) => t.trim()).filter(Boolean).slice(0, 8);
}

/** Problems matching any AI-suggested topic (substring match on problem topics). */
async function fetchRecommendedProblems(userId: string, aiTopics: string[], limit: number): Promise<ProblemRow[]> {
  const topics = normalizeTopicsForMatch(aiTopics);
  if (topics.length === 0) {
    const fallback = await query<ProblemRow>(
      `SELECT p.id, p.slug, p.title, p.difficulty, p.topics
       FROM problems p
       WHERE NOT EXISTS (
         SELECT 1 FROM submissions s
         WHERE s.user_id = $1 AND s.problem_id = p.id AND s.status = 'passed'
       )
       ORDER BY random()
       LIMIT $2`,
      [userId, limit],
    );
    return fallback.rows;
  }

  const result = await query<ProblemRow>(
    `SELECT p.id, p.slug, p.title, p.difficulty, p.topics
     FROM problems p
     WHERE NOT EXISTS (
       SELECT 1 FROM submissions s
       WHERE s.user_id = $1 AND s.problem_id = p.id AND s.status = 'passed'
     )
     AND EXISTS (
       SELECT 1
       FROM unnest(p.topics) AS pt(ptopic)
       CROSS JOIN unnest($2::text[]) AS w(q1)
       WHERE LOWER(ptopic) LIKE '%' || LOWER(TRIM(q1)) || '%'
          OR LOWER(TRIM(q1)) LIKE '%' || LOWER(ptopic) || '%'
     )
     ORDER BY random()
     LIMIT $3`,
    [userId, topics, limit],
  );
  if (result.rows.length > 0) {
    return result.rows;
  }

  const anyUnsolved = await query<ProblemRow>(
    `SELECT p.id, p.slug, p.title, p.difficulty, p.topics
     FROM problems p
     WHERE NOT EXISTS (
       SELECT 1 FROM submissions s
       WHERE s.user_id = $1 AND s.problem_id = p.id AND s.status = 'passed'
     )
     ORDER BY random()
     LIMIT $2`,
    [userId, limit],
  );
  return anyUnsolved.rows;
}

async function fetchRevisitProblems(userId: string, limit: number): Promise<Array<ProblemRow & { last_attempted_at: string }>> {
  const result = await query<ProblemRow & { last_attempted_at: string }>(
    `WITH agg AS (
       SELECT
         s.problem_id,
         COUNT(*) FILTER (WHERE s.status = 'failed')::int AS fails,
         COUNT(*)::int AS sub_count,
         MAX(s.created_at) AS last_at,
         BOOL_OR(s.status = 'passed') AS passed
       FROM submissions s
       WHERE s.user_id = $1
       GROUP BY s.problem_id
     )
     SELECT p.id, p.slug, p.title, p.difficulty, p.topics, agg.last_at::text AS last_attempted_at
     FROM agg
     JOIN problems p ON p.id = agg.problem_id
     WHERE (agg.fails > 0 OR agg.sub_count > 1)
       AND agg.last_at < NOW() - INTERVAL '3 days'
     ORDER BY agg.last_at ASC
     LIMIT $2`,
    [userId, limit],
  );
  return result.rows;
}

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;

  try {
    const [solvedDiff, topicCounts, weakTopicsRes, totalSolvedRes] = await Promise.all([
      query<{ difficulty: string; cnt: string }>(
        `SELECT p.difficulty, COUNT(DISTINCT s.problem_id)::text AS cnt
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id
         WHERE s.user_id = $1 AND s.status = 'passed'
         GROUP BY p.difficulty`,
        [userId],
      ),
      query<{ topic: string; cnt: string }>(
        `SELECT t.topic, COUNT(DISTINCT s.problem_id)::text AS cnt
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id
         CROSS JOIN LATERAL unnest(p.topics) AS t(topic)
         WHERE s.user_id = $1 AND s.status = 'passed'
         GROUP BY t.topic`,
        [userId],
      ),
      query<{ topic: string }>(
        `SELECT u.topic
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id
         CROSS JOIN LATERAL unnest(p.topics) AS u(topic)
         WHERE s.user_id = $1
         GROUP BY u.topic
         HAVING COUNT(*) > 0
           AND (COUNT(*) FILTER (WHERE s.status = 'failed')::float / COUNT(*)::float) >= 0.4
         ORDER BY COUNT(*) FILTER (WHERE s.status = 'failed') DESC
         LIMIT 12`,
        [userId],
      ),
      query<{ cnt: string }>(
        `SELECT COUNT(DISTINCT problem_id)::text AS cnt FROM submissions WHERE user_id = $1 AND status = 'passed'`,
        [userId],
      ),
    ]);

    const difficulty_distribution: Record<string, number> = {};
    for (const row of solvedDiff.rows) {
      difficulty_distribution[row.difficulty] = parseInt(row.cnt, 10);
    }

    const topic_counts: Record<string, number> = {};
    for (const row of topicCounts.rows) {
      topic_counts[row.topic] = parseInt(row.cnt, 10);
    }

    const weak_topics = weakTopicsRes.rows.map((r) => r.topic);
    const total_solved = parseInt(totalSolvedRes.rows[0]?.cnt ?? "0", 10);

    let ai: Awaited<ReturnType<typeof recommendTopics>>;
    try {
      ai = await recommendTopics({
        total_solved,
        difficulty_distribution,
        topic_counts,
        weak_topics,
        recent_notes: weak_topics.length ? `Weak areas: ${weak_topics.slice(0, 5).join(", ")}` : null,
      });
    } catch (err) {
      if (err instanceof AIServiceError) {
        return res.status(err.statusCode >= 500 ? 503 : err.statusCode).json({
          error: err.message,
          details: err.details,
        });
      }
      throw err;
    }

    const recommendedTopics = ai.recommendedTopics?.length ? ai.recommendedTopics : weak_topics;

    const [recommended, revisit] = await Promise.all([
      fetchRecommendedProblems(userId, recommendedTopics, 8),
      fetchRevisitProblems(userId, 8),
    ]);

    return res.json({
      recommended,
      revisit: revisit.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        difficulty: r.difficulty,
        topics: r.topics,
        lastAttemptedAt: r.last_attempted_at,
      })),
      focusAreas: ai.focusAreas ?? [],
      reasoning: ai.reasoning ?? "",
      difficultySuggestion: ai.difficultySuggestion ?? "",
    });
  } catch (err) {
    console.error("Recommendations error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
