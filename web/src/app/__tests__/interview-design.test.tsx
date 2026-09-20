import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InterviewPage from "../interview/page";
import SystemDesignPage from "../system-design/page";

const mocks = vi.hoisted(() => ({
  startInterview: vi.fn(),
  getInterview: vi.fn(),
  answerInterview: vi.fn(),
  getInterviewReport: vi.fn(),
  transcribeSpeech: vi.fn(),
  evaluateExplanation: vi.fn(),
  analyzeSystemDesign: vi.fn(),
  downloadInterviewPdf: vi.fn(),
  theme: "light" as "light" | "dark",
  reducedMotion: false,
  graphProps: null as Record<string, unknown> | null,
}));

vi.mock("@/components/auth/protected", () => ({ Protected: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/layout/page-shell", () => ({ PageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("framer-motion", () => ({
  motion: { div: ({ children, ...props }: { children: React.ReactNode; className?: string }) => <div className={props.className}>{children}</div> },
  useReducedMotion: () => mocks.reducedMotion,
}));
vi.mock("@xyflow/react", () => ({
  ReactFlow: (props: Record<string, unknown>) => { mocks.graphProps = props; return <div data-testid="architecture-diagram" />; },
  Background: () => null,
  Controls: () => null,
  MarkerType: { ArrowClosed: "arrowclosed" },
  Position: { Right: "right", Left: "left", Top: "top", Bottom: "bottom" },
}));
vi.mock("@/components/ui/theme-provider", () => ({ useTheme: () => ({ theme: mocks.theme, mounted: true }) }));
vi.mock("@/lib/interviewPdf", () => ({ downloadInterviewPdf: mocks.downloadInterviewPdf }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, api: {
    ...original.api,
    startInterview: mocks.startInterview,
    getInterview: mocks.getInterview,
    answerInterview: mocks.answerInterview,
    getInterviewReport: mocks.getInterviewReport,
    transcribeSpeech: mocks.transcribeSpeech,
    evaluateExplanation: mocks.evaluateExplanation,
    analyzeSystemDesign: mocks.analyzeSystemDesign,
  } };
});

const question = (id: string, stage: string, kind = "question") => ({
  id, role: "assistant", stage, content: `${stage} question ${id}`, metadata_json: { kind }, created_at: "2026-09-19T12:00:00Z",
});
const candidate = (id: string, stage: string, content: string) => ({
  id, role: "candidate", stage, content, metadata_json: { kind: "answer" }, created_at: "2026-09-19T12:01:00Z",
});
const detail = (stage: string, messages: unknown[], status = "active") => ({
  session: { id: "session-1", company: "google", current_stage: stage, status }, messages,
});
const designResult = {
  summary: "The write path needs a clearer failure policy.",
  nodes: [{ id: "client", label: "Client", type: "client" }, { id: "service", label: "API", type: "service" }],
  edges: [{ source: "client", target: "service", label: "requests" }],
  rubric: { reliability: { score: 6, notes: "Add retries." } },
  risks: ["Single service instance"], improvements: ["Add replicas"],
};

beforeEach(() => {
  for (const value of Object.values(mocks)) if (typeof value === "function" && "mockReset" in value) value.mockReset();
  mocks.theme = "light";
  mocks.reducedMotion = false;
  mocks.graphProps = null;
  Object.defineProperty(window, "matchMedia", { configurable: true, value: (query: string) => ({ matches: query.includes("min-width"), addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
  Object.defineProperty(globalThis, "MediaRecorder", { configurable: true, value: undefined });
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollTo = vi.fn();
  mocks.startInterview.mockResolvedValue({ session: { id: "session-1", currentStage: "behavioral", status: "active" } });
  mocks.getInterview.mockResolvedValue(detail("behavioral", [question("q1", "behavioral")]));
});

async function startInterview(user: ReturnType<typeof userEvent.setup>) {
  render(<InterviewPage />);
  await user.click(screen.getByRole("button", { name: "Start interview" }));
  await screen.findByRole("heading", { name: /Stage 1\/4/ });
}

describe("interview flow", () => {
  it("exposes company/difficulty selection and a durable start error", async () => {
    const user = userEvent.setup();
    mocks.startInterview.mockRejectedValueOnce(new Error("Interview service unavailable"));
    render(<InterviewPage />);
    await user.click(screen.getByRole("button", { name: /Amazon/ }));
    await user.click(screen.getByRole("button", { name: "Hard" }));
    expect(screen.getByRole("button", { name: /Amazon/ })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Start interview" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Interview service unavailable");
    expect(mocks.startInterview).toHaveBeenCalledWith("amazon", "hard");
  });

  it("moves through a follow-up and all four stages with a multiline draft", async () => {
    const user = userEvent.setup();
    await startInterview(user);
    const answer = screen.getByRole("textbox", { name: "Your answer" });
    await user.type(answer, "First line{enter}Second line");
    expect(answer).toHaveValue("First line\nSecond line");

    const stages = ["behavioral", "coding", "system_design", "core_cs"];
    let messages: unknown[] = [question("q1", "behavioral")];
    for (let index = 0; index < 5; index += 1) {
      const stage = stages[Math.min(index, 3)];
      const text = index === 0 ? "First line\nSecond line" : `Answer ${index}`;
      messages = [...messages, candidate(`a${index}`, stage, text)];
      const nextStage = index === 0 ? "behavioral" : stages[index] ?? "report";
      if (index < 4) messages = [...messages, question(`q${index + 2}`, nextStage, index === 0 ? "followup" : "question")];
      mocks.getInterview.mockResolvedValueOnce(detail(nextStage, messages, index === 4 ? "completed" : "active"));
      if (index > 0) await user.type(screen.getByRole("textbox", { name: "Your answer" }), text);
      await user.click(screen.getByRole("button", { name: "Send answer" }));
      if (index < 4) await screen.findByText(`${nextStage} question q${index + 2}`);
    }
    expect(mocks.answerInterview).toHaveBeenCalledTimes(5);
    expect(screen.getByText("Interview Complete", { selector: "h2" })).toBeInTheDocument();
  });

  it("reconciles an accepted answer after refresh failure without another POST", async () => {
    const user = userEvent.setup();
    await startInterview(user);
    mocks.getInterview.mockRejectedValueOnce(new Error("Refresh failed"));
    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "Keep this answer");
    await user.click(screen.getByRole("button", { name: "Send answer" }));
    expect(await screen.findByRole("button", { name: "Refresh conversation" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue("Keep this answer");
    mocks.getInterview.mockResolvedValueOnce(detail("coding", [question("q1", "behavioral"), candidate("a1", "behavioral", "Keep this answer"), question("q2", "coding") ]));
    await user.click(screen.getByRole("button", { name: "Refresh conversation" }));
    await screen.findByRole("heading", { name: /Stage 2\/4/ });
    expect(mocks.answerInterview).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue("");
  });

  it("retries an initial transcript failure without creating a second session", async () => {
    const user = userEvent.setup();
    mocks.getInterview.mockRejectedValueOnce(new Error("Transcript unavailable"));
    render(<InterviewPage />);
    await user.click(screen.getByRole("button", { name: "Start interview" }));
    expect(await screen.findByText("Conversation unavailable")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry conversation" }));
    expect(await screen.findByText("behavioral question q1")).toBeInTheDocument();
    expect(mocks.startInterview).toHaveBeenCalledTimes(1);
  });

  it("explains unavailable microphone and preserves report export", async () => {
    const user = userEvent.setup();
    await startInterview(user);
    await user.click(screen.getByRole("button", { name: "Record voice" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Microphone recording is unavailable");
    mocks.getInterview.mockResolvedValueOnce(detail("report", [question("q1", "behavioral"), candidate("a1", "behavioral", "done")], "completed"));
    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "done");
    await user.click(screen.getByRole("button", { name: "Send answer" }));
    mocks.getInterviewReport.mockResolvedValue({ sessionId: "session-1", company: "google", overallScore: 8, stageScores: {}, strengths: [], weaknesses: [], recommendations: [] });
    await user.click(await screen.findByRole("button", { name: "Generate report" }));
    await user.click(await screen.findByRole("button", { name: "Download PDF" }));
    expect(mocks.downloadInterviewPdf).toHaveBeenCalledTimes(1);
  });

  it("shows microphone denial and appends a successful transcript before voice evaluation", async () => {
    const user = userEvent.setup();
    await startInterview(user);
    const stopTrack = vi.fn();
    const getUserMedia = vi.fn()
      .mockRejectedValueOnce(new Error("Permission denied"))
      .mockResolvedValueOnce({ getTracks: () => [{ stop: stopTrack }] });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    class FakeRecorder {
      stream: { getTracks: () => Array<{ stop: () => void }> };
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      constructor(stream: { getTracks: () => Array<{ stop: () => void }> }) { this.stream = stream; }
      start() {}
      stop() { this.ondataavailable?.({ data: new Blob(["audio"]) }); this.onstop?.(); }
    }
    Object.defineProperty(globalThis, "MediaRecorder", { configurable: true, value: FakeRecorder });
    Object.defineProperty(Blob.prototype, "arrayBuffer", { configurable: true, value: async () => new TextEncoder().encode("audio").buffer });
    mocks.transcribeSpeech.mockResolvedValueOnce({ transcript: "I would measure latency." });
    mocks.evaluateExplanation.mockResolvedValueOnce({ evaluation: { overallScore: 7, technicalCorrectness: { score: 7, notes: "Clear" }, communicationClarity: { score: 7, notes: "Clear" }, completeness: { score: 7, notes: "Clear" }, strengths: [], weaknesses: [], suggestions: [] } });

    await user.click(screen.getByRole("button", { name: "Record voice" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Permission denied");
    await user.click(screen.getByRole("button", { name: "Record voice" }));
    await user.click(screen.getByRole("button", { name: "Stop recording" }));
    expect(await screen.findByRole("textbox", { name: "Your answer" })).toHaveValue("I would measure latency.");
    expect(stopTrack).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Evaluate voice" }));
    expect(await screen.findByText("Voice Evaluation")).toBeInTheDocument();
    expect(mocks.evaluateExplanation).toHaveBeenCalledWith(expect.any(String), "behavioral question q1");
  });
});

describe("system design review", () => {
  it("keeps prompt/explanation through an error and retries without changing the request", async () => {
    const user = userEvent.setup();
    mocks.analyzeSystemDesign.mockRejectedValueOnce(new Error("Analysis unavailable")).mockResolvedValueOnce(designResult);
    render(<SystemDesignPage />);
    await user.click(screen.getByRole("button", { name: "Design a URL shortener like bit.ly" }));
    await user.type(screen.getByRole("textbox", { name: "Your explanation" }), "Use a short-code lookup table.");
    await user.click(screen.getByRole("button", { name: "Analyze design" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Analysis unavailable");
    expect(screen.getByRole("textbox", { name: "Your explanation" })).toHaveValue("Use a short-code lookup table.");
    await user.click(screen.getByRole("button", { name: "Retry analysis" }));
    expect(await screen.findByRole("heading", { name: "Design feedback" })).toBeInTheDocument();
    expect(mocks.analyzeSystemDesign).toHaveBeenNthCalledWith(2, "Design a URL shortener like bit.ly", "Use a short-code lookup table.", undefined);
  });

  it("renders theme-aware static diagram, text connections, rubric, risks, and improvements", async () => {
    const user = userEvent.setup();
    mocks.theme = "dark";
    mocks.reducedMotion = true;
    mocks.analyzeSystemDesign.mockResolvedValueOnce(designResult);
    render(<SystemDesignPage />);
    await user.type(screen.getByRole("textbox", { name: "Design prompt" }), "Design a service");
    await user.type(screen.getByRole("textbox", { name: "Your explanation" }), "Use an API.");
    await user.click(screen.getByRole("button", { name: "Analyze design" }));
    expect(await screen.findByTestId("architecture-diagram")).toBeInTheDocument();
    expect(mocks.graphProps?.colorMode).toBe("dark");
    expect((mocks.graphProps?.edges as Array<{ animated: boolean }>)[0].animated).toBe(false);
    await user.click(screen.getByText("Components and connections"));
    expect(screen.getByText("Client to API: requests")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "rubric" }));
    expect(screen.getByRole("progressbar", { name: "Reliability score" })).toHaveAttribute("aria-valuenow", "6");
    await user.click(screen.getByRole("tab", { name: "risks" }));
    expect(screen.getByText("Single service instance")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "improvements" }));
    expect(screen.getByText("Add replicas")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit design" }));
    expect(screen.getByRole("textbox", { name: "Design prompt" })).toHaveValue("Design a service");
    expect(screen.getByRole("textbox", { name: "Your explanation" })).toHaveValue("Use an API.");
  });

  it("handles empty diagrams and unavailable microphone without losing the written draft", async () => {
    const user = userEvent.setup();
    mocks.analyzeSystemDesign.mockResolvedValueOnce({ ...designResult, nodes: [], edges: [], risks: [], improvements: [] });
    render(<SystemDesignPage />);
    await user.type(screen.getByRole("textbox", { name: "Design prompt" }), "Design a cache");
    await user.type(screen.getByRole("textbox", { name: "Your explanation" }), "Cache reads.");
    await user.click(screen.getByRole("button", { name: "Record Voice" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Microphone recording is unavailable");
    expect(screen.getByRole("textbox", { name: "Your explanation" })).toHaveValue("Cache reads.");
    await user.click(screen.getByRole("button", { name: "Analyze design" }));
    expect(await screen.findByText("No diagram components")).toBeInTheDocument();
    const feedback = screen.getByRole("tablist", { name: "Feedback sections" });
    await user.click(within(feedback).getByRole("tab", { name: "risks" }));
    expect(screen.getByText("No risks identified.")).toBeInTheDocument();
  });
});
