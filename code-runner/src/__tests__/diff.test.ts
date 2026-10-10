import { describe, it, expect } from "vitest";
import { diffOutputs } from "../diff";
import { compareOutputs } from "../input-parser";

describe("diffOutputs", () => {
  it("is undefined when the outputs match", () => {
    expect(diffOutputs("[1,2,3]", "[1, 2, 3]")).toBeUndefined();
    expect(diffOutputs("2.50000", "2.5")).toBeUndefined();
  });

  it("points at the first differing element", () => {
    expect(diffOutputs("[1,9,3,8]", "[1,2,3,4]")).toEqual({ kind: "value", path: [1], expected: 2, actual: 9 });
  });

  it("descends into nested arrays", () => {
    expect(diffOutputs("[[1,2],[3,5]]", "[[1,2],[3,4]]")).toEqual({ kind: "value", path: [1, 1], expected: 4, actual: 5 });
  });

  it("reports a length difference once every shared element matched", () => {
    expect(diffOutputs("[1,2]", "[1,2,3]")).toEqual({ kind: "length", path: [], expectedLength: 3, actualLength: 2 });
    expect(diffOutputs("[[1],[2,3,4]]", "[[1],[2,3]]")).toEqual({ kind: "length", path: [1], expectedLength: 2, actualLength: 3 });
  });

  it("marks the first differing character of two strings", () => {
    expect(diffOutputs('"abxd"', '"abcd"')).toEqual({ kind: "value", path: [], expected: "abcd", actual: "abxd", charIndex: 2 });
    expect(diffOutputs('"ab"', '"abc"')).toMatchObject({ charIndex: 2 });
  });

  it("reports a type mismatch", () => {
    expect(diffOutputs("null", "[1]")).toEqual({ kind: "type", path: [], expectedType: "array", actualType: "null" });
    expect(diffOutputs('["1"]', "[1]")).toEqual({ kind: "type", path: [0], expectedType: "number", actualType: "string" });
  });

  it("calls output that isn't JSON a format problem", () => {
    expect(diffOutputs("debug: 3", "3")).toEqual({ kind: "format" });
  });

  it("applies the float tolerance only at the top level, like compareOutputs", () => {
    expect(diffOutputs("1.00001", "1.0")).toBeUndefined();
    expect(diffOutputs("[1.00001]", "[1.0]")).toMatchObject({ kind: "value", path: [0] });
  });

  it("a design problem's output points at the operation", () => {
    expect(diffOutputs("[null,null,1,-1]", "[null,null,1,2]")).toEqual({ kind: "value", path: [3], expected: 2, actual: -1 });
  });

  describe("order-independent outputs", () => {
    it("lists what's missing and what's unexpected, counting duplicates", () => {
      expect(diffOutputs("[1,1,3]", "[3,1,2]", true)).toEqual({
        kind: "items",
        missing: [2],
        unexpected: [1],
        expectedLength: 3,
        actualLength: 3,
      });
    });

    it("ignores order inside items only when unorderedInner says so", () => {
      expect(diffOutputs("[[2,1]]", "[[1,2]]", true, true)).toBeUndefined();
      expect(diffOutputs("[[2,1]]", "[[1,2]]", true, false)).toMatchObject({ kind: "items", missing: [[1, 2]], unexpected: [[2, 1]] });
    });

    it("caps the lists at 10", () => {
      const expected = JSON.stringify(Array.from({ length: 30 }, (_, i) => i));
      const d = diffOutputs("[]", expected, true);
      expect(d).toMatchObject({ kind: "items", expectedLength: 30, actualLength: 0 });
      expect((d as { missing: unknown[] }).missing).toHaveLength(10);
    });
  });

  it("exists exactly when compareOutputs says the case failed", () => {
    const pairs: Array<[string, string, boolean, boolean]> = [
      ["[1,2]", "[2,1]", true, false],
      ["[1,2]", "[2,1]", false, false],
      ["[[1,2],[3]]", "[[3],[2,1]]", true, true],
      ["[[1,2],[3]]", "[[3],[2,1]]", true, false],
      ["3.00009", "3", false, false],
      ["3.0002", "3", false, false],
      ['"a"', '"a"', false, false],
      ["true", "false", false, false],
      ["[]", "[[]]", true, false],
      ["x", "x", false, false],
    ];
    for (const [a, e, u, ui] of pairs) {
      expect(diffOutputs(a, e, u, ui) === undefined).toBe(compareOutputs(a, e, u, ui));
    }
  });
});
