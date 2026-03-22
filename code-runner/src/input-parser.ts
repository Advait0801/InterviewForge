import { ProblemMeta } from "./problem-meta";

export interface ParsedInput {
  isDesign: boolean;
  ops?: string[];
  opArgs?: unknown[][];
  args?: unknown[];
  argTypes?: string[];
}

/**
 * Parse a human-readable test case input into structured data.
 *
 * Regular problems:  "nums = [2, 7, 11, 15], target = 9"
 * Design problems:   '["Trie","insert","search"]\n[[],["apple"],["apple"]]'
 */
export function parseTestInput(input: string, meta: ProblemMeta): ParsedInput {
  const trimmed = input.trim();

  if (meta.isDesign) {
    return parseDesignInput(trimmed);
  }

  return parseRegularInput(trimmed, meta);
}

function parseDesignInput(input: string): ParsedInput {
  const lines = input.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2) {
    const ops = JSON.parse(lines[0]) as string[];
    const opArgs = JSON.parse(lines[1]) as unknown[][];
    return { isDesign: true, ops, opArgs };
  }

  const ops = JSON.parse(input) as string[];
  return { isDesign: true, ops, opArgs: ops.map(() => []) };
}

function parseRegularInput(input: string, meta: ProblemMeta): ParsedInput {
  const params = meta.params || [];
  const argTypes = params.map((p) => p.type);

  if (params.length === 1) {
    const eqIdx = input.indexOf("=");
    if (eqIdx !== -1) {
      const valueStr = input.substring(eqIdx + 1).trim();
      return { isDesign: false, args: [parseValue(valueStr)], argTypes };
    }
    return { isDesign: false, args: [parseValue(input)], argTypes };
  }

  const parts = splitNamedParams(input);
  const args: unknown[] = [];

  for (const param of params) {
    const found = parts.find((p) => p.name === param.name);
    args.push(found ? found.value : null);
  }

  return { isDesign: false, args, argTypes };
}

interface NamedParam {
  name: string;
  value: unknown;
}

function splitNamedParams(input: string): NamedParam[] {
  const results: NamedParam[] = [];

  let depth = 0;
  let inString = false;
  let escapeNext = false;
  const breakPoints: number[] = [0];

  for (let i = 0; i < input.length; i++) {
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    const ch = input[i];
    if (ch === "\\") {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "[" || ch === "(" || ch === "{") depth++;
    if (ch === "]" || ch === ")" || ch === "}") depth--;

    if (depth === 0 && ch === ",") {
      const rest = input.substring(i + 1);
      if (/^\s*[a-zA-Z_]\w*\s*=/.test(rest)) {
        breakPoints.push(i + 1);
      }
    }
  }

  for (let i = 0; i < breakPoints.length; i++) {
    const start = breakPoints[i];
    const end = i + 1 < breakPoints.length ? breakPoints[i + 1] - 1 : input.length;
    const part = input.substring(start, end).trim();
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;

    const name = part.substring(0, eqIdx).trim();
    const valueStr = part.substring(eqIdx + 1).trim();
    results.push({ name, value: parseValue(valueStr) });
  }

  return results;
}

function parseValue(str: string): unknown {
  const s = str.trim();
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

/**
 * Normalize the expected output to a comparable string.
 * Handles float precision, boolean strings, whitespace.
 */
export function normalizeOutput(output: string): string {
  const s = output.trim();
  try {
    const parsed = JSON.parse(s);
    return JSON.stringify(parsed);
  } catch {
    return s;
  }
}

/**
 * Compare actual output against expected output.
 * Handles float tolerance and unordered array comparison.
 */
export function compareOutputs(
  actual: string,
  expected: string,
  unordered = false
): boolean {
  const a = normalizeOutput(actual);
  const e = normalizeOutput(expected);

  if (a === e) return true;

  try {
    const ap = JSON.parse(a);
    const ep = JSON.parse(e);

    if (typeof ap === "number" && typeof ep === "number") {
      return Math.abs(ap - ep) < 1e-4;
    }

    if (unordered && Array.isArray(ap) && Array.isArray(ep)) {
      return sortedArrayEqual(ap, ep);
    }

    return JSON.stringify(ap) === JSON.stringify(ep);
  } catch {
    return false;
  }
}

function sortedArrayEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  const sa = a.map(canonicalize).sort();
  const sb = b.map(canonicalize).sort();
  return sa.every((v, i) => v === sb[i]);
}

function canonicalize(v: unknown): string {
  if (Array.isArray(v)) {
    const sorted = [...v].sort((x, y) => {
      const sx = JSON.stringify(x);
      const sy = JSON.stringify(y);
      return sx < sy ? -1 : sx > sy ? 1 : 0;
    });
    return JSON.stringify(sorted);
  }
  return JSON.stringify(v);
}
