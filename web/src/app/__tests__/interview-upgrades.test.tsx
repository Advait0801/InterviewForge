import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InterviewPage from "../interview/page";
import { ApiError, type AnswerOutcome, type AnswerStreamEvent, type InterviewMessage, type StartStreamEvent } from "@/lib/api";
import type { components } from "@/lib/api/schema";

const mocks = vi.hoisted(() => ({ start: vi.fn(), answer: vi.fn(), get: vi.fn(), hint: vi.fn() }));
vi.mock("@/components/auth/protected", () => ({ Protected: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/layout/page-shell", () => ({ PageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api", async (original) => {
  const actual = await original<typeof import("@/lib/api")>();
  return { ...actual, api: { ...actual.api, startInterviewStream: mocks.start, answerInterviewStream: mocks.answer, getInterview: mocks.get, interviewHint: mocks.hint } };
});
const evaluation: components["schemas"]["Evaluation"] = { score: 5, rawScore: 7, hintPenalty: 2, hintsUsed: 2, strengths: ["Clear reasoning"], weaknesses: [], suggestions: [], shouldAskFollowup: true, followupFocus: "tradeoffs" };
const opening: components["schemas"]["InterviewQuestion"] = { question: "Final opening question", reasoningFocus: "tradeoffs", expectedCompetencies: [], retrievalHits: 0, context: "", retrievalConfidence: null, liveIngestion: null, resumeGrounded: false, resumeHits: 0, resumeEvidence: [] };
const metadata: components["schemas"]["QuestionMetadata"] = { ...opening, kind: "question", company: "google", stage: "behavioral", groundedIn: null };
const question = (id = "q1", content = opening.question): InterviewMessage => ({ id, session_id: "s", role: "assistant", stage: "behavioral", content, metadata_json: metadata, created_at: "2026-01-01T00:00:00Z" });
const candidate: InterviewMessage = { ...question("a"), role: "candidate", content: "Typed answer", metadata_json: { kind: "answer" } };
const agent: components["schemas"]["AgentNote"] = { decided: "pivot", rationale: "Explore your reliability decisions", steps: 2, searches: 2 };
const outcome: AnswerOutcome = { action: "pivot", sessionId: "s", stage: "behavioral", evaluation, nextQuestion: { question: "Final pivot question", focus: "reliability", reason: "Go deeper" }, agent };
const detail = (messages: InterviewMessage[] = [question()], options = {}) => ({ session: { id: "s", current_stage: "behavioral", status: "active", persona: "friendly", mode: "agent", ...options }, messages });
const started = { session: { id: "s", currentStage: "behavioral", status: "active", persona: "friendly", mode: "agent" }, openingQuestion: opening };
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; }
async function start() {
  render(<InterviewPage />);
  fireEvent.click(screen.getByRole("button", { name: "Start interview" }));
  await screen.findByRole("textbox", { name: "Your answer" });
}
function typeAndSend() {
  fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "Typed answer" } });
  fireEvent.click(screen.getByRole("button", { name: "Send answer" }));
}
beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.start.mockResolvedValue(started); mocks.get.mockResolvedValue(detail());
  Element.prototype.scrollTo = vi.fn();
});
afterEach(() => { vi.useRealTimers(); });

describe("interviewer upgrades", () => {
  it("streams opening deltas without live token announcements, then replaces them with done", async () => {
    const pending = deferred<typeof started>(); let event!: (value: StartStreamEvent) => void;
    mocks.start.mockImplementation((_options, callback) => { event = callback; return pending.promise; });
    render(<InterviewPage />); fireEvent.click(screen.getByRole("button", { name: "Start interview" }));
    act(() => { event({ type: "question", kind: "question", stage: "behavioral" }); event({ type: "delta", text: "Draft " }); event({ type: "delta", text: "opening" }); });
    expect(screen.getByTestId("streamed-question")).toHaveTextContent("Draft opening");
    expect(document.querySelector('[aria-live="polite"][aria-atomic="true"]')).toHaveTextContent("");
    await act(async () => pending.resolve(started));
    expect(screen.queryByText("Draft opening")).not.toBeInTheDocument();
    expect(document.querySelector('[aria-live="polite"][aria-atomic="true"]')).toHaveTextContent(opening.question);
  });
  it("sends persona and mode picked with the keyboard and shows server preferences", async () => {
    const user = userEvent.setup(); render(<InterviewPage />);
    screen.getByRole("radio", { name: "Friendly" }).focus(); await user.keyboard(" ");
    screen.getByRole("radio", { name: "Adaptive" }).focus(); await user.keyboard(" ");
    await user.click(screen.getByRole("button", { name: "Start interview" }));
    await screen.findByRole("textbox", { name: "Your answer" });
    expect(mocks.start).toHaveBeenCalledWith({ company: "google", difficulty: "medium", persona: "friendly", mode: "agent" }, expect.any(Function), expect.any(AbortSignal));
    expect(screen.getByText(/Tone:/)).toHaveTextContent("friendly · Mode: Adaptive");
  });
  it("retries a failed start with the selected preferences and local error recovery", async () => {
    mocks.start.mockRejectedValueOnce(new ApiError("Opening unavailable", 503, true)).mockResolvedValueOnce(started);
    render(<InterviewPage />); fireEvent.click(screen.getByRole("button", { name: "Start interview" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Opening unavailable");
    fireEvent.click(screen.getByRole("radio", { name: "Friendly" }));
    fireEvent.click(screen.getByRole("radio", { name: "Adaptive" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry interview" }));
    await screen.findByRole("textbox", { name: "Your answer" });
    expect(mocks.start.mock.calls[1][0]).toMatchObject({ persona: "friendly", mode: "agent" });
  });
  it("uses authoritative follow-up text, pushback and reasoning before transcript refresh completes", async () => {
    await start(); const refresh = deferred<ReturnType<typeof detail>>();
    mocks.get.mockReturnValueOnce(refresh.promise);
    mocks.answer.mockResolvedValueOnce({ action: "followup", sessionId: "s", stage: "behavioral", evaluation, agent,
      nextQuestion: { question: "Authoritative follow-up", focus: "facts", reason: "Reconcile", challenge: { claim: "My claim", evidence: "Reference evidence" } } });
    typeAndSend();
    expect(await screen.findByTestId("streamed-question")).toHaveTextContent("Authoritative follow-up");
    expect(screen.getByRole("note", { name: "Pushback" })).toHaveTextContent("My claim");
    expect(screen.getByText("Why this question?")).toBeInTheDocument();
    await act(async () => refresh.resolve(detail([question(), candidate, { ...question("q2", "Authoritative follow-up"), metadata_json: { kind: "followup", focus: "facts", reason: "Reconcile", agent } }])));
    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue("");
  });
  it("cancels an answer stream while preserving the draft and discarding provisional output", async () => {
    await start(); mocks.answer.mockImplementation((_id, _answer, event, signal: AbortSignal) => {
      event({ type: "evaluation", evaluation }); event({ type: "question", kind: "followup", stage: "behavioral" }); event({ type: "delta", text: "Cancelled question" });
      return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));
    });
    typeAndSend(); expect(screen.getByTestId("streamed-question")).toHaveTextContent("Cancelled question");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Cancel" })));
    expect(screen.queryByTestId("streamed-question")).not.toBeInTheDocument(); expect(screen.queryByText(/5\/10/)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue("Typed answer"); expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("requires local refresh recovery when a non-retryable error's session reload fails", async () => {
    await start(); mocks.answer.mockRejectedValueOnce(new ApiError("Already answered", 409, false));
    mocks.get.mockRejectedValueOnce(new ApiError("Conversation unavailable", 503));
    typeAndSend(); await screen.findByRole("button", { name: "Refresh conversation" });
    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue("Typed answer");
    expect(screen.queryByRole("button", { name: "Retry answer" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh conversation" }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(3)); expect(mocks.answer).toHaveBeenCalledTimes(1);
  });
  it("leaves mode unset by default", async () => {
    await start(); expect(mocks.start.mock.calls[0][0].mode).toBeUndefined();
  });
  it("shows evaluation immediately, streams the next question, and keeps a pivot in the same stage", async () => {
    await start(); const pending = deferred<AnswerOutcome>(); let event!: (value: AnswerStreamEvent) => void;
    mocks.answer.mockImplementation((_id, _answer, callback) => { event = callback; return pending.promise; });
    mocks.get.mockResolvedValueOnce(detail([question(), candidate, { ...question("q2", "Final pivot question"), metadata_json: { ...metadata, agent } }]));
    typeAndSend(); expect(screen.getAllByText("Evaluating your answer…").length).toBeGreaterThan(0);
    act(() => event({ type: "evaluation", evaluation }));
    expect(screen.getByText("5/10 (7 before a 2-point hint penalty)")).toBeInTheDocument();
    act(() => { event({ type: "question", kind: "question", stage: "behavioral" }); event({ type: "delta", text: "Draft pivot" }); });
    expect(screen.getByTestId("streamed-question")).toHaveTextContent("Draft pivot");
    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue("Typed answer");
    await act(async () => pending.resolve(outcome));
    expect(screen.queryByText("Draft pivot")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Stage 1/4: Behavioral" })).toBeInTheDocument();
    expect(screen.getByText(/Tone:/)).toHaveTextContent("Question 2 of up to 3");
    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue("");
    fireEvent.click(screen.getByText("Why this question?"));
    expect(screen.getByText(agent.rationale)).toBeVisible(); expect(screen.getByText("Looked up 2 sources")).toBeVisible();
  });
  it("keeps a retryable answer and resends exactly the same draft", async () => {
    await start(); mocks.answer.mockRejectedValueOnce(new ApiError("Try later", 503, true)).mockResolvedValueOnce(outcome);
    typeAndSend(); await screen.findByRole("button", { name: "Retry answer" });
    expect(screen.getByRole("alert")).toHaveTextContent("Try later"); expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue("Typed answer");
    mocks.get.mockResolvedValueOnce(detail([question(), candidate, question("q2", "Final pivot question")]));
    fireEvent.click(screen.getByRole("button", { name: "Retry answer" }));
    await waitFor(() => expect(mocks.answer).toHaveBeenCalledTimes(2));
    expect(mocks.answer.mock.calls.map((call) => call[1])).toEqual(["Typed answer", "Typed answer"]);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue(""));
  });
  it("reloads after a non-retryable 409 and drops provisional evaluation", async () => {
    await start(); mocks.answer.mockImplementation((_id, _answer, callback) => { callback({ type: "evaluation", evaluation }); return Promise.reject(new ApiError("Already answered", 409, false)); });
    mocks.get.mockResolvedValueOnce(detail([question(), candidate, question("q2", "Reloaded question")]));
    typeAndSend(); await screen.findByRole("alert");
    expect(mocks.get).toHaveBeenCalledTimes(2); expect(screen.getByRole("alert")).toHaveTextContent("Already answered");
    expect(screen.queryByText(/5\/10/)).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Retry answer" })).not.toBeInTheDocument();
    expect(screen.getByText("Reloaded question")).toBeInTheDocument();
  });
  it("blocks repeat POST after transport loss until the answer is reconciled", async () => {
    await start(); mocks.answer.mockRejectedValueOnce(new TypeError("Connection lost"));
    typeAndSend(); await screen.findByRole("button", { name: "Refresh conversation" });
    fireEvent.click(screen.getByRole("button", { name: "Refresh conversation" }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(3)); expect(mocks.answer).toHaveBeenCalledTimes(1);
  });
  it.each(["unmount", "pagehide", "cancel"])("aborts the pending stream on %s without an error", async (action) => {
    mocks.start.mockImplementation((_options, _callback, signal: AbortSignal) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))));
    const view = render(<InterviewPage />); fireEvent.click(screen.getByRole("button", { name: "Start interview" }));
    const signal = mocks.start.mock.calls[0][2] as AbortSignal;
    await act(async () => { if (action === "unmount") view.unmount(); else if (action === "pagehide") window.dispatchEvent(new Event("pagehide")); else fireEvent.click(screen.getByRole("button", { name: "Cancel" })); });
    expect(signal.aborted).toBe(true); expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("locks hints from the server timestamp, counts down, renders inline hints and exhausts after three", async () => {
    await start(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-10T00:00:00Z"));
    fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "My draft" } });
    mocks.hint.mockRejectedValueOnce(new ApiError("Wait for the next hint", 409, undefined, "hint_locked", "2026-10-10T00:00:30Z"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Get a hint" })));
    expect(screen.getByRole("button", { name: "Get a hint in 30s" })).toBeDisabled();
    await act(async () => vi.advanceTimersByTime(30_000));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    for (let level = 1; level <= 3; level++) {
      mocks.hint.mockResolvedValueOnce({ sessionId: "s", stage: "behavioral", level, hint: `Consider hint ${level}`, hintsUsed: level, hintsRemaining: 3 - level, penalty: level,
        nextAvailableAt: level < 3 ? new Date(Date.now() + 30_000).toISOString() : null });
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Get a hint" })));
      expect(screen.getByText(`Hint ${level}/3`)).toBeInTheDocument();
      expect(screen.getByText(`Consider hint ${level}`)).toBeInTheDocument();
      if (level < 3) { expect(screen.getByRole("button", { name: "Get a hint in 30s" })).toBeDisabled(); await act(async () => vi.advanceTimersByTime(30_000)); }
    }
    expect(screen.getByRole("button", { name: "No hints left" })).toBeDisabled();
    expect(mocks.hint.mock.calls[0].slice(0, 2)).toEqual(["s", "My draft"]);
  });
  it("handles server hints_exhausted distinctly", async () => {
    await start(); mocks.hint.mockRejectedValueOnce(new ApiError("No hints remain", 409, undefined, "hints_exhausted"));
    fireEvent.click(screen.getByRole("button", { name: "Get a hint" }));
    expect(await screen.findByRole("button", { name: "No hints left" })).toBeDisabled();
  });
  it("reloads a question answered during the hint request", async () => {
    await start(); mocks.hint.mockRejectedValueOnce(new ApiError("Question changed", 409));
    fireEvent.click(screen.getByRole("button", { name: "Get a hint" }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
  });
  it("offers local hint recovery without losing the draft", async () => {
    await start(); mocks.hint.mockRejectedValueOnce(new ApiError("Hint service unavailable", 503));
    fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "My draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Get a hint" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Hint service unavailable");
    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue("My draft"); expect(screen.getByRole("button", { name: "Get a hint" })).toBeEnabled();
  });
  it("renders stored pushback and penalty details, while hints do not replace the current question", async () => {
    const followup: InterviewMessage = { ...question("q2", "How do you reconcile this?"), metadata_json: { kind: "followup", focus: "facts", reason: "Contradiction", challenge: { claim: "All replicas are synchronous", evidence: "Replicas apply asynchronously" }, agent } };
    mocks.get.mockResolvedValueOnce(detail([question(), followup, { ...question("h"), content: "Check replication lag", metadata_json: { kind: "hint", level: 1, penalty: 1 } }, { ...question("e"), role: "system", metadata_json: { ...evaluation, kind: "evaluation" } }]));
    await start(); const callout = screen.getByRole("note", { name: "Pushback" });
    expect(within(callout).getByText(/All replicas are synchronous/)).toBeInTheDocument(); expect(within(callout).getByText(/Replicas apply asynchronously/)).toBeInTheDocument();
    expect(screen.getByText("5/10 (7 before a 2-point hint penalty)")).toBeInTheDocument(); expect(screen.getByText(/Tone:/)).toHaveTextContent("Question 2 of up to 3");
  });
  it.each(["fallback", "not_consulted"] as const)("renders %s reasoning as normal disclosure", async (decided) => {
    mocks.get.mockResolvedValueOnce(detail([{ ...question(), metadata_json: { ...metadata, agent: { ...agent, decided, searches: 0 } } }]));
    await start(); fireEvent.click(screen.getByText("Why this question?")); expect(screen.getByText(agent.rationale)).toBeVisible(); expect(screen.queryByRole("alert")).not.toBeInTheDocument(); expect(screen.queryByText(/Looked up/)).not.toBeInTheDocument();
  });
});
