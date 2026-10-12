import { describe, it, expect } from "vitest";
import { generateCode, timingSupported, TIMING_PREFIX } from "../harness-gen";
import { PROBLEM_META } from "../problem-meta";
import { SUPPORTED_LANGUAGES } from "../types";
import { validateInput } from "../validate-input";
import { COMPLEXITY_SPECS, planCases, seededRng, sizesFor, REPEATS, WARMUPS } from "../complexity-inputs";
import { complexitySupported, measureComplexity, parseTimedOutput, supportedSlugs } from "../complexity";
import { replaceOnce, wrapCallLine } from "../timing";

const timedSlugs = Object.keys(PROBLEM_META).filter((s) => timingSupported(PROBLEM_META[s]));

describe("timing mode", () => {
  it("generates for every supported problem in every language", () => {
    for (const slug of timedSlugs) {
      for (const language of SUPPORTED_LANGUAGES) {
        const g = generateCode(language, "/*USER*/", PROBLEM_META[slug], { timing: true });
        expect(g.code.includes(TIMING_PREFIX), `${slug} ${language}`).toBe(true);
      }
    }
  });

  it("is off unless asked for: normal code has no timing at all", () => {
    for (const slug of timedSlugs) {
      for (const language of SUPPORTED_LANGUAGES) {
        expect(generateCode(language, "/*USER*/", PROBLEM_META[slug]).code.includes(TIMING_PREFIX)).toBe(false);
      }
    }
  });

  it("only adds to the normal harness: at most two of its lines change", () => {
    // Timing inserts lines around the call; Go rewrites `return write(f(x))` as two steps
    // and JavaScript swaps its output buffer for a per-case write.
    for (const slug of timedSlugs) {
      for (const language of SUPPORTED_LANGUAGES) {
        const plain = generateCode(language, "/*USER*/", PROBLEM_META[slug]).code.split("\n");
        const timed = new Set(generateCode(language, "/*USER*/", PROBLEM_META[slug], { timing: true }).code.split("\n"));
        const changed = plain.filter((line) => !timed.has(line));
        expect(changed.length, `${slug} ${language}: ${changed.join(" | ")}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it("refuses design classes and the cycle and LCA special cases", () => {
    for (const slug of ["lru-cache", "linked-list-cycle", "lowest-common-ancestor-of-a-binary-search-tree"]) {
      expect(timingSupported(PROBLEM_META[slug])).toBe(false);
      expect(() => generateCode("python3", "", PROBLEM_META[slug], { timing: true })).toThrow(/isn't supported/);
    }
  });

  it("times the call alone in Python: after the arguments, before the output", () => {
    const code = generateCode("python3", "", PROBLEM_META["two-sum"], { timing: true }).code;
    const start = code.indexOf("_if_t0 = ");
    expect(code.indexOf("_convert_arg(a, t)")).toBeLessThan(start);
    expect(code.indexOf("result = fn(*converted)")).toBeGreaterThan(start);
    expect(code.indexOf(TIMING_PREFIX, start)).toBeLessThan(code.indexOf("if return_type == \"void\"", start));
  });

  it("flushes every case in the compiled languages", () => {
    const meta = PROBLEM_META["two-sum"];
    expect(generateCode("cpp", "", meta, { timing: true }).code).toContain("cout.flush();");
    expect(generateCode("c", "", meta, { timing: true }).code).toContain("fflush(stdout);");
    expect(generateCode("java", "", meta, { timing: true }).code).toContain("System.out.flush();");
    expect(generateCode("go", "", meta, { timing: true }).code).toContain("out.Flush()");
    expect(generateCode("rust", "", meta, { timing: true }).code).toContain(
      `if t != u64::MAX { writeln!(out, "${TIMING_PREFIX} {}", t).ok(); }\n                out.flush().ok();`
    );
  });

  it("helpers fail loudly rather than skip timing", () => {
    expect(() => replaceOnce("a a", "a", "b")).toThrow();
    expect(() => replaceOnce("abc", "x", "b")).toThrow();
    expect(() => wrapCallLine("f(1)\nf(2)", "f(", "start", "stop")).toThrow();
    expect(wrapCallLine("  x\n  y = f(1)\n  z", "f(", "start", "stop")).toBe("  x\n  start\n  y = f(1)\n  stop\n  z");
  });
});

describe("C reads an input line of any length", () => {
  it("has no fixed-size line buffer left for collection arguments", () => {
    for (const slug of Object.keys(PROBLEM_META)) {
      const code = generateCode("c", "", PROBLEM_META[slug]).code;
      expect(code, slug).not.toMatch(/char _buf_\w+\[(4096|8192)\]/);
      expect(code, slug).not.toContain("malloc(4096)");
    }
  });
});

describe("complexity inputs", () => {
  it("every curated problem exists, is timeable, and its inputs pass the problem's own validator", () => {
    for (const [slug, spec] of Object.entries(COMPLEXITY_SPECS)) {
      const meta = PROBLEM_META[slug];
      expect(meta, slug).toBeDefined();
      expect(timingSupported(meta), slug).toBe(true);
      const rng = seededRng(1);
      for (const n of [spec.minN, spec.minN * 2]) {
        expect(validateInput(spec.build(n, rng), meta), `${slug} n=${n}`).toBeNull();
      }
    }
    expect(supportedSlugs()).toEqual(Object.keys(COMPLEXITY_SPECS).sort());
  });

  it("are deterministic", () => {
    expect(planCases("two-sum")).toEqual(planCases("two-sum"));
    expect(planCases("two-sum", 1)).not.toEqual(planCases("two-sum", 2));
  });

  it("run warm-ups first, then every size smallest first, REPEATS times each", () => {
    const cases = planCases("merge-intervals");
    const sizes = sizesFor(COMPLEXITY_SPECS["merge-intervals"]);
    expect(cases.slice(0, WARMUPS).every((c) => c.warmup)).toBe(true);
    expect(cases.slice(WARMUPS).map((c) => c.n)).toEqual(sizes.flatMap((n) => Array(REPEATS).fill(n)));
    expect(sizes[0]).toBe(256);
    expect(sizes[sizes.length - 1]).toBe(131_072);
  });

  it("plant two-sum's only pair last, so a solution can't stop early", () => {
    const input = COMPLEXITY_SPECS["two-sum"].build(1000, seededRng(3));
    const nums: number[] = JSON.parse(input.slice(input.indexOf("["), input.indexOf("]") + 1));
    const target = Number(input.split("target = ")[1]);
    const pairs: Array<[number, number]> = [];
    const seen = new Map<number, number>();
    nums.forEach((v, i) => {
      if (seen.has(target - v)) pairs.push([seen.get(target - v)!, i]);
      seen.set(v, i);
    });
    expect(pairs).toEqual([[998, 999]]);
  });

  it("keep the products in product-of-array-except-self small", () => {
    const input = COMPLEXITY_SPECS["product-of-array-except-self"].build(500, seededRng(4));
    expect(new Set(JSON.parse(input.slice(input.indexOf("["))))).toEqual(new Set([1, -1]));
  });
});

describe("parseTimedOutput", () => {
  const cases = [
    { n: 8, input: "", warmup: true },
    { n: 8, input: "", warmup: false },
    { n: 8, input: "", warmup: false },
    { n: 16, input: "", warmup: false },
    { n: 16, input: "", warmup: false },
  ];

  it("pairs results with timings in either order and drops warm-ups", () => {
    const before = `${TIMING_PREFIX} 5\n1\n${TIMING_PREFIX} 10\n2\n${TIMING_PREFIX} 12\n3\n${TIMING_PREFIX} 20\n4\n${TIMING_PREFIX} 22\n5\n`;
    const after = `1\n${TIMING_PREFIX} 5\n2\n${TIMING_PREFIX} 10\n3\n${TIMING_PREFIX} 12\n4\n${TIMING_PREFIX} 20\n5\n${TIMING_PREFIX} 22\n`;
    for (const out of [before, after]) {
      expect(parseTimedOutput(out, cases).points).toEqual([
        { n: 8, ns: [10, 12] },
        { n: 16, ns: [20, 22] },
      ]);
    }
  });

  it("keeps the sizes that finished before a timeout, and drops a size with one repeat", () => {
    const cut = `1\n${TIMING_PREFIX} 5\n2\n${TIMING_PREFIX} 10\n3\n${TIMING_PREFIX} 12\n4\n${TIMING_PREFIX} 20\n`;
    expect(parseTimedOutput(cut, cases)).toMatchObject({ points: [{ n: 8, ns: [10, 12] }], failed: false });
  });

  it("stops at the first case that threw, and says at which size", () => {
    const out = `1\n${TIMING_PREFIX} 5\n2\n${TIMING_PREFIX} 10\n3\n${TIMING_PREFIX} 12\n{"__error": "index out of range"}\n`;
    expect(parseTimedOutput(out, cases)).toMatchObject({
      points: [{ n: 8, ns: [10, 12] }],
      failed: true,
      error: "index out of range",
      errorAtN: 16,
    });
  });

  it("refuses output it can't pair: the program printed lines of its own", () => {
    const noisy = "debug\n".repeat(10);
    expect(parseTimedOutput(noisy, cases)).toMatchObject({ points: [], failed: true });
  });
});

describe("measureComplexity", () => {
  const fake = (output: string, timedOut = false, statusCode: number | null = 0) => async () => ({ output, timedOut, statusCode, elapsedMs: 5 });

  it("rejects a problem without curated inputs", async () => {
    expect(complexitySupported("lru-cache")).toBe(false);
    await expect(measureComplexity({ language: "python3", code: "", slug: "lru-cache" })).rejects.toThrow(/isn't available/);
  });

  it("reports a compile error as an error, not as no data", async () => {
    const r = await measureComplexity({ language: "cpp", code: "", slug: "two-sum" }, fake("error: expected ';'", false, 1));
    expect(r).toMatchObject({ stopped: "error", points: [] });
    expect(r.error).toContain("expected ';'");
  });

  it("marks a run cut by its limit as time_limit, with what finished", async () => {
    const lines = planCases("two-sum")
      .slice(0, WARMUPS + 6)
      .map(() => `[0,1]\n${TIMING_PREFIX} 1000`)
      .join("\n");
    const r = await measureComplexity({ language: "python3", code: "", slug: "two-sum" }, fake(lines, true, null));
    expect(r.stopped).toBe("time_limit");
    expect(r.points.map((p) => p.n)).toEqual([256, 512]);
  });
});
