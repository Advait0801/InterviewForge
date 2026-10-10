import { describe, it, expect } from "vitest";
import { generateCode } from "../harness-gen";
import { goMethodName, goSolutionFile } from "../harness-go";
import { generateRust, snakeCase } from "../harness-rust";
import { PROBLEM_META } from "../problem-meta";

const slugs = Object.keys(PROBLEM_META);

describe("generators cover every problem's signature", () => {
  it.each(["javascript", "go", "rust"] as const)("%s", (language) => {
    for (const slug of slugs) {
      expect(() => generateCode(language, "", PROBLEM_META[slug]), slug).not.toThrow();
    }
  });
});

describe("user code is placed so error line numbers match the editor", () => {
  const meta = PROBLEM_META["two-sum"];

  it("JavaScript and Rust put it first", () => {
    for (const language of ["javascript", "rust"] as const) {
      expect(generateCode(language, "LINE_ONE\nLINE_TWO", meta).code.startsWith("LINE_ONE\nLINE_TWO")).toBe(true);
    }
  });

  it("Go keeps it in its own file, with the package clause on line 1", () => {
    const g = generateCode("go", "func twoSum() {}\n", meta);
    expect(g.filename).toBe("main.go");
    expect(g.extraFiles).toEqual([{ name: "solution.go", content: "package main; func twoSum() {}\n" }]);
  });

  it("Go replaces the user's own package clause instead of adding a line", () => {
    expect(goSolutionFile("package solution\n\nfunc f() {}")).toBe("package main\n\nfunc f() {}");
    expect(goSolutionFile("// note\npackage foo\nfunc f() {}")).toBe("// note\npackage main\nfunc f() {}");
  });

  it("the user's code is copied verbatim, even with $& or $' in it", () => {
    const code = "var twoSum = function() { return 'a'.replace(/a/, \"$&$'\"); };";
    expect(generateCode("javascript", code, meta).code).toContain(code);
    expect(generateCode("python3", "x = '$&'", meta).code).toContain("x = '$&'");
  });
});

describe("names", () => {
  it.each([
    ["twoSum", "two_sum"],
    ["isValidBST", "is_valid_bst"],
    ["lowestCommonAncestor", "lowest_common_ancestor"],
    ["startsWith", "starts_with"],
    ["getMin", "get_min"],
    ["findMedianSortedArrays", "find_median_sorted_arrays"],
    ["numIslands", "num_islands"],
  ])("Rust: %s -> %s", (name, expected) => {
    expect(snakeCase(name)).toBe(expected);
  });

  it("Go exports design methods", () => {
    expect(goMethodName("insert")).toBe("Insert");
    expect(goMethodName("getMin")).toBe("GetMin");
  });

  it("every Rust method name is a valid identifier", () => {
    for (const meta of Object.values(PROBLEM_META)) {
      const names = meta.isDesign ? (meta.methods ?? []).map((m) => m.name) : [meta.methodName!];
      for (const n of names) expect(snakeCase(n)).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});

describe("Rust: every converter the generated code calls is defined", () => {
  // rustc isn't available to unit tests, so check the generated source instead: a
  // reader or writer referenced but never defined is a compile error for every user
  // of that problem (it happened: j_list, before verify_problems.py caught it).
  it.each(slugs)("%s", (slug) => {
    const code = generateRust("", PROBLEM_META[slug]);
    const called = new Set([...code.matchAll(/\b([jw]_[a-z0-9_]+)\(/g)].map((m) => m[1]));
    for (const fn of called) expect(code, `${slug}: ${fn}`).toMatch(new RegExp(`fn ${fn}\\b`));
  });
});
