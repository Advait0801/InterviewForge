/**
 * Shared by every language's harness generator for timing mode (Phase 12): see
 * GenerateOptions in harness-gen.ts.
 */
export const TIMING_PREFIX = "__IFT__";

/** Replace exactly one occurrence, or fail loudly: a harness edit must not silently skip timing. */
export function replaceOnce(text: string, find: string, replacement: string): string {
  const at = text.indexOf(find);
  if (at < 0 || text.indexOf(find, at + find.length) >= 0) {
    throw new Error(`timing: expected exactly one ${JSON.stringify(find.slice(0, 60))}`);
  }
  return text.slice(0, at) + replacement + text.slice(at + find.length);
}

/**
 * Wrap the single line that calls the user's function with `before` and `after` lines.
 * Every compiled generator emits the call as one statement on its own line.
 */
export function wrapCallLine(block: string, callNeedle: string, before: string, after: string): string {
  const lines = block.split("\n");
  const hits = lines.map((l, i) => (l.includes(callNeedle) ? i : -1)).filter((i) => i >= 0);
  if (hits.length !== 1) throw new Error(`timing: expected one call to ${callNeedle}, found ${hits.length}`);
  const indent = /^\s*/.exec(lines[hits[0]])![0];
  lines.splice(hits[0], 1, `${indent}${before}`, lines[hits[0]], `${indent}${after}`);
  return lines.join("\n");
}
