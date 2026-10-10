import { describe, it, expect, vi } from "vitest";

// runner.ts creates a Docker client at import; nothing here talks to it.
vi.mock("dockerode", () => ({ default: class {} }));

import { runCode } from "../runner";
import type { RunResult, SupportedLanguage, TestCase } from "../types";

const EXAMPLES: TestCase[] = [
  { input: "nums = [2, 7], target = 9", expectedOutput: "[0,1]" },
  { input: "nums = [3, 3], target = 6", expectedOutput: "[0,1]" },
];
const REFERENCE = { language: "python3" as SupportedLanguage, code: "REFERENCE" };

/**
 * A stand-in for one sandbox. The reference "solves" two-sum as [0, 1] unless the input
 * contains 99, which it can't run. The user's code answers [0, 1] for everything.
 */
function fakeExecutor() {
  const calls: Array<{ code: string; inputs: string[] }> = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const execute = async (_lang: SupportedLanguage, code: string, cases: TestCase[]): Promise<RunResult> => {
    calls.push({ code, inputs: cases.map((c) => c.input) });
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    const results = cases.map((c) => {
      if (code === "REFERENCE") {
        return c.input.includes("99") ? { passed: false, error: "list index out of range" } : { passed: false, actualOutput: "[0, 1]" };
      }
      const passed = c.expectedOutput.replace(/\s/g, "") === "[0,1]";
      return passed ? { passed, actualOutput: "[0,1]" } : { passed, actualOutput: "[0,1]", diff: { kind: "format" as const } };
    });
    return { passed: results.every((r) => r.passed), results, runtimeMs: 1 };
  };
  return { execute, calls, maxInFlight: () => maxInFlight };
}

const run = (customInputs: string[] | undefined, fake = fakeExecutor()) =>
  runCode(
    {
      language: "javascript",
      code: "USER",
      testCases: EXAMPLES,
      slug: "two-sum",
      ...(customInputs ? { customCases: { inputs: customInputs, reference: REFERENCE } } : {}),
    },
    fake.execute
  ).then((result) => ({ result, fake }));

describe("custom test cases", () => {
  it("without them, one sandbox runs the examples, as before", async () => {
    const { result, fake } = await run(undefined);
    expect(fake.calls).toEqual([{ code: "USER", inputs: EXAMPLES.map((e) => e.input) }]);
    expect(result.customResults).toBeUndefined();
  });

  it("the reference runs first, on the custom inputs only; then the user's code on examples + inputs", async () => {
    const { fake } = await run(["nums = [5, 6], target = 11"]);
    expect(fake.calls.map((c) => c.code)).toEqual(["REFERENCE", "USER"]);
    expect(fake.calls[0].inputs).toEqual(["nums = [5, 6], target = 11"]);
    expect(fake.calls[1].inputs).toEqual([...EXAMPLES.map((e) => e.input), "nums = [5, 6], target = 11"]);
  });

  it("never holds two sandboxes at once, so the queue's cap stays the cap on containers", async () => {
    const { fake } = await run(["nums = [5, 6], target = 11", "nums = [1, 2], target = 3"]);
    expect(fake.maxInFlight()).toBe(1);
  });

  it("judges the user's output against the reference's, normalised", async () => {
    const { result } = await run(["nums = [5, 6], target = 11"]);
    expect(result.customResults).toEqual([
      { input: "nums = [5, 6], target = 11", judged: true, expectedOutput: "[0,1]", passed: true, actualOutput: "[0,1]" },
    ]);
    expect(result.results).toHaveLength(EXAMPLES.length);
  });

  it("an input the reference can't run is reported unjudged, and doesn't fail the run", async () => {
    const { result } = await run(["nums = [99, 1], target = 100", "nums = [5, 6], target = 11"]);
    const [bad, good] = result.customResults!;
    expect(bad).toMatchObject({ judged: false, passed: false, actualOutput: "[0,1]" });
    expect(bad.inputError).toMatch(/reference solution couldn't run this input: list index out of range/);
    expect(good).toMatchObject({ judged: true, passed: true });
    expect(result.passed).toBe(true);
  });

  it("an invalid input is reported, and reaches neither sandbox", async () => {
    const { result, fake } = await run(['nums = [1], target = "x"', "nums = [5, 6], target = 11"]);
    for (const call of fake.calls) expect(call.inputs).not.toContain('nums = [1], target = "x"');
    expect(result.customResults![0]).toMatchObject({ judged: false, inputError: expect.stringMatching(/^Invalid input:/) });
    expect(result.customResults![0].actualOutput).toBeUndefined();
    expect(result.customResults![1]).toMatchObject({ judged: true, passed: true });
  });

  it("with only invalid inputs, the reference never runs", async () => {
    const { fake } = await run(["nums = oops"]);
    expect(fake.calls.map((c) => c.code)).toEqual(["USER"]);
  });

  it("passed covers the examples and every judged custom case", async () => {
    const fake = fakeExecutor();
    const original = fake.execute;
    // The reference says [1, 0]: the user's [0, 1] still passes an order-independent
    // problem in the real runner, but this stand-in compares text, so it fails here.
    fake.execute = async (lang, code, cases, meta) =>
      code === "REFERENCE"
        ? { passed: false, results: cases.map(() => ({ passed: false, actualOutput: "[1, 2]" })) }
        : original(lang, code, cases, meta);
    const { result } = await run(["nums = [5, 6], target = 11"], fake);
    expect(result.customResults![0]).toMatchObject({ judged: true, passed: false, expectedOutput: "[1,2]" });
    expect(result.passed).toBe(false);
  });
});
