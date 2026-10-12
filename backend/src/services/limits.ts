/**
 * Size bounds on what users send. Text bound for the ai-service ends up in a model prompt,
 * where its size is paid for on every call of the turn, so it is bounded here, at the edge,
 * rather than by the request body limit (8 MB, sized for résumé PDFs).
 */

/** Source code: a submission, or the peer editor's shared state. */
export const MAX_CODE_CHARS = 50_000;

/** Free text a model reads: an answer, a draft, an explanation, a design prompt. */
export const MAX_TEXT_CHARS = 20_000;

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && (DIFFICULTIES as readonly string[]).includes(value);
}

/** A string over `max` characters; anything that isn't a string is the caller's to check. */
export function isTooLong(value: unknown, max = MAX_TEXT_CHARS): boolean {
  return typeof value === "string" && value.length > max;
}
