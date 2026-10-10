import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The verified reference solutions (backend/reference_solutions/<slug>/, D-042) double as
 * the oracle for custom test cases: a user's own input gets its expected output by running
 * the problem's Python reference on it. Python because it's the fastest sandbox to start,
 * and every problem has one (verify_problems.py checks it against the independent oracles).
 */
export const REFERENCE_DIR = join(__dirname, "..", "..", "reference_solutions");

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const cache = new Map<string, string | null>();

export function referenceSolution(slug: string): { language: "python3"; code: string } | null {
  if (!SLUG.test(slug)) return null;
  if (!cache.has(slug)) {
    const file = join(REFERENCE_DIR, slug, "solution.py");
    cache.set(slug, existsSync(file) ? readFileSync(file, "utf8") : null);
  }
  const code = cache.get(slug);
  return code ? { language: "python3", code } : null;
}
