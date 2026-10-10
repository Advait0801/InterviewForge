import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Conversation } from "../conversation";
import { EvaluationCard } from "../question-details";
import type { Evaluation, InterviewMessage } from "@/lib/api";

describe("interview conversation accessibility", () => {
  it("labels the scroll region and includes it in keyboard navigation", async () => {
    Element.prototype.scrollTo = vi.fn();
    const message: InterviewMessage = {
      id: "answer", session_id: "session", role: "candidate", stage: "behavioral",
      content: "I compared the trade-offs.", metadata_json: { kind: "answer" }, created_at: "2026-01-01T00:00:00Z",
    };
    render(<Conversation messages={[message]} preview={null} evaluation={null} busy={false} phase="" announcement="" />);
    const region = screen.getByRole("region", { name: "Interview conversation" });
    expect(region).toHaveAttribute("tabindex", "0");
    await userEvent.setup().tab();
    expect(region).toHaveFocus();
  });
});

describe("hint usage wording", () => {
  it.each([[1, "1 hint used"], [3, "3 hints used"]])("labels %i hints correctly", (hintsUsed, label) => {
    const evaluation: Evaluation = {
      score: 5, hintsUsed, strengths: [], weaknesses: [], suggestions: [], shouldAskFollowup: false, followupFocus: "",
    };
    render(<EvaluationCard evaluation={evaluation} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
