import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AssessmentsPage from "../assessments/page";
import ProblemWorkspacePage from "../problems/[id]/page";
import AssessmentWorkspacePage, { formatAssessmentTime } from "../assessments/[id]/page";
import type { Assessment, AssessmentProblem, ProblemDetail } from "@/lib/api";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  getProblem: vi.fn(),
  getSubmissions: vi.fn(),
  getSubmission: vi.fn(),
  runCode: vi.fn(),
  submitCode: vi.fn(),
  addBookmark: vi.fn(),
  removeBookmark: vi.fn(),
  reviewSubmission: vi.fn(),
  listAssessments: vi.fn(),
  createAssessment: vi.fn(),
  getAssessment: vi.fn(),
  linkAssessmentSubmission: vi.fn(),
  submitAssessment: vi.fn(),
  editorMounts: 0,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "problem-1" }),
  useRouter: () => mocks.router,
}));

vi.mock("next/dynamic", () => ({
  default: () => function MockEditor({ value, onChange, readOnly }: { value: string; onChange: (value: string) => void; readOnly?: boolean }) {
    return (
      <textarea
        aria-label={readOnly ? "Read-only code editor" : "Code editor"}
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
        ref={(node) => {
          if (node && !node.dataset.mounted) {
            node.dataset.mounted = "true";
            mocks.editorMounts += 1;
          }
        }}
      />
    );
  },
}));

vi.mock("@/lib/auth", () => ({ getToken: () => "test-token" }));
vi.mock("@/components/auth/protected", () => ({ Protected: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/layout/page-shell", () => ({ PageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...original,
    api: {
      ...original.api,
      getProblem: mocks.getProblem,
      getSubmissions: mocks.getSubmissions,
      getSubmission: mocks.getSubmission,
      runCode: mocks.runCode,
      submitCode: mocks.submitCode,
      addBookmark: mocks.addBookmark,
      removeBookmark: mocks.removeBookmark,
      reviewSubmission: mocks.reviewSubmission,
      listAssessments: mocks.listAssessments,
      createAssessment: mocks.createAssessment,
      getAssessment: mocks.getAssessment,
      linkAssessmentSubmission: mocks.linkAssessmentSubmission,
      submitAssessment: mocks.submitAssessment,
    },
  };
});

const problem: ProblemDetail = {
  id: "problem-1",
  slug: "two-sum",
  title: "Two Sum",
  description: "Return the two matching indices.",
  difficulty: "easy",
  topics: ["Arrays"],
  companies: ["Meta"],
  is_solved: false,
  is_bookmarked: false,
  starter_code: {
    python3: "class Solution:\n    pass",
    cpp: "class Solution {};",
    c: "int solve() {}",
    java: "class Solution {}",
  },
  test_cases: [{ input: "[2,7], 9", expectedOutput: "[0,1]" }],
  hints: "[\"Try a map\"]",
  editorial: "Use a complement map.",
};

const assessment: Assessment = {
  id: "problem-1",
  status: "active",
  time_limit_minutes: 60,
  difficulty_mix: "mixed",
  problem_count: 1,
  started_at: "2026-09-16T12:00:00.000Z",
  finished_at: null,
  score: null,
  created_at: "2026-09-16T12:00:00.000Z",
};

const assessmentProblem: AssessmentProblem = {
  id: "assessment-problem-1",
  assessment_id: "problem-1",
  problem_id: "problem-1",
  problem_order: 0,
  submission_id: null,
  title: "Two Sum",
  slug: "two-sum",
  difficulty: "easy",
  submission_status: null,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  for (const mock of [
    mocks.router.push, mocks.getProblem, mocks.getSubmissions, mocks.getSubmission, mocks.runCode,
    mocks.submitCode, mocks.addBookmark, mocks.removeBookmark, mocks.reviewSubmission,
    mocks.listAssessments, mocks.createAssessment, mocks.getAssessment,
    mocks.linkAssessmentSubmission, mocks.submitAssessment,
  ]) mock.mockReset();
  mocks.editorMounts = 0;
  mocks.getProblem.mockResolvedValue({ problem });
  mocks.getSubmissions.mockResolvedValue({ submissions: [], total: 0, limit: 50, offset: 0 });
  mocks.getSubmission.mockResolvedValue({ submission: { id: "submission-1", problem_id: "problem-1", language: "python3", code: "restored python", status: "failed", runtime_ms: 5, memory_kb: 10, created_at: "2026-09-16T12:00:00.000Z" } });
  mocks.runCode.mockResolvedValue({ mode: "run", passed: true, results: [{ passed: true, actualOutput: "[0,1]" }], runtimeMs: 4 });
  mocks.submitCode.mockResolvedValue({ mode: "submit", submissionId: "submission-2", status: "passed", passed: true, results: [{ passed: true }], runtimeMs: 5 });
  mocks.listAssessments.mockResolvedValue({ assessments: [] });
  mocks.createAssessment.mockResolvedValue({ assessmentId: "assessment-new", problemCount: 3, timeLimitMinutes: 60 });
  mocks.getAssessment.mockResolvedValue({ assessment, problems: [assessmentProblem], remainingMs: 60_000 });
  mocks.linkAssessmentSubmission.mockResolvedValue({ ok: true });
  mocks.submitAssessment.mockResolvedValue({ score: 100, passed: 1, total: 1, status: "completed" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("assessment setup and history", () => {
  it("distinguishes loading, failed, empty, and recovered list states", async () => {
    const request = deferred<{ assessments: Assessment[] }>();
    mocks.listAssessments
      .mockReturnValueOnce(request.promise)
      .mockRejectedValueOnce(new Error("History service unavailable"))
      .mockResolvedValueOnce({ assessments: [] });

    const user = userEvent.setup();
    const first = render(<AssessmentsPage />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading assessments");
    await act(async () => request.resolve({ assessments: [] }));
    expect(await screen.findByText("No assessments yet")).toBeInTheDocument();

    first.unmount();
    // Remounting exercises the independent error state without changing setup controls.
    const second = render(<AssessmentsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("History service unavailable");
    await user.click(screen.getByRole("button", { name: "Retry assessments" }));
    expect(await screen.findAllByText("No assessments yet")).not.toHaveLength(0);
    second.unmount();
  });

  it("exposes setup choices and sends the selected configuration", async () => {
    const user = userEvent.setup();
    render(<AssessmentsPage />);
    await screen.findByText("No assessments yet");
    await user.click(screen.getByRole("button", { name: "Hard" }));
    await user.click(screen.getByRole("button", { name: "4 problems" }));
    await user.click(screen.getByRole("button", { name: "90 min" }));
    await user.click(screen.getByRole("button", { name: "Start assessment" }));
    expect(mocks.createAssessment).toHaveBeenCalledWith({ difficultyMix: "hard", problemCount: 4, timeLimitMinutes: 90 });
    expect(mocks.router.push).toHaveBeenCalledWith("/assessments/assessment-new");
  });
});

describe("problem workspace", () => {
  it("recovers from a problem load error", async () => {
    mocks.getProblem.mockRejectedValueOnce(new Error("Problem service unavailable")).mockResolvedValueOnce({ problem });
    const user = userEvent.setup();
    render(<ProblemWorkspacePage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Problem service unavailable");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Two Sum" })).toBeInTheDocument();
  });

  it("restores code per language and switches mobile panes without remounting the editor", async () => {
    mocks.getSubmissions.mockResolvedValue({
      submissions: [
        { id: "py-sub", problem_id: "problem-1", problem_title: "Two Sum", language: "python3", status: "failed", runtime_ms: 5, memory_kb: 10, created_at: "2026-09-16T12:00:00.000Z" },
        { id: "cpp-sub", problem_id: "problem-1", problem_title: "Two Sum", language: "cpp", status: "failed", runtime_ms: 5, memory_kb: 10, created_at: "2026-09-16T11:00:00.000Z" },
      ],
      total: 2,
      limit: 50,
      offset: 0,
    });
    mocks.getSubmission.mockImplementation((id: string) => Promise.resolve({ submission: {
      id,
      problem_id: "problem-1",
      language: id === "cpp-sub" ? "cpp" : "python3",
      code: id === "cpp-sub" ? "restored cpp" : "restored python",
      status: "failed",
      runtime_ms: 5,
      memory_kb: 10,
      created_at: "2026-09-16T12:00:00.000Z",
    } }));

    const user = userEvent.setup();
    render(<ProblemWorkspacePage />);
    await user.click(await screen.findByRole("button", { name: "Editor" }));
    const editor = await screen.findByRole("textbox", { name: "Code editor" });
    expect(editor).toHaveValue("restored python");
    await user.clear(editor);
    await user.type(editor, "python draft");
    await user.selectOptions(screen.getByLabelText("Language"), "cpp");
    expect(await screen.findByDisplayValue("restored cpp")).toBeInTheDocument();
    const editorAfterLanguageChange = screen.getByRole("textbox", { name: "Code editor" });
    await user.click(screen.getByRole("button", { name: "Problem" }));
    await user.click(screen.getByRole("button", { name: "Editor" }));
    expect(screen.getByRole("textbox", { name: "Code editor" })).toBe(editorAfterLanguageChange);
    expect(mocks.editorMounts).toBe(1);
    await user.selectOptions(screen.getByLabelText("Language"), "python3");
    expect(screen.getByRole("textbox", { name: "Code editor" })).toHaveValue("python draft");
  });

  it("keeps execution errors visible in the console", async () => {
    mocks.runCode.mockRejectedValueOnce(new Error("Runner unavailable"));
    const user = userEvent.setup();
    render(<ProblemWorkspacePage />);
    await user.click(await screen.findByRole("button", { name: "Run code" }));
    await waitFor(() => expect(mocks.runCode).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("alert")).toHaveTextContent("Runner unavailable");
  });

  it("resizes the console from the keyboard and persists the new split", async () => {
    const user = userEvent.setup();
    render(<ProblemWorkspacePage />);
    await user.click(await screen.findByRole("button", { name: "Open console" }));
    const separator = screen.getByRole("separator", { name: "Resize editor and console panels" });
    expect(separator).toHaveAttribute("aria-valuenow", "38");
    separator.focus();
    await user.keyboard("{ArrowUp}");
    expect(separator).toHaveAttribute("aria-valuenow", "43");
    expect(localStorage.getItem("if-console-split-ratio")).toBe("0.43");
  });
});

describe("assessment workspace", () => {
  it("preserves per-language drafts, links submission IDs, and keeps the editor mounted across panes", async () => {
    const user = userEvent.setup();
    render(<AssessmentWorkspacePage />);
    await user.click(await screen.findByRole("button", { name: "Editor" }));
    const editor = screen.getByRole("textbox", { name: "Code editor" });
    await user.clear(editor);
    await user.type(editor, "python answer");
    await user.selectOptions(screen.getByLabelText("Language"), "cpp");
    expect(editor).toHaveValue("class Solution {};");
    await user.selectOptions(screen.getByLabelText("Language"), "python3");
    expect(editor).toHaveValue("python answer");
    await user.click(screen.getByRole("button", { name: "Problem" }));
    await user.click(screen.getByRole("button", { name: "Editor" }));
    expect(screen.getByRole("textbox", { name: "Code editor" })).toBe(editor);
    expect(mocks.editorMounts).toBe(1);

    await user.click(screen.getByRole("button", { name: "Submit problem" }));
    await waitFor(() => expect(mocks.linkAssessmentSubmission).toHaveBeenCalledWith("problem-1", "problem-1", "submission-2"));
    expect(await screen.findByText("1 of 1 problems attempted")).toBeInTheDocument();
  });

  it("waits for an in-flight problem submission before automatic timeout completion", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-16T12:00:00.000Z"));
    mocks.getAssessment.mockResolvedValue({ assessment, problems: [assessmentProblem], remainingMs: 1_000 });
    const pendingSubmission = deferred<{ mode: "submit"; submissionId: string; status: string; passed: boolean; results: Array<{ passed: boolean }>; runtimeMs: number }>();
    mocks.submitCode.mockReturnValue(pendingSubmission.promise);

    render(<AssessmentWorkspacePage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit problem" }));
    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });
    expect(mocks.submitAssessment).not.toHaveBeenCalled();

    await act(async () => {
      pendingSubmission.resolve({ mode: "submit", submissionId: "submission-timeout", status: "passed", passed: true, results: [{ passed: true }], runtimeMs: 5 });
      await pendingSubmission.promise;
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mocks.linkAssessmentSubmission).toHaveBeenCalledWith("problem-1", "problem-1", "submission-timeout");
    expect(mocks.submitAssessment).toHaveBeenCalledTimes(1);
  });

  it("formats assessment deadlines consistently", () => {
    expect(formatAssessmentTime(0)).toBe("0:00");
    expect(formatAssessmentTime(65_000)).toBe("1:05");
    expect(formatAssessmentTime(3_665_000)).toBe("1:01:05");
  });
});
