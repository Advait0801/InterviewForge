import type { ParamMeta, ProblemMeta } from "./problem-meta";

/**
 * Checks a user's custom test input against the problem's signature before any
 * sandbox runs it. The format is the one the examples use:
 *
 *   regular:  nums = [2, 7, 11, 15], target = 9      (the `name =` is optional with one parameter)
 *   design:   ["LRUCache", "put", "get"]
 *             [[2], [1, 1], [1]]
 *
 * Without this a typo becomes a confusing runtime error in the user's own code, or
 * worse, a wrong "expected" output from the reference solution. Only types and
 * shape are checked; a problem's constraints (e.g. "exactly one answer") aren't.
 */

const INT_MIN = -(2 ** 31);
const INT_MAX = 2 ** 31 - 1;

/** Arguments that arrive bare rather than wrapped in a list (input-parser / the design drivers). */
const DESIGN_COLLECTION_TYPES = new Set(["TreeNode", "ListNode", "int[]", "int[][]", "string[]", "char[]", "char[][]", "ListNode[]"]);

const isInt = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v >= INT_MIN && v <= INT_MAX;
const isChar = (v: unknown) => typeof v === "string" && [...v].length === 1;

function describe(t: string): string {
  const names: Record<string, string> = {
    int: "an integer",
    double: "a number",
    bool: "true or false",
    string: "a string in double quotes",
    "int[]": "an array of integers",
    "int[][]": "an array of integer arrays",
    "string[]": "an array of strings",
    "string[][]": "an array of string arrays",
    "char[]": "an array of one-character strings",
    "char[][]": "an array of arrays of one-character strings",
    ListNode: "a list of integers, like [1, 2, 3]",
    "ListNode[]": "an array of integer lists, like [[1, 4], [2]]",
    TreeNode: "a level-order array with null for gaps, like [1, null, 2]",
  };
  return names[t] ?? t;
}

function matches(v: unknown, t: string): boolean {
  const arrayOf = (pred: (x: unknown) => boolean) => Array.isArray(v) && v.every(pred);
  switch (t) {
    case "int": return isInt(v);
    case "double": return typeof v === "number" && Number.isFinite(v);
    case "bool": return typeof v === "boolean";
    case "string": return typeof v === "string";
    case "int[]":
    case "ListNode": return arrayOf(isInt);
    case "int[][]":
    case "ListNode[]": return arrayOf((r) => Array.isArray(r) && r.every(isInt));
    case "string[]": return arrayOf((s) => typeof s === "string");
    case "string[][]": return arrayOf((r) => Array.isArray(r) && r.every((s) => typeof s === "string"));
    case "char[]": return arrayOf(isChar);
    case "char[][]": return arrayOf((r) => Array.isArray(r) && r.every(isChar));
    case "TreeNode": return arrayOf((x) => x === null || isInt(x)) && (!(v as unknown[]).length || (v as unknown[])[0] !== null);
    default: return false;
  }
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/** Split `a = 1, b = [2, 3]` at top-level commas that start a new `name =`. */
function splitNamed(input: string): Array<{ name: string; text: string }> | null {
  let depth = 0;
  let inString = false;
  let escape = false;
  const starts: number[] = [0];
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "[" || ch === "{") depth++;
    if (ch === "]" || ch === "}") depth--;
    if (depth === 0 && ch === "," && /^\s*[a-zA-Z_]\w*\s*=/.test(input.substring(i + 1))) starts.push(i + 1);
  }
  const parts: Array<{ name: string; text: string }> = [];
  for (let k = 0; k < starts.length; k++) {
    const end = k + 1 < starts.length ? starts[k + 1] - 1 : input.length;
    const part = input.substring(starts[k], end).trim();
    const m = /^([a-zA-Z_]\w*)\s*=([\s\S]*)$/.exec(part);
    if (!m) return null;
    parts.push({ name: m[1], text: m[2].trim() });
  }
  return parts;
}

function checkValue(text: string, p: ParamMeta): string | null {
  const parsed = parseJson(text);
  if (!parsed.ok) return `${p.name} isn't valid: expected ${describe(p.type)}.`;
  if (!matches(parsed.value, p.type)) return `${p.name} should be ${describe(p.type)}.`;
  return null;
}

function treeValues(arr: unknown[]): Set<number> {
  return new Set(arr.filter((x): x is number => typeof x === "number"));
}

function validateRegular(input: string, meta: ProblemMeta): string | null {
  const params = meta.params ?? [];
  const values = new Map<string, unknown>();

  if (params.length === 1) {
    const prefix = /^\s*([a-zA-Z_]\w*)\s*=/.exec(input);
    if (prefix && prefix[1] !== params[0].name) return `Unknown parameter "${prefix[1]}". Expected: ${params[0].name}.`;
    const text = prefix ? input.substring(prefix[0].length).trim() : input;
    const err = checkValue(text, params[0]);
    if (err) return err;
    values.set(params[0].name, JSON.parse(text));
  } else {
    const parts = splitNamed(input);
    const expected = params.map((p) => p.name).join(", ");
    if (!parts) return `Write each parameter as name = value, separated by commas: ${expected}.`;
    for (const part of parts) {
      const p = params.find((x) => x.name === part.name);
      if (!p) return `Unknown parameter "${part.name}". Expected: ${expected}.`;
      if (values.has(p.name)) return `${p.name} is given twice.`;
      const err = checkValue(part.text, p);
      if (err) return err;
      values.set(p.name, JSON.parse(part.text));
    }
    const missing = params.filter((p) => !values.has(p.name)).map((p) => p.name);
    if (missing.length) return `Missing ${missing.join(", ")}. Expected: ${expected}.`;
  }

  // The harnesses turn these into node references; a value that isn't there would
  // reach the solution as a dangling int (or null) instead of a node.
  if (meta.methodName === "lowestCommonAncestor") {
    const inTree = treeValues(values.get(params[0].name) as unknown[]);
    for (const name of ["p", "q"]) {
      if (values.has(name) && !inTree.has(values.get(name) as number)) return `${name} must be a value in the tree.`;
    }
  }
  if (meta.methodName === "hasCycle") {
    const head = values.get("head") as unknown[];
    const pos = values.get("pos") as number;
    if (pos !== -1 && (pos < 0 || pos >= head.length)) return "pos must be -1 (no cycle) or an index into head.";
  }
  return null;
}

function validateDesign(input: string, meta: ProblemMeta): string | null {
  const lines = input.split("\n").map((l) => l.trim()).filter(Boolean);
  const shape = `Two lines: the operations, then their arguments, e.g. ["${meta.className}", ...] and [[...], ...].`;
  if (lines.length !== 2) return shape;
  const ops = parseJson(lines[0]);
  const args = parseJson(lines[1]);
  if (!ops.ok || !args.ok || !Array.isArray(ops.value) || !Array.isArray(args.value)) return shape;
  const opList = ops.value as unknown[];
  const argList = args.value as unknown[];
  if (!opList.length || opList[0] !== meta.className) return `The first operation must be "${meta.className}".`;
  if (opList.length !== argList.length) return `There are ${opList.length} operations but ${argList.length} argument lists.`;

  const ctor = meta.constructorParams ?? [];
  const ctorArgs = argList[0];
  if (!Array.isArray(ctorArgs) || ctorArgs.length !== ctor.length || ctor.some((p, k) => !matches(ctorArgs[k], p.type))) {
    const want = ctor.length ? ctor.map((p) => `${p.name} (${describe(p.type)})`).join(", ") : "nothing: []";
    return `${meta.className} takes ${want}.`;
  }

  for (let i = 1; i < opList.length; i++) {
    const method = (meta.methods ?? []).find((m) => m.name === opList[i]);
    if (!method) return `Operation ${i + 1}: "${String(opList[i])}" isn't a method of ${meta.className}.`;
    const raw = argList[i];
    const bare = method.params.length === 1 && DESIGN_COLLECTION_TYPES.has(method.params[0].type);
    if (bare) {
      if (!matches(raw, method.params[0].type)) return `Operation ${i + 1} (${method.name}): ${method.params[0].name} should be ${describe(method.params[0].type)}.`;
      continue;
    }
    // A lone scalar may also arrive bare (deserialize's string does).
    const list = Array.isArray(raw) ? raw : method.params.length === 1 ? [raw] : null;
    if (!list || list.length !== method.params.length) {
      return `Operation ${i + 1} (${method.name}) takes ${method.params.length} argument${method.params.length === 1 ? "" : "s"}.`;
    }
    for (let k = 0; k < method.params.length; k++) {
      const p = method.params[k];
      if (!matches(list[k], p.type)) return `Operation ${i + 1} (${method.name}): ${p.name} should be ${describe(p.type)}.`;
    }
  }
  return null;
}

/** null when the input is usable, otherwise a message the user can act on. */
export function validateInput(input: string, meta: ProblemMeta): string | null {
  const trimmed = input.trim();
  if (!trimmed) return "The input is empty.";
  return meta.isDesign ? validateDesign(trimmed, meta) : validateRegular(trimmed, meta);
}
