/**
 * Empirical time complexity (Phase 12): which growth class fits the measured running
 * times, and does it agree with what the AI reviewer claimed?
 *
 * Pure: no I/O, no randomness. The measurements come from the code-runner, which times the
 * user's call alone on inputs doubling in size (code-runner/src/complexity.ts).
 *
 * The fit. For each class f, least squares on t ≈ a + b·f(n) with a, b ≥ 0, minimising
 * *relative* error, since times span four orders of magnitude and an absolute fit would
 * only look at the largest size. `a` absorbs the per-call overhead that makes small sizes
 * look flatter than they are. The class with the lowest error wins; any class the data can't
 * rule out is reported alongside it.
 *
 * Ruling out the class one log factor away (n vs n log n, 1 vs log n) takes a 3.5x better
 * fit, not 1.5x. Across 2^8 to 2^17 a log factor changes the cost per element by at most
 * 2.1x, and memory does the same on its own: measured in Phase 12, a C++ unordered_map's cost
 * per element grows by about that much once it outgrows the caches, so a hash map fitted
 * O(n log n) 3x better than O(n), and C++ and Rust merge sorts fitted O(n) 2x better than
 * O(n log n). Interpreted languages separate them cleanly (interpreter overhead dwarfs cache
 * misses); compiled ones usually report both, which is the honest answer.
 *
 * Statistic choice: the minimum of the repeats per size. Interference (another container,
 * a GC pause) only ever adds time, so the minimum is the closest to the code's own cost.
 */

export const CLASSES = ["O(1)", "O(log n)", "O(n)", "O(n log n)", "O(n²)", "O(n³)"] as const;
export type ComplexityClass = (typeof CLASSES)[number];

const log2 = (n: number) => Math.log2(n);
const BASIS: Record<ComplexityClass, (n: number) => number> = {
  "O(1)": () => 1,
  "O(log n)": (n) => log2(n),
  "O(n)": (n) => n,
  "O(n log n)": (n) => n * log2(n),
  "O(n²)": (n) => n * n,
  "O(n³)": (n) => n * n * n,
};

/** Below this a time is mostly timer and scheduling noise. */
export const NOISE_FLOOR_NS = 2_000;
/** A class within this factor of the best fit's error (or AMBIGUITY_SLACK of it) is a candidate too. */
export const AMBIGUITY = 1.5;
export const AMBIGUITY_SLACK = 0.02;
/** The same for the class a log factor away from the best fit (see above). */
export const LOG_NEIGHBOUR_AMBIGUITY = 3.5;
const LOG_NEIGHBOURS: Partial<Record<ComplexityClass, ComplexityClass>> = {
  "O(1)": "O(log n)",
  "O(log n)": "O(1)",
  "O(n)": "O(n log n)",
  "O(n log n)": "O(n)",
};
const MIN_POINTS = 4;
const MIN_RANGE = 8;

export type MeasuredPoint = { n: number; ns: number[] };
export type Fit = { class: ComplexityClass; error: number };

export type ComplexityFit =
  | {
      status: "measured";
      bestFit: ComplexityClass;
      /** The best fit and every class the data can't rule out, fastest-growing last. */
      candidates: ComplexityClass[];
      confidence: "high" | "medium" | "low";
      fits: Fit[];
      /** Slope of log t against log n over the larger half: ~0, 1, ~1.1-1.2, 2 for 1, n, n log n, n². */
      slope: number;
      points: Array<{ n: number; ns: number }>;
    }
  | {
      status: "inconclusive";
      reason: "too_few_sizes" | "too_fast";
      /** What the data allows, when it allows anything: a too-fast run is at most logarithmic. */
      candidates: ComplexityClass[];
      points: Array<{ n: number; ns: number }>;
    };

function fitClass(cls: ComplexityClass, n: number[], t: number[]): number {
  const f = n.map(BASIS[cls]);
  const w = t.map((x) => 1 / (x * x));
  const sum = (g: (i: number) => number) => n.reduce((acc, _, i) => acc + g(i), 0);

  let a: number;
  let b: number;
  if (cls === "O(1)") {
    a = sum((i) => w[i] * t[i]) / sum((i) => w[i]);
    b = 0;
  } else {
    // Weighted normal equations for t = a + b f.
    const sw = sum((i) => w[i]);
    const sf = sum((i) => w[i] * f[i]);
    const sff = sum((i) => w[i] * f[i] * f[i]);
    const st = sum((i) => w[i] * t[i]);
    const sft = sum((i) => w[i] * f[i] * t[i]);
    const det = sw * sff - sf * sf;
    a = det !== 0 ? (st * sff - sf * sft) / det : 0;
    b = det !== 0 ? (sw * sft - sf * st) / det : 0;
    if (a < 0) {
      // No negative overhead: refit through the origin.
      a = 0;
      b = sft / sff;
    }
    if (b < 0) {
      // Shrinking with n: this class doesn't describe the data at all.
      b = 0;
      a = st / sw;
    }
  }
  const rel = n.map((_, i) => (a + b * f[i] - t[i]) / t[i]);
  return Math.sqrt(rel.reduce((acc, r) => acc + r * r, 0) / rel.length);
}

function logLogSlope(n: number[], t: number[]): number {
  const half = Math.max(2, Math.ceil(n.length / 2));
  const xs = n.slice(-half).map(Math.log);
  const ys = t.slice(-half).map(Math.log);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const num = xs.reduce((acc, x, i) => acc + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((acc, x) => acc + (x - mx) ** 2, 0);
  return den ? num / den : 0;
}

export function fitComplexity(raw: MeasuredPoint[]): ComplexityFit {
  const all = raw
    .filter((p) => p.ns.length > 0)
    .map((p) => ({ n: p.n, ns: Math.min(...p.ns) }))
    .sort((a, b) => a.n - b.n);
  const usable = all.filter((p) => p.ns >= NOISE_FLOOR_NS);

  if (all.length >= MIN_POINTS && usable.length < MIN_POINTS && all[all.length - 1].ns < NOISE_FLOOR_NS * 4) {
    // Every size ran in microseconds: nothing that grows linearly or faster does that up to
    // n = 2^17, but constant and logarithmic can't be told apart under timer noise.
    return { status: "inconclusive", reason: "too_fast", candidates: ["O(1)", "O(log n)"], points: all };
  }
  if (usable.length < MIN_POINTS || usable[usable.length - 1].n / usable[0].n < MIN_RANGE) {
    return { status: "inconclusive", reason: "too_few_sizes", candidates: [], points: all };
  }

  const n = usable.map((p) => p.n);
  const t = usable.map((p) => p.ns);
  const fits = CLASSES.map((cls) => ({ class: cls, error: round(fitClass(cls, n, t)) })).sort(
    (x, y) => x.error - y.error || CLASSES.indexOf(x.class) - CLASSES.indexOf(y.class)
  );
  const best = fits[0];
  const limit = Math.max(best.error * AMBIGUITY, best.error + AMBIGUITY_SLACK);
  const neighbourLimit = Math.max(best.error * LOG_NEIGHBOUR_AMBIGUITY, limit);
  const candidates = fits
    .filter((f) => f.error <= (f.class === LOG_NEIGHBOURS[best.class] ? neighbourLimit : limit))
    .map((f) => f.class)
    .sort((x, y) => CLASSES.indexOf(x) - CLASSES.indexOf(y));
  const confidence =
    candidates.length > 1 ? "low" : best.error <= 0.15 && usable.length >= 5 ? "high" : "medium";

  return {
    status: "measured",
    bestFit: best.class,
    candidates,
    confidence,
    fits,
    slope: round(logLogSlope(n, t)),
    points: all,
  };
}

const round = (x: number) => Math.round(x * 1000) / 1000;

// ── the AI reviewer's claim ──────────────────────────────────────────────────────────

const ORDER: ComplexityClass[] = [...CLASSES];

/**
 * Normalise a Big-O string from the reviewer to a class, or null when it names something
 * the measurement can't test (exponential, sqrt, n² log n) or isn't Big-O at all.
 * Every size argument grows with n in the measurement, so every variable reads as n:
 * "O(n·m)" is O(n²) and "O(V + E)" is O(n). A sum keeps its fastest-growing term.
 */
export function classifyClaim(text: string | null | undefined): ComplexityClass | null {
  if (!text) return null;
  const m = /O\s*\(/i.exec(text);
  if (!m) return null;
  // The parenthesised body, nested parens included.
  let depth = 0;
  let body = "";
  for (let i = m.index + m[0].length - 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth === 0) break;
    if (i > m.index + m[0].length - 1) body += ch;
  }
  const lower = body.toLowerCase();
  // Growth the measurement has no class for; checked before variables are renamed to n.
  if (/sqrt|√|!|\^\s*[a-z]|exp|polylog/.test(lower)) return null;
  let s = lower
    .replace(/[₀-₉]/g, "")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/log\s*_?\s*\d*\s*/g, "log")
    // A product's factors stay separate tokens: "n*m" is two variables, "amount" one.
    .replace(/[*·×⋅]/g, ".")
    .replace(/\s/g, "");
  s = s.replace(/log\(([a-z]+)\)/g, "log$1");
  // Every variable is n; keep "log".
  s = s.replace(/log/g, "#").replace(/[a-z]+/g, "n").replace(/#/g, "log");

  let worst = -1;
  for (const term of s.split("+").filter(Boolean)) {
    const cls = classifyTerm(term);
    if (cls === null) return null;
    worst = Math.max(worst, ORDER.indexOf(cls));
  }
  return worst >= 0 ? ORDER[worst] : null;
}

function classifyTerm(term: string): ComplexityClass | null {
  let rest = term.replace(/^\d+(\.\d+)?/, "").replace(/\(([^()]*)\)/g, "$1");
  if (rest === "" || rest === "1") return "O(1)";
  let logs = 0;
  rest = rest.replace(/logn/g, () => {
    logs++;
    return "";
  });
  let degree = 0;
  rest = rest.replace(/n\^(\d+)/g, (_m, k: string) => {
    degree += Number(k);
    return "";
  });
  rest = rest.replace(/n/g, () => {
    degree++;
    return "";
  });
  if (rest.replace(/[\d.]/g, "") !== "") return null;
  if (logs > 1) return null;
  if (degree === 0) return logs ? "O(log n)" : "O(1)";
  if (degree === 1) return logs ? "O(n log n)" : "O(n)";
  if (degree === 2) return logs ? null : "O(n²)";
  if (degree === 3) return logs ? null : "O(n³)";
  return null;
}

export type ClaimVerdict = "agrees" | "consistent" | "log_factor" | "disagrees" | "not_comparable";

/**
 * agrees: the measurement found exactly the claimed class. consistent: the claim is one of
 * several classes the data allows. log_factor: it differs from them only by a log factor (an
 * O(n log n) sort that measures as O(n) at these sizes, say). disagrees: anything else.
 * not_comparable: no parseable claim, or no measurement.
 */
export function compareClaim(fit: ComplexityFit, claimed: ComplexityClass | null): ClaimVerdict {
  if (!claimed || fit.candidates.length === 0) return "not_comparable";
  if (fit.candidates.includes(claimed)) return fit.candidates.length === 1 ? "agrees" : "consistent";
  if (fit.candidates.includes(LOG_NEIGHBOURS[claimed] as ComplexityClass)) return "log_factor";
  return "disagrees";
}
