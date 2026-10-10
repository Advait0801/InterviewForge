/**
 * Where a failing output goes wrong, so the client can mark it instead of
 * leaving the user to eyeball two long JSON lines.
 *
 * It follows compareOutputs' rules exactly -- the 1e-4 tolerance applies only to
 * a top-level number, and an unordered output is compared as a multiset -- so a
 * diff exists precisely when compareOutputs says the case failed.
 */

export type OutputDiff =
  /** The output isn't JSON at all (a stray print, a crash message). */
  | { kind: "format" }
  /** Different JSON types at `path`, e.g. a number where an array was expected. */
  | { kind: "type"; path: number[]; expectedType: string; actualType: string }
  /** The first differing value, at `path`. `charIndex` is the first differing character of two strings. */
  | { kind: "value"; path: number[]; expected: Scalar; actual: Scalar; charIndex?: number }
  /** Every element up to the shorter length matched, but the arrays at `path` differ in length. */
  | { kind: "length"; path: number[]; expectedLength: number; actualLength: number }
  /** An order-independent output: what's missing from the actual output and what shouldn't be there. */
  | { kind: "items"; missing: unknown[]; unexpected: unknown[]; expectedLength: number; actualLength: number };

type Scalar = string | number | boolean | null;

/** Enough to point at the problem; the full outputs are on the result already. */
const MAX_ITEMS = 10;

function jsonType(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function parse(s: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(s.trim()) };
  } catch {
    return { ok: false };
  }
}

function firstCharDifference(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return n;
}

function walk(expected: unknown, actual: unknown, path: number[], topLevel: boolean): OutputDiff | undefined {
  const et = jsonType(expected);
  const at = jsonType(actual);
  if (et !== at) return { kind: "type", path, expectedType: et, actualType: at };

  if (Array.isArray(expected) && Array.isArray(actual)) {
    const n = Math.min(expected.length, actual.length);
    for (let i = 0; i < n; i++) {
      const d = walk(expected[i], actual[i], [...path, i], false);
      if (d) return d;
    }
    if (expected.length !== actual.length) {
      return { kind: "length", path, expectedLength: expected.length, actualLength: actual.length };
    }
    return undefined;
  }

  if (et === "object") {
    // No problem returns an object; compare by serialisation like compareOutputs does.
    return JSON.stringify(expected) === JSON.stringify(actual)
      ? undefined
      : { kind: "type", path, expectedType: et, actualType: at };
  }

  if (typeof expected === "number" && typeof actual === "number" && topLevel) {
    return Math.abs(expected - actual) < 1e-4 ? undefined : { kind: "value", path, expected, actual };
  }
  if (expected === actual) return undefined;
  if (typeof expected === "string" && typeof actual === "string") {
    return { kind: "value", path, expected, actual, charIndex: firstCharDifference(expected, actual) };
  }
  return { kind: "value", path, expected: expected as Scalar, actual: actual as Scalar };
}

function canonical(v: unknown, unorderedInner: boolean): string {
  if (unorderedInner && Array.isArray(v)) {
    return JSON.stringify([...v].map((x) => JSON.stringify(x)).sort().map((x) => JSON.parse(x)));
  }
  return JSON.stringify(v);
}

function multisetDiff(expected: unknown[], actual: unknown[], unorderedInner: boolean): OutputDiff | undefined {
  const remaining = new Map<string, number>();
  for (const e of expected) {
    const key = canonical(e, unorderedInner);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  const unexpected: unknown[] = [];
  for (const a of actual) {
    const key = canonical(a, unorderedInner);
    const left = remaining.get(key) ?? 0;
    if (left > 0) remaining.set(key, left - 1);
    else unexpected.push(a);
  }
  const missing: unknown[] = [];
  for (const e of expected) {
    const key = canonical(e, unorderedInner);
    const left = remaining.get(key) ?? 0;
    if (left > 0) {
      missing.push(e);
      remaining.set(key, left - 1);
    }
  }
  if (!missing.length && !unexpected.length) return undefined;
  return {
    kind: "items",
    missing: missing.slice(0, MAX_ITEMS),
    unexpected: unexpected.slice(0, MAX_ITEMS),
    expectedLength: expected.length,
    actualLength: actual.length,
  };
}

/** The first place `actual` departs from `expected`, or undefined when they match. */
export function diffOutputs(
  actual: string,
  expected: string,
  unordered = false,
  unorderedInner = false
): OutputDiff | undefined {
  const e = parse(expected);
  const a = parse(actual);
  if (!a.ok || !e.ok) {
    // Text that isn't JSON matches only itself (compareOutputs' fallback).
    return actual.trim() === expected.trim() ? undefined : { kind: "format" };
  }
  if (unordered && Array.isArray(e.value) && Array.isArray(a.value)) {
    return multisetDiff(e.value, a.value, unorderedInner);
  }
  return walk(e.value, a.value, [], true);
}
