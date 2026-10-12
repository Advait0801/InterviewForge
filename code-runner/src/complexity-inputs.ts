/**
 * Inputs that grow with n, for measuring a solution's time complexity (Phase 12).
 *
 * Curated, not derived from signatures: a random array is a valid input for few problems,
 * and a valid one is often the *easy* case -- a two-sum whose pair sits at the front, a
 * palindrome count on random letters. Each generator below builds a valid input that
 * makes a correct solution do its full work at every size: the answer planted last,
 * strings that are all one letter, values small enough that Python's integers never grow
 * (a product of n random ints would make the arithmetic, not the algorithm, dominate).
 *
 * Every size argument scales with n together (both strings of an edit distance, k = n/2
 * for a k-th largest), so "O(n·m)" and "O(n log k)" mean O(n²) and O(n log n) here.
 *
 * Deterministic: a seeded generator, so a measurement can be repeated exactly.
 */

export type Rng = () => number;

/** mulberry32: small, fast, and good enough to make inputs unremarkable. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const ints = (rng: Rng, n: number, lo: number, hi: number) => Array.from({ length: n }, () => int(rng, lo, hi));
const letters = (rng: Rng, n: number, alphabet: string) =>
  Array.from({ length: n }, () => alphabet[Math.floor(rng() * alphabet.length)]).join("");

function shuffle<T>(rng: Rng, xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}

/** Distinct sorted values with gaps, so an absent target is easy to choose. */
const sortedDistinct = (rng: Rng, n: number) => {
  const out: number[] = [];
  let v = -4 * n;
  for (let i = 0; i < n; i++) out.push((v += int(rng, 1, 3) * 2));
  return out;
};

const args = (pairs: Array<[string, unknown]>) => pairs.map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join(", ");

export type ComplexitySpec = {
  /** Smallest and largest n. The run stops early at its time limit, keeping what finished. */
  minN: number;
  maxN: number;
  build: (n: number, rng: Rng) => string;
};

const LINEAR = { minN: 256, maxN: 131_072 };
const QUADRATIC = { minN: 64, maxN: 8_192 };

export const COMPLEXITY_SPECS: Record<string, ComplexitySpec> = {
  // ── searches on sorted input: the target is absent, so the search runs to the end ──
  "binary-search": { ...LINEAR, build: (n, r) => { const a = sortedDistinct(r, n); return args([["nums", a], ["target", a[n - 1] + 1]]); } },
  "search-insert-position": { ...LINEAR, build: (n, r) => { const a = sortedDistinct(r, n); return args([["nums", a], ["target", a[Math.floor(n / 3)] + 1]]); } },
  "search-in-rotated-sorted-array": {
    ...LINEAR,
    build: (n, r) => {
      const a = sortedDistinct(r, n);
      const k = int(r, 1, n - 1);
      return args([["nums", [...a.slice(k), ...a.slice(0, k)]], ["target", a[0] + 1]]);
    },
  },
  "find-minimum-in-rotated-sorted-array": {
    ...LINEAR,
    build: (n, r) => { const a = sortedDistinct(r, n); const k = int(r, 1, n - 1); return args([["nums", [...a.slice(k), ...a.slice(0, k)]]]); },
  },

  // ── one pass ──
  "two-sum": {
    ...LINEAR,
    // The only pair is the last two values: anything smaller can't reach the target.
    build: (n, r) => args([["nums", [...ints(r, n - 2, 1, 100_000_000), 1_000_000_001, 1_000_000_003]], ["target", 2_000_000_004]]),
  },
  "best-time-to-buy-and-sell-stock": { ...LINEAR, build: (n, r) => args([["prices", ints(r, n, 0, 10_000)]]) },
  "maximum-subarray": { ...LINEAR, build: (n, r) => args([["nums", ints(r, n, -10_000, 10_000)]]) },
  "missing-number": {
    ...LINEAR,
    build: (n, r) => { const a = shuffle(r, Array.from({ length: n + 1 }, (_, i) => i)); a.splice(int(r, 0, n), 1); return args([["nums", a]]); },
  },
  "contains-duplicate": { ...LINEAR, build: (n, r) => args([["nums", shuffle(r, Array.from({ length: n }, (_, i) => i * 3))]]) },
  "single-number": {
    ...LINEAR,
    build: (n, r) => { const half = Math.floor(n / 2); const a = Array.from({ length: half }, (_, i) => i + 1); return args([["nums", shuffle(r, [...a, ...a, -1])]]); },
  },
  "majority-element": {
    ...LINEAR,
    build: (n, r) => { const m = Math.floor(n / 2) + 1; return args([["nums", shuffle(r, [...Array(m).fill(7), ...ints(r, n - m, 8, 1_000_000)])]]); },
  },
  // ±1 only: products of n ints would otherwise turn into Python big-integer arithmetic.
  "product-of-array-except-self": { ...LINEAR, build: (n, r) => args([["nums", ints(r, n, 0, 1).map((x) => (x ? 1 : -1))]]) },
  "move-zeroes": { ...LINEAR, build: (n, r) => args([["nums", ints(r, n, 0, 3)]]) },
  "container-with-most-water": { ...LINEAR, build: (n, r) => args([["height", ints(r, n, 0, 10_000)]]) },
  "trapping-rain-water": { ...LINEAR, build: (n, r) => args([["height", ints(r, n, 0, 10_000)]]) },
  "daily-temperatures": { ...LINEAR, build: (n, r) => args([["temperatures", ints(r, n, 30, 100)]]) },
  "house-robber": { ...LINEAR, build: (n, r) => args([["nums", ints(r, n, 0, 400)]]) },
  "jump-game": { ...LINEAR, build: (n) => args([["nums", Array(n).fill(1)]]) },
  "valid-anagram": {
    ...LINEAR,
    build: (n, r) => { const s = letters(r, n, "abcdefghijklmnopqrstuvwxyz"); return args([["s", s], ["t", shuffle(r, s.split("")).join("")]]); },
  },
  "longest-substring-without-repeating-characters": { ...LINEAR, build: (n, r) => args([["s", letters(r, n, "abcdefghijklmnopqrstuvwxyz")]]) },
  "longest-consecutive-sequence": { ...LINEAR, build: (n, r) => args([["nums", shuffle(r, Array.from({ length: n }, (_, i) => i * 2))]]) },

  // ── sorting-shaped ──
  "merge-intervals": {
    ...LINEAR,
    build: (n, r) => args([["intervals", Array.from({ length: n }, () => { const s = int(r, 0, 10 * n); return [s, s + int(r, 1, 4)]; })]]),
  },
  "non-overlapping-intervals": {
    ...LINEAR,
    build: (n, r) => args([["intervals", Array.from({ length: n }, () => { const s = int(r, 0, 10 * n); return [s, s + int(r, 1, 30)]; })]]),
  },
  "longest-increasing-subsequence": { ...LINEAR, build: (n, r) => args([["nums", ints(r, n, -10_000, 10_000)]]) },
  "kth-largest-element-in-an-array": { ...LINEAR, build: (n, r) => args([["nums", ints(r, n, -10_000, 10_000)], ["k", Math.max(1, Math.floor(n / 2))]]) },
  "sort-colors": { ...LINEAR, build: (n, r) => args([["nums", ints(r, n, 0, 2)]]) },

  // ── quadratic ──
  // Values from a narrow range: many triples sum to zero, so the two-pointer scan never short-cuts.
  "3sum": { ...QUADRATIC, build: (n, r) => args([["nums", ints(r, n, -n, n)]]) },
  // One letter: every substring is a palindrome, the worst case for expanding around centres.
  "palindromic-substrings": { ...QUADRATIC, build: (n) => args([["s", "a".repeat(n)]]) },
  "longest-common-subsequence": { ...QUADRATIC, maxN: 4_096, build: (n, r) => args([["text1", letters(r, n, "abc")], ["text2", letters(r, n, "abc")]]) },
  "edit-distance": { ...QUADRATIC, maxN: 4_096, build: (n, r) => args([["word1", letters(r, n, "abc")], ["word2", letters(r, n, "abc")]]) },
};

/** Sizes doubling from minN to maxN. */
export function sizesFor(spec: ComplexitySpec): number[] {
  const out: number[] = [];
  for (let n = spec.minN; n <= spec.maxN; n *= 2) out.push(n);
  return out;
}

export const REPEATS = 3;
export const WARMUPS = 5;

export type PlannedCase = { n: number; input: string; warmup: boolean };

/**
 * Warm-ups first (a JIT's first calls run interpreted and would make small sizes look
 * slow), then each size REPEATS times with a fresh input, smallest first: a run cut off by
 * its time limit loses only the largest sizes.
 */
export function planCases(slug: string, seed = 12): PlannedCase[] {
  const spec = COMPLEXITY_SPECS[slug];
  if (!spec) throw new Error(`No complexity inputs for "${slug}"`);
  const rng = seededRng(seed);
  const cases: PlannedCase[] = [];
  for (let i = 0; i < WARMUPS; i++) cases.push({ n: spec.minN, input: spec.build(spec.minN, rng), warmup: true });
  for (const n of sizesFor(spec)) {
    for (let k = 0; k < REPEATS; k++) cases.push({ n, input: spec.build(n, rng), warmup: false });
  }
  return cases;
}
