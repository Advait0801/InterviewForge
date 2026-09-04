import { describe, it, expect } from "vitest";
import {
  UUID_REGEX,
  INTERVIEW_STAGES,
  isValidCompany,
  isValidInterviewStage,
  normalizeCompany,
  getNextStage,
  shouldAskFollowup,
  buildEvaluationSummary,
  type InterviewStage,
} from "../services/interview-state.service";

describe("UUID_REGEX", () => {
  it("accepts a canonical v4 UUID", () => {
    expect(UUID_REGEX.test("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(true);
  });

  it("accepts uppercase", () => {
    expect(UUID_REGEX.test("3F2504E0-4F89-41D3-9A0C-0305E82C3301")).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["not a uuid", "hello"],
    ["missing a group", "3f2504e0-4f89-41d3-0305e82c3301"],
    ["wrong group length", "3f2504e0-4f89-41d3-9a0c-0305e82c33011"],
    ["non-hex characters", "zzzzzzzz-4f89-41d3-9a0c-0305e82c3301"],
    ["no hyphens", "3f2504e04f8941d39a0c0305e82c3301"],
    ["sql injection attempt", "' OR 1=1--"],
  ])("rejects %s", (_label, value) => {
    expect(UUID_REGEX.test(value)).toBe(false);
  });

  it("is anchored so it rejects a UUID with surrounding text", () => {
    expect(UUID_REGEX.test("x3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(false);
    expect(UUID_REGEX.test("3f2504e0-4f89-41d3-9a0c-0305e82c3301x")).toBe(false);
  });
});

describe("company validation", () => {
  it.each(["amazon", "google", "meta", "apple"])("accepts %s", (c) => {
    expect(isValidCompany(c)).toBe(true);
  });

  it("rejects an unknown company", () => {
    expect(isValidCompany("netflix")).toBe(false);
  });

  it("normalizes case and surrounding whitespace", () => {
    expect(normalizeCompany("  AMAZON ")).toBe("amazon");
    expect(normalizeCompany("Google")).toBe("google");
  });

  it("returns null rather than throwing on an unknown company", () => {
    expect(normalizeCompany("netflix")).toBeNull();
    expect(normalizeCompany("")).toBeNull();
  });
});

describe("stage progression", () => {
  it("advances through every stage in order", () => {
    expect(getNextStage("behavioral")).toBe("coding");
    expect(getNextStage("coding")).toBe("system_design");
    expect(getNextStage("system_design")).toBe("core_cs");
  });

  it("ends at report after the final stage", () => {
    expect(getNextStage("core_cs")).toBe("report");
  });

  it("walks the full sequence to report without cycling", () => {
    let stage: InterviewStage = INTERVIEW_STAGES[0];
    const seen: string[] = [stage];
    for (let i = 0; i < 10; i++) {
      const next = getNextStage(stage);
      if (next === "report") break;
      stage = next;
      seen.push(next);
    }
    expect(seen).toEqual([...INTERVIEW_STAGES]);
  });

  it("returns report for an unrecognised stage rather than throwing", () => {
    expect(getNextStage("nonsense" as never)).toBe("report");
  });

  it("validates stage names", () => {
    expect(isValidInterviewStage("coding")).toBe(true);
    expect(isValidInterviewStage("report")).toBe(false);
    expect(isValidInterviewStage("")).toBe(false);
  });
});

describe("shouldAskFollowup", () => {
  it("allows a follow-up on the first turn of a stage", () => {
    expect(shouldAskFollowup(0)).toBe(true);
  });

  it("allows at most one follow-up per stage", () => {
    expect(shouldAskFollowup(1)).toBe(false);
    expect(shouldAskFollowup(2)).toBe(false);
  });
});

describe("buildEvaluationSummary", () => {
  const base = {
    score: 7,
    strengths: ["clear structure"],
    weaknesses: ["missed edge cases"],
    suggestions: ["consider empty input"],
    shouldAskFollowup: true,
    followupFocus: "complexity analysis",
  };

  it("includes the score out of 10", () => {
    expect(buildEvaluationSummary(base)).toContain("Score: 7/10");
  });

  it("joins list fields with semicolons", () => {
    const summary = buildEvaluationSummary({
      ...base,
      strengths: ["a", "b"],
    });
    expect(summary).toContain("Strengths: a; b");
  });

  it("renders 'None' for empty lists rather than an empty string", () => {
    const summary = buildEvaluationSummary({
      ...base,
      strengths: [],
      weaknesses: [],
      suggestions: [],
    });
    expect(summary).toContain("Strengths: None");
    expect(summary).toContain("Weaknesses: None");
    expect(summary).toContain("Suggestions: None");
  });

  it("falls back when followupFocus is blank", () => {
    const summary = buildEvaluationSummary({ ...base, followupFocus: "" });
    expect(summary).toContain("Follow-up focus: General clarification");
  });

  it("renders the follow-up flag as yes/no", () => {
    expect(buildEvaluationSummary(base)).toContain("Should ask follow-up: yes");
    expect(
      buildEvaluationSummary({ ...base, shouldAskFollowup: false })
    ).toContain("Should ask follow-up: no");
  });
});
