import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { validateInput } from "../validate-input";
import { PROBLEM_META } from "../problem-meta";

const meta = (slug: string) => PROBLEM_META[slug];

describe("validateInput: regular problems", () => {
  it("accepts the examples' format", () => {
    expect(validateInput("nums = [2, 7, 11, 15], target = 9", meta("two-sum"))).toBeNull();
    expect(validateInput("target = 9, nums = [2, 7]", meta("two-sum"))).toBeNull();
  });

  it("allows a single parameter without its name", () => {
    expect(validateInput('["h", "e"]', meta("reverse-string"))).toBeNull();
    expect(validateInput('s = ["h", "e"]', meta("reverse-string"))).toBeNull();
  });

  it.each([
    ["a missing parameter", "nums = [1, 2]", /Missing target/],
    ["an unknown parameter", "nums = [1, 2], goal = 3", /Unknown parameter "goal"/],
    ["a repeated parameter", "nums = [1], nums = [2], target = 3", /given twice/],
    ["a wrong type", 'nums = [1, 2], target = "3"', /target should be an integer/],
    ["a float where an int is expected", "nums = [1.5, 2], target = 3", /nums should be an array of integers/],
    ["an int out of 32-bit range", "nums = [1, 2], target = 3000000000", /target should be an integer/],
    ["invalid JSON", "nums = [1, 2, target = 3", /nums isn't valid|Missing/],
    ["no names at all", "[1, 2], 3", /name = value/],
    ["empty input", "   ", /empty/],
  ])("rejects %s", (_label, input, message) => {
    expect(validateInput(input, meta("two-sum"))).toMatch(message);
  });

  it("checks chars are one character", () => {
    expect(validateInput('["ab", "c"]', meta("reverse-string"))).toMatch(/one-character/);
  });

  it("checks tree arrays: integers and nulls, not starting with null", () => {
    expect(validateInput("root = [1, null, 2]", meta("maximum-depth-of-binary-tree"))).toBeNull();
    expect(validateInput("root = []", meta("maximum-depth-of-binary-tree"))).toBeNull();
    expect(validateInput("root = [null, 1]", meta("maximum-depth-of-binary-tree"))).toMatch(/level-order/);
    expect(validateInput('root = [1, "x"]', meta("maximum-depth-of-binary-tree"))).toMatch(/level-order/);
  });

  it("requires LCA's p and q to be in the tree, since they become node references", () => {
    const lca = meta("lowest-common-ancestor-of-a-binary-search-tree");
    expect(validateInput("root = [6, 2, 8], p = 2, q = 8", lca)).toBeNull();
    expect(validateInput("root = [6, 2, 8], p = 2, q = 9", lca)).toMatch(/q must be a value in the tree/);
  });

  it("requires linked-list-cycle's pos to be -1 or an index", () => {
    const cycle = meta("linked-list-cycle");
    expect(validateInput("head = [3, 2, 0], pos = -1", cycle)).toBeNull();
    expect(validateInput("head = [3, 2, 0], pos = 2", cycle)).toBeNull();
    expect(validateInput("head = [3, 2, 0], pos = 3", cycle)).toMatch(/pos must be/);
  });
});

describe("validateInput: design problems", () => {
  const lru = meta("lru-cache");

  it("accepts ops and args", () => {
    expect(validateInput('["LRUCache", "put", "get"]\n[[2], [1, 1], [1]]', lru)).toBeNull();
  });

  it.each([
    ["one line", '["LRUCache", "put"]', /Two lines/],
    ["the wrong class first", '["Cache", "put"]\n[[2], [1, 1]]', /first operation must be "LRUCache"/],
    ["mismatched lengths", '["LRUCache", "put"]\n[[2]]', /2 operations but 1/],
    ["an unknown method", '["LRUCache", "delete"]\n[[2], [1]]', /"delete" isn't a method/],
    ["a wrong argument count", '["LRUCache", "put"]\n[[2], [1]]', /takes 2 arguments/],
    ["a wrong constructor", '["LRUCache", "get"]\n[[], [1]]', /LRUCache takes capacity/],
    ["a wrong argument type", '["LRUCache", "get"]\n[[2], ["1"]]', /key should be an integer/],
  ])("rejects %s", (_label, input, message) => {
    expect(validateInput(input, lru)).toMatch(message);
  });

  it("accepts a bare collection argument and a bare lone scalar (Codec)", () => {
    const codec = meta("serialize-and-deserialize-binary-tree");
    expect(validateInput('["Codec", "serialize", "deserialize"]\n[[], [1, 2, null, 3], "[1, 2]"]', codec)).toBeNull();
  });
});

// Every case the problems already have must count as valid input, or a user copying an
// example into a custom case would be told it's wrong. Reads the backend's data file.
const PROBLEMS_JSON = join(__dirname, "..", "..", "..", "backend", "leetcode_problems.json");

describe.runIf(existsSync(PROBLEMS_JSON))("every existing test case is valid input", () => {
  const problems = JSON.parse(readFileSync(PROBLEMS_JSON, "utf8")) as Array<{
    slug: string;
    testCases: Array<{ input: string }>;
  }>;

  it("covers all 150 problems", () => {
    expect(problems).toHaveLength(150);
    for (const p of problems) expect(PROBLEM_META[p.slug]).toBeDefined();
  });

  it.each(problems.map((p) => [p.slug, p] as const))("%s", (_slug, p) => {
    const errors = p.testCases
      .map((tc, i) => [i, validateInput(tc.input, PROBLEM_META[p.slug])] as const)
      .filter(([, e]) => e !== null);
    expect(errors).toEqual([]);
  });
});
