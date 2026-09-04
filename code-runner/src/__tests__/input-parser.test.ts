import { describe, it, expect } from "vitest";
import { compareOutputs, normalizeOutput, parseTestInput } from "../input-parser";
import type { ProblemMeta } from "../problem-meta";

const meta = (over: Partial<ProblemMeta> = {}): ProblemMeta =>
  ({
    methodName: "solve",
    params: [{ name: "nums", type: "int[]" }],
    returnType: "int",
    isDesign: false,
    ...over,
  }) as ProblemMeta;

describe("normalizeOutput", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeOutput("  42  ")).toBe("42");
  });

  it("canonicalises JSON spacing", () => {
    expect(normalizeOutput("[1,  2,   3]")).toBe("[1,2,3]");
  });

  it("leaves non-JSON text as-is", () => {
    expect(normalizeOutput("  hello world ")).toBe("hello world");
  });
});

describe("compareOutputs — exact and structural", () => {
  it("matches identical scalars", () => {
    expect(compareOutputs("42", "42")).toBe(true);
  });

  it("matches arrays that differ only in whitespace", () => {
    expect(compareOutputs("[1, 2, 3]", "[1,2,3]")).toBe(true);
  });

  it("matches nested structures regardless of spacing", () => {
    expect(compareOutputs('[[1,2],  [3,4]]', "[[1,2],[3,4]]")).toBe(true);
  });

  it("rejects a genuinely different value", () => {
    expect(compareOutputs("42", "43")).toBe(false);
  });

  it("rejects arrays of different length", () => {
    expect(compareOutputs("[1,2]", "[1,2,3]")).toBe(false);
  });

  it("respects order for ordered comparison", () => {
    expect(compareOutputs("[2,1]", "[1,2]")).toBe(false);
  });
});

describe("compareOutputs — float tolerance", () => {
  it("accepts a difference below 1e-4", () => {
    expect(compareOutputs("3.14159", "3.141595")).toBe(true);
  });

  it("rejects a difference above 1e-4", () => {
    expect(compareOutputs("3.14159", "3.14179")).toBe(false);
  });

  it("treats an integer and its float form as equal", () => {
    expect(compareOutputs("2", "2.0")).toBe(true);
  });

  it("does not apply tolerance to numbers inside arrays", () => {
    // Documents current behaviour: array comparison is exact JSON equality,
    // so per-element float tolerance does NOT apply.
    expect(compareOutputs("[3.14159]", "[3.141595]")).toBe(false);
  });
});

describe("compareOutputs — unordered mode", () => {
  it("ignores order when unordered is set", () => {
    expect(compareOutputs("[3,1,2]", "[1,2,3]", true)).toBe(true);
  });

  it("still rejects differing contents", () => {
    expect(compareOutputs("[1,2,4]", "[1,2,3]", true)).toBe(false);
  });

  it("still rejects differing lengths", () => {
    expect(compareOutputs("[1,2]", "[1,2,3]", true)).toBe(false);
  });

  it("sorts nested arrays internally", () => {
    expect(compareOutputs("[[2,1],[4,3]]", "[[1,2],[3,4]]", true)).toBe(true);
  });

  it("does not ignore order unless asked", () => {
    expect(compareOutputs("[3,1,2]", "[1,2,3]")).toBe(false);
  });
});

describe("compareOutputs — booleans and strings", () => {
  it("matches booleans", () => {
    expect(compareOutputs("true", "true")).toBe(true);
    expect(compareOutputs("true", "false")).toBe(false);
  });

  it("matches plain strings", () => {
    expect(compareOutputs("hello", "hello")).toBe(true);
    expect(compareOutputs("hello", "world")).toBe(false);
  });

  it("does not treat the string 'true' as the boolean true", () => {
    expect(compareOutputs('"true"', "true")).toBe(false);
  });
});

describe("parseTestInput — regular problems", () => {
  it("parses a single named parameter", () => {
    const parsed = parseTestInput("nums = [2, 7, 11, 15]", meta());
    expect(parsed.isDesign).toBe(false);
    expect(parsed.args).toEqual([[2, 7, 11, 15]]);
  });

  it("parses a bare value with no name", () => {
    expect(parseTestInput("[1,2,3]", meta()).args).toEqual([[1, 2, 3]]);
  });

  it("parses multiple named parameters in declaration order", () => {
    const m = meta({
      params: [
        { name: "nums", type: "int[]" },
        { name: "target", type: "int" },
      ],
    });
    expect(parseTestInput("nums = [2,7,11,15], target = 9", m).args).toEqual([
      [2, 7, 11, 15],
      9,
    ]);
  });

  it("does not split on commas inside an array", () => {
    const m = meta({
      params: [
        { name: "grid", type: "int[][]" },
        { name: "k", type: "int" },
      ],
    });
    expect(parseTestInput("grid = [[1,2],[3,4]], k = 2", m).args).toEqual([
      [[1, 2],[3, 4]],
      2,
    ]);
  });

  it("does not split on commas inside a quoted string", () => {
    const m = meta({
      params: [
        { name: "s", type: "string" },
        { name: "n", type: "int" },
      ],
    });
    expect(parseTestInput('s = "a,b,c", n = 3', m).args).toEqual(["a,b,c", 3]);
  });

  it("fills missing parameters with null rather than shifting positions", () => {
    const m = meta({
      params: [
        { name: "a", type: "int" },
        { name: "b", type: "int" },
      ],
    });
    expect(parseTestInput("b = 5", m).args).toEqual([null, 5]);
  });
});

describe("parseTestInput — design problems", () => {
  it("parses operations and their arguments", () => {
    const parsed = parseTestInput(
      '["Trie","insert","search"]\n[[],["apple"],["apple"]]',
      meta({ isDesign: true })
    );
    expect(parsed.isDesign).toBe(true);
    expect(parsed.ops).toEqual(["Trie", "insert", "search"]);
    expect(parsed.opArgs).toEqual([[], ["apple"], ["apple"]]);
  });

  it("defaults to empty args when only operations are given", () => {
    const parsed = parseTestInput('["Trie","insert"]', meta({ isDesign: true }));
    expect(parsed.ops).toEqual(["Trie", "insert"]);
    expect(parsed.opArgs).toEqual([[], []]);
  });
});
