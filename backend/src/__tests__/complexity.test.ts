import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  CLASSES,
  NOISE_FLOOR_NS,
  classifyClaim,
  compareClaim,
  fitComplexity,
  type ComplexityClass,
  type ComplexityFit,
  type MeasuredPoint,
} from "../services/complexity";

const sizes = Array.from({ length: 10 }, (_, i) => 256 * 2 ** i);
const curve = (f: (n: number) => number, noise = 0): MeasuredPoint[] =>
  sizes.map((n, i) => {
    const t = f(n);
    // Deterministic wobble, so a test never depends on Math.random.
    return { n, ns: [t * (1 + noise * Math.sin(i * 7.1)), t * (1 + noise), t * (1 + 2 * noise)] };
  });

const measured = (fit: ComplexityFit) => {
  if (fit.status !== "measured") throw new Error(`expected a measurement, got ${fit.status}`);
  return fit;
};

describe("fitComplexity on clean curves", () => {
  const cases: Array<[ComplexityClass, (n: number) => number]> = [
    ["O(n)", (n) => 40 * n + 5_000],
    ["O(n log n)", (n) => 40 * n * Math.log2(n) + 5_000],
    ["O(n²)", (n) => 0.5 * n * n + 5_000],
    ["O(n³)", (n) => 0.0005 * n ** 3 + 5_000],
  ];
  it.each(cases)("%s is the best fit", (cls, f) => {
    const fit = measured(fitComplexity(curve(f, 0.02)));
    expect(fit.bestFit).toBe(cls);
    expect(fit.candidates).toContain(cls);
  });

  it("separates n² from n and n log n outright", () => {
    const fit = measured(fitComplexity(curve((n) => 0.5 * n * n, 0.05)));
    expect(fit.candidates).toEqual(["O(n²)"]);
    expect(fit.confidence).toBe("high");
    expect(fit.slope).toBeGreaterThan(1.9);
  });

  it("uses the minimum of the repeats: one slow outlier changes nothing", () => {
    const clean = curve((n) => 40 * n + 5_000);
    const spiky = clean.map((p, i) => (i === 6 ? { ...p, ns: [...p.ns, p.ns[0] * 50] } : p));
    expect(measured(fitComplexity(spiky)).fits).toEqual(measured(fitComplexity(clean)).fits);
  });
});

describe("fitComplexity says when it can't tell", () => {
  it("everything in microseconds: O(1) or O(log n), not a guess between them", () => {
    const fit = fitComplexity(curve((n) => 300 + 20 * Math.log2(n)));
    expect(fit).toMatchObject({ status: "inconclusive", reason: "too_fast", candidates: ["O(1)", "O(log n)"] });
  });

  it("too few sizes above the noise floor", () => {
    const pts = sizes.slice(0, 3).map((n) => ({ n, ns: [n * 1000] }));
    expect(fitComplexity(pts)).toMatchObject({ status: "inconclusive", reason: "too_few_sizes", candidates: [] });
  });

  it("too narrow a range of n", () => {
    const pts = [1000, 1200, 1400, 1600, 1800].map((n) => ({ n, ns: [n * 1000] }));
    expect(fitComplexity(pts)).toMatchObject({ status: "inconclusive", reason: "too_few_sizes" });
  });

  it("ignores sizes under the noise floor rather than fitting noise", () => {
    const pts = curve((n) => 40 * n);
    pts[0] = { n: pts[0].n, ns: [NOISE_FLOOR_NS / 10] };
    expect(measured(fitComplexity(pts)).points[0].ns).toBe(NOISE_FLOOR_NS / 10);
    expect(measured(fitComplexity(pts)).bestFit).toBe("O(n)");
  });

});

describe("fitComplexity on real measurements (Phase 12 fixture)", () => {
  type Entry = { label: string; expected: ComplexityClass; measurement: { points: MeasuredPoint[]; stopped: string } };
  const fixture: Entry[] = JSON.parse(readFileSync(join(__dirname, "fixtures", "complexity-measurements.json"), "utf8"));

  it("covers every language and class it claims to", () => {
    expect(fixture.length).toBeGreaterThanOrEqual(25);
    expect(new Set(fixture.map((e) => e.expected))).toEqual(new Set(["O(log n)", "O(n)", "O(n log n)", "O(n²)"]));
  });

  it.each(fixture.map((e) => [e.label, e] as const))("%s: the expected class is never ruled out", (_label, e) => {
    expect(e.measurement.stopped).not.toBe("error");
    const fit = fitComplexity(e.measurement.points);
    expect(fit.candidates).toContain(e.expected);
  });

  it("every quadratic solution is identified exactly, in every language", () => {
    for (const e of fixture.filter((x) => x.expected === "O(n²)")) {
      expect(measured(fitComplexity(e.measurement.points)).candidates, e.label).toEqual(["O(n²)"]);
    }
  });

  it("keeps n and n log n together when memory effects match a log factor", () => {
    // A C++ unordered_map: linear in theory, but its cost per element grows once it
    // outgrows the caches; a 1.5x margin called it O(n log n) outright.
    const hash = fixture.find((e) => e.label === "cpp two-sum hash map")!;
    expect(measured(fitComplexity(hash.measurement.points)).candidates).toEqual(["O(n)", "O(n log n)"]);
  });

  it("names O(n log n) alone when the log factor is real work (Python merge sort)", () => {
    const merge = fixture.find((e) => e.label === "py merge sort")!;
    expect(measured(fitComplexity(merge.measurement.points)).candidates).toEqual(["O(n log n)"]);
  });

  it("never confuses linear-ish with quadratic", () => {
    for (const e of fixture.filter((x) => x.expected === "O(n)" || x.expected === "O(n log n)")) {
      const fit = fitComplexity(e.measurement.points);
      expect(fit.candidates.some((c) => c === "O(n²)" || c === "O(n³)"), e.label).toBe(false);
    }
  });
});

describe("classifyClaim", () => {
  const table: Array<[string | null, ComplexityClass | null]> = [
    ["O(n)", "O(n)"],
    ["O(N)", "O(n)"],
    ["O(n) time, O(1) space", "O(n)"],
    ["O(1)", "O(1)"],
    ["O(log n)", "O(log n)"],
    ["O(log(n))", "O(log n)"],
    ["O(n log n)", "O(n log n)"],
    ["O(nlogn)", "O(n log n)"],
    ["O(N*log(N))", "O(n log n)"],
    ["O(n log₂ n)", "O(n log n)"],
    ["O(n log k)", "O(n log n)"],
    ["O(n^2)", "O(n²)"],
    ["O(n²)", "O(n²)"],
    ["O(n * m)", "O(n²)"],
    ["O(m·n)", "O(n²)"],
    ["O(n³)", "O(n³)"],
    ["O(V + E)", "O(n)"],
    ["O(n + m)", "O(n)"],
    ["O(n + n log n)", "O(n log n)"],
    ["O(26n)", "O(n)"],
    ["O(amount)", "O(n)"],
    ["O(2^n)", null],
    ["O(n!)", null],
    ["O(sqrt(n))", null],
    ["O(n^2 log n)", null],
    ["linear", null],
    ["", null],
    [null, null],
  ];
  it.each(table)("%s -> %s", (text, cls) => {
    expect(classifyClaim(text)).toBe(cls);
  });
});

describe("compareClaim", () => {
  const fit = (candidates: ComplexityClass[]): ComplexityFit => ({
    status: "measured",
    bestFit: candidates[0],
    candidates,
    confidence: candidates.length > 1 ? "low" : "high",
    fits: [],
    slope: 1,
    points: [],
  });
  it("agrees only when the measurement found exactly the claimed class", () => {
    expect(compareClaim(fit(["O(n²)"]), "O(n²)")).toBe("agrees");
    expect(compareClaim(fit(["O(n)", "O(n log n)"]), "O(n)")).toBe("consistent");
  });
  it("names a log-factor difference separately from a real disagreement", () => {
    expect(compareClaim(fit(["O(n)"]), "O(n log n)")).toBe("log_factor");
    expect(compareClaim(fit(["O(n²)"]), "O(n)")).toBe("disagrees");
    expect(compareClaim(fit(["O(n)"]), "O(1)")).toBe("disagrees");
  });
  it("is not comparable without a claim or a measurement", () => {
    expect(compareClaim(fit(["O(n)"]), null)).toBe("not_comparable");
    expect(compareClaim({ status: "inconclusive", reason: "too_few_sizes", candidates: [], points: [] }, "O(n)")).toBe(
      "not_comparable"
    );
    expect(compareClaim({ status: "inconclusive", reason: "too_fast", candidates: ["O(1)", "O(log n)"], points: [] }, "O(log n)")).toBe(
      "consistent"
    );
  });
  it("covers every class", () => {
    for (const c of CLASSES) expect(compareClaim(fit([c]), c)).toBe("agrees");
  });
});
