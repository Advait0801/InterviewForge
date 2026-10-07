import * as recs from "../repositories/recommendations.repository";
import { recommendTopics } from "./ai.service";

function normalizeTopicsForMatch(aiTopics: string[]): string[] {
  return aiTopics.map((t) => t.trim()).filter(Boolean).slice(0, 8);
}

/** Problems matching any suggested topic, falling back to any unsolved problem. */
async function recommendedProblems(userId: string, aiTopics: string[], limit: number) {
  const topics = normalizeTopicsForMatch(aiTopics);
  if (topics.length === 0) return recs.randomUnsolved(userId, limit);

  const matching = await recs.unsolvedMatchingTopics(userId, topics, limit);
  return matching.length > 0 ? matching : recs.randomUnsolved(userId, limit);
}

/**
 * Personalised next steps. The topic choice comes from the AI service; an
 * AIServiceError propagates for the route to map.
 */
export async function getRecommendations(userId: string) {
  const profile = await recs.practiceProfile(userId);
  const { weak_topics } = profile;

  const ai = await recommendTopics({
    ...profile,
    recent_notes: weak_topics.length ? `Weak areas: ${weak_topics.slice(0, 5).join(", ")}` : null,
  });

  const recommendedTopics = ai.recommendedTopics?.length ? ai.recommendedTopics : weak_topics;
  const [recommended, revisit] = await Promise.all([
    recommendedProblems(userId, recommendedTopics, 8),
    recs.revisitCandidates(userId, 8),
  ]);

  return {
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
  };
}
