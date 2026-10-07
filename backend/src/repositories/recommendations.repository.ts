import { query } from "../db";

export type ProblemRow = {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  topics: string[];
};

export type RevisitRow = ProblemRow & { last_attempted_at: string };

/** Unsolved problems whose topics loosely match any of `topics` (substring either way). */
export async function unsolvedMatchingTopics(userId: string, topics: string[], limit: number): Promise<ProblemRow[]> {
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
  return result.rows;
}

export async function randomUnsolved(userId: string, limit: number): Promise<ProblemRow[]> {
  const result = await query<ProblemRow>(
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
  return result.rows;
}

/** Problems failed or retried, last touched more than 3 days ago, oldest first. */
export async function revisitCandidates(userId: string, limit: number): Promise<RevisitRow[]> {
  const result = await query<RevisitRow>(
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

export type PracticeProfile = {
  total_solved: number;
  difficulty_distribution: Record<string, number>;
  topic_counts: Record<string, number>;
  weak_topics: string[];
};

/** What the recommender is told about a user: solved counts by difficulty and topic, and weak topics. */
export async function practiceProfile(userId: string): Promise<PracticeProfile> {
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

  return {
    total_solved: parseInt(totalSolvedRes.rows[0]?.cnt ?? "0", 10),
    difficulty_distribution,
    topic_counts,
    weak_topics: weakTopicsRes.rows.map((r) => r.topic),
  };
}
