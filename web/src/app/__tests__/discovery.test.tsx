import { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProblemsPage from "../problems/page";
import LearningPathsPage from "../paths/page";
import LearningPathDetailPage from "../paths/[slug]/page";
import type { LearningPathDetailResponse, LearningPathSummary, Problem } from "@/lib/api";

const mocks = vi.hoisted(() => ({
  slug: "arrays",
  listProblems: vi.fn(),
  addBookmark: vi.fn(),
  removeBookmark: vi.fn(),
  getLearningPaths: vi.fn(),
  getLearningPath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: mocks.slug }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...original,
    api: {
      ...original.api,
      listProblems: mocks.listProblems,
      addBookmark: mocks.addBookmark,
      removeBookmark: mocks.removeBookmark,
      getLearningPaths: mocks.getLearningPaths,
      getLearningPath: mocks.getLearningPath,
    },
  };
});

vi.mock("@/components/auth/protected", () => ({ Protected: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/layout/page-shell", () => ({ PageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function problemFixture(index: number, overrides: Partial<Problem> = {}): Problem {
  return {
    id: `problem-${index}`,
    slug: `problem-${index}`,
    title: `Problem ${index}`,
    description: `Practice description ${index}`,
    difficulty: "easy",
    topics: ["Arrays"],
    companies: ["Amazon"],
    is_solved: false,
    is_bookmarked: false,
    ...overrides,
  };
}

const pathSummary: LearningPathSummary = {
  id: "arrays",
  slug: "arrays",
  title: "Array Foundations",
  description: "Build reliable array techniques.",
  topic: "Arrays",
  difficultyLevel: "beginner",
  problemCount: 6,
  completedCount: 2,
};

function pathDetail(title: string, slug: string): LearningPathDetailResponse {
  return {
    path: {
      slug,
      title,
      description: `${title} description`,
      topic: "Arrays",
      difficultyLevel: "beginner",
      problemCount: 2,
      completedCount: 1,
    },
    problems: [
      { problemId: `${slug}-one`, position: 0, title: `${title} One`, slug: `${slug}-one`, difficulty: "easy", isCompleted: true },
      { problemId: `${slug}-two`, position: 1, title: `${title} Two`, slug: `${slug}-two`, difficulty: "medium", isCompleted: false },
    ],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("practice discovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.slug = "arrays";
    mocks.listProblems.mockResolvedValue({ problems: [] });
    mocks.addBookmark.mockResolvedValue({ ok: true });
    mocks.removeBookmark.mockResolvedValue({ ok: true });
    mocks.getLearningPaths.mockResolvedValue({ paths: [] });
    mocks.getLearningPath.mockResolvedValue(pathDetail("Array Foundations", "arrays"));
  });

  it("combines every catalogue filter, reports exact counts, and resets a no-match state", async () => {
    const user = userEvent.setup();
    const target = problemFixture(149, {
      title: "Sliding Graph Window",
      description: "A focused graph interview problem",
      difficulty: "medium",
      topics: ["Graphs"],
      companies: ["Meta"],
      is_solved: true,
      is_bookmarked: true,
    });
    const problems = Array.from({ length: 149 }, (_, index) => problemFixture(index));
    problems.push(target);
    mocks.listProblems.mockResolvedValue({ problems });

    const { container } = render(<ProblemsPage />);
    expect(await screen.findByRole("status", { name: "Problem result count" })).toHaveTextContent("Showing 150 of 150 problems");
    expect(container.querySelector("a button, button a")).toBeNull();

    await user.type(screen.getByLabelText("Search problems"), "window");
    await user.selectOptions(screen.getByLabelText("Status"), "solved");
    await user.selectOptions(screen.getByLabelText("Topic"), "Graphs");
    await user.selectOptions(screen.getByLabelText("Company tag"), "Meta");
    await user.click(screen.getByRole("button", { name: "Medium" }));
    await user.click(screen.getByRole("button", { name: "Saved problems only" }));

    expect(screen.getByRole("status", { name: "Problem result count" })).toHaveTextContent("Showing 1 of 150 matching problems");
    expect(screen.getByRole("link", { name: /Sliding Graph Window/ })).toHaveAttribute("href", "/problems/problem-149");
    expect(screen.getByRole("button", { name: "Medium" })).toHaveAttribute("aria-pressed", "true");

    await user.clear(screen.getByLabelText("Search problems"));
    await user.type(screen.getByLabelText("Search problems"), "nothing-can-match");
    expect(await screen.findByText("No problems match these filters")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Clear all filters" })[0]);
    expect(screen.getByRole("status", { name: "Problem result count" })).toHaveTextContent("Showing 150 of 150 problems");
  });

  it("keeps bookmark actions outside links and allows different saves to run independently", async () => {
    const user = userEvent.setup();
    const firstSave = deferred<{ ok: boolean }>();
    const secondSave = deferred<{ ok: boolean }>();
    mocks.listProblems.mockResolvedValue({ problems: [problemFixture(1), problemFixture(2)] });
    mocks.addBookmark.mockImplementation((id: string) => id === "problem-1" ? firstSave.promise : secondSave.promise);

    const { container } = render(<ProblemsPage />);
    const firstButton = await screen.findByRole("button", { name: "Save Problem 1" });
    const secondButton = screen.getByRole("button", { name: "Save Problem 2" });
    expect(firstButton.closest("a")).toBeNull();
    expect(container.querySelector("a button, button a")).toBeNull();

    await user.click(firstButton);
    await user.click(secondButton);
    expect(mocks.addBookmark).toHaveBeenCalledTimes(2);
    expect(firstButton).toBeDisabled();
    expect(secondButton).toBeDisabled();

    await act(async () => {
      firstSave.resolve({ ok: true });
      secondSave.resolve({ ok: true });
      await Promise.all([firstSave.promise, secondSave.promise]);
    });
    expect(await screen.findByRole("button", { name: "Remove Problem 1 from saved problems" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Remove Problem 2 from saved problems" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps catalogue failure, empty data, and retry recovery distinct", async () => {
    const user = userEvent.setup();
    mocks.listProblems
      .mockRejectedValueOnce(new Error("Catalogue service unavailable"))
      .mockResolvedValueOnce({ problems: [] });

    render(<ProblemsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Catalogue service unavailable");
    expect(screen.queryByText("No problems are available yet")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry catalogue" }));
    expect(await screen.findByText("No problems are available yet")).toBeInTheDocument();
    expect(mocks.listProblems).toHaveBeenCalledTimes(2);
  });

  it("retries path-list failures and clamps stale progress to the current path size", async () => {
    const user = userEvent.setup();
    mocks.getLearningPaths
      .mockRejectedValueOnce(new Error("Paths service unavailable"))
      .mockResolvedValueOnce({
        paths: [
          { ...pathSummary, completedCount: 7 },
          { ...pathSummary, id: "empty", slug: "empty", title: "Empty Path", problemCount: 0, completedCount: 0 },
        ],
      });

    render(<LearningPathsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Paths service unavailable");
    expect(screen.queryByText("No learning paths are available yet")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry learning paths" }));

    const progress = await screen.findByRole("progressbar", { name: "Array Foundations progress" });
    expect(progress).toHaveAttribute("aria-valuenow", "6");
    expect(progress).toHaveAttribute("aria-valuemax", "6");
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { name: "Empty Path progress" })).not.toBeInTheDocument();
    expect(screen.getByText("Sequence being prepared")).toBeInTheDocument();
    expect(screen.getByText("View path →")).toBeInTheDocument();
  });

  it("shows the next incomplete path step and distinguishes a network failure from not found", async () => {
    const user = userEvent.setup();
    mocks.getLearningPath
      .mockRejectedValueOnce(new Error("Path service unavailable"))
      .mockResolvedValueOnce(pathDetail("Array Foundations", "arrays"));

    render(<LearningPathDetailPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Path service unavailable");
    expect(screen.queryByText("Learning path not found")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry path" }));

    expect(await screen.findByRole("link", { name: "Continue with Array Foundations Two" })).toHaveAttribute("href", "/problems/arrays-two");
    expect(screen.getByText("Up next")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 2")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Array Foundations progress" })).toHaveAttribute("aria-valuenow", "1");
  });

  it("ignores an older path response after the slug changes", async () => {
    const oldRequest = deferred<LearningPathDetailResponse>();
    const newRequest = deferred<LearningPathDetailResponse>();
    mocks.getLearningPath.mockImplementation((slug: string) => slug === "arrays" ? oldRequest.promise : newRequest.promise);

    const { rerender } = render(<LearningPathDetailPage />);
    await waitFor(() => expect(mocks.getLearningPath).toHaveBeenCalledWith("arrays", true));
    mocks.slug = "graphs";
    rerender(<LearningPathDetailPage />);
    await waitFor(() => expect(mocks.getLearningPath).toHaveBeenCalledWith("graphs", true));

    await act(async () => {
      newRequest.resolve(pathDetail("Graph Foundations", "graphs"));
      await newRequest.promise;
    });
    expect(await screen.findByRole("heading", { name: "Graph Foundations" })).toBeInTheDocument();

    await act(async () => {
      oldRequest.resolve(pathDetail("Stale Array Path", "arrays"));
      await oldRequest.promise;
    });
    expect(screen.getByRole("heading", { name: "Graph Foundations" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Stale Array Path" })).not.toBeInTheDocument();
  });
});
