import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProblemPage from "../problems/[id]/page";
import AssessmentPage from "../assessments/[id]/page";
import DailyPage from "../daily/page";
import ReviewPage from "../review/page";
import PathsPage from "../paths/page";
import PathPage from "../paths/[slug]/page";
import PublicPage from "../share/[token]/page";
import ReplayPage from "../interview/[id]/page";
import { metadata } from "../share/[token]/layout";
import {
  groupCDaily,
  groupCIntegrity,
  groupCPath,
  groupCProblem,
  groupCQueue,
  groupCReplay,
  groupCSession,
} from "@/test/group-c-fixtures";

const mocks = vi.hoisted(() => ({
  params: { id: "p", slug: "my-focus", token: "public-token" },
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useParams: () => mocks.params,
  useRouter: () => mocks,
}));
vi.mock("@/components/layout/page-shell", () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("@/components/ui/theme-provider", () => ({
  useTheme: () => ({ theme: "light", mounted: true, toggleTheme: vi.fn() }),
}));
vi.mock("next/dynamic", () => ({
  default: () =>
    function Editor(props: {
      value: string;
      onChange: (value: string) => void;
    }) {
      return (
        <textarea
          aria-label="Code editor"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        />
      );
    },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const requests: Request[] = [];
let handler: (request: Request) => { body: unknown; status?: number };
const run = {
  mode: "run",
  passed: false,
  testCases: groupCProblem.test_cases,
  results: [
    {
      passed: false,
      actualOutput: "[0,2]",
      diff: { kind: "value", path: [1], expected: 1, actual: 2 },
    },
  ],
  customResults: [
    {
      input: "nums = [3,3], target = 6",
      judged: true,
      passed: true,
      expectedOutput: "[0,1]",
      actualOutput: "[0,1]",
    },
    {
      input: "nums = [], target = 8",
      judged: false,
      passed: false,
      inputError: "Reference unavailable",
      actualOutput: "[]",
    },
  ],
};
beforeEach(() => {
  requests.length = 0;
  sessionStorage.clear();
  localStorage.setItem("if-token", "stored-token");
  mocks.push.mockClear();
  mocks.params = { id: "p", slug: "my-focus", token: "public-token" };
  handler = (request) => {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/submissions") && request.method === "GET")
      return { body: { submissions: [], total: 0, limit: 50, offset: 0 } };
    if (url.pathname.endsWith("/submissions") && request.method === "POST")
      return { body: run };
    if (url.pathname.endsWith("/review")) return { body: groupCQueue };
    if (url.pathname.endsWith("/learning-paths"))
      return {
        body: {
          paths: [
            { ...groupCPath.path, id: "personal" },
            {
              ...groupCPath.path,
              id: "other",
              slug: "other",
              isPersonal: false,
              title: "Generic path",
            },
          ].reverse(),
        },
      };
    if (url.pathname.endsWith("/learning-paths/my-focus"))
      return { body: groupCPath };
    if (url.pathname.endsWith("/problems/daily/history"))
      return {
        body: {
          days: [
            groupCDaily,
            { ...groupCDaily, date: "2026-10-10", solvedOnDay: false },
          ],
          streak: groupCDaily.streak,
        },
      };
    if (
      url.pathname.endsWith("/public/interviews/public-token") ||
      url.pathname.endsWith("/replay")
    )
      return { body: { ...groupCReplay, candidate: "Candidate Ada" } };
    if (url.pathname.endsWith("/interviews"))
      return { body: { sessions: [groupCSession] } };
    if (url.pathname.endsWith("/share")) return { body: { links: [] } };
    if (url.pathname.endsWith("/assessments/p"))
      return {
        body: {
          assessment: {
            id: "p",
            user_id: "u",
            status: "active",
            time_limit_minutes: 60,
            difficulty_mix: "mixed",
            problem_count: 1,
            started_at: "2026-10-11T00:00:00Z",
            finished_at: null,
            score: null,
            created_at: "2026-10-11T00:00:00Z",
          },
          problems: [
            {
              id: "ap",
              assessment_id: "p",
              problem_id: "p",
              problem_order: 0,
              submission_id: null,
              title: "Two Sum",
              slug: "two-sum",
              difficulty: "easy",
              submission_status: null,
            },
          ],
          remainingMs: 60000,
          integrity: groupCIntegrity,
        },
      };
    return { body: { problem: groupCProblem } };
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      requests.push(request);
      const result = handler(request);
      return new Response(JSON.stringify(result.body), {
        status: result.status ?? 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("Group C coding workspaces", () => {
  it.each(["javascript", "go", "rust"])(
    "restores %s and loads every language starter on the problem page",
    async (language) => {
      localStorage.setItem("if-preferred-lang", language);
      render(<ProblemPage />);
      await screen.findByRole("heading", { name: "Two Sum" });
      const select = screen.getByLabelText("Language");
      expect(within(select).getAllByRole("option")).toHaveLength(7);
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "Editor" }));
      expect(screen.getByLabelText("Code editor")).toHaveValue(
        `${language} starter`,
      );
      for (const value of [
        "python3",
        "c",
        "cpp",
        "java",
        "javascript",
        "go",
        "rust",
      ]) {
        await userEvent.setup().selectOptions(select, value);
        await waitFor(() =>
          expect(screen.getByLabelText("Code editor")).toHaveValue(
            value === "python3" ? "python starter" : `${value} starter`,
          ),
        );
      }
    },
  );
  it("restores all seven assessment language starters", async () => {
    localStorage.setItem("if-preferred-lang", "rust");
    render(<AssessmentPage />);
    await screen.findByRole("heading", { name: "Two Sum" });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Editor" }));
    const select = screen.getByLabelText("Language");
    expect(within(select).getAllByRole("option")).toHaveLength(7);
    expect(select).toHaveValue("rust");
    for (const value of [
      "python3",
      "c",
      "cpp",
      "java",
      "javascript",
      "go",
      "rust",
    ]) {
      await userEvent.setup().selectOptions(select, value);
      expect(screen.getByLabelText("Code editor")).toHaveValue(
        value === "python3" ? "python starter" : `${value} starter`,
      );
    }
    expect(screen.getByText(/This assessment records/)).toBeInTheDocument();
  });
  it("persists cases, maps a rejected sent index past empties, and focuses the invalid input", async () => {
    const user = userEvent.setup();
    const view = render(<ProblemPage />);
    await screen.findByRole("heading", { name: "Two Sum" });
    await user.click(screen.getByRole("button", { name: "Editor" }));
    await user.click(screen.getByRole("button", { name: "Open console" }));
    for (let i = 0; i < 3; i++)
      await user.click(screen.getByRole("button", { name: "Add custom case" }));
    fireEvent.change(screen.getByLabelText("Custom case 1"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Custom case 3"), {
      target: { value: "broken" },
    });
    const original = handler;
    handler = (request) =>
      request.method === "POST"
        ? {
            body: {
              error: "Invalid custom test case",
              customInputErrors: [{ index: 1, error: "Missing target" }],
            },
            status: 400,
          }
        : original(request);
    await user.click(screen.getByRole("button", { name: "Run code" }));
    expect(await screen.findByText("Missing target")).toBeInTheDocument();
    expect(screen.getByLabelText("Custom case 3")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("Custom case 2")).toHaveAttribute(
      "aria-invalid",
      "false",
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Custom case 3")).toHaveFocus(),
    );
    expect(screen.queryByText("Execution failed")).not.toBeInTheDocument();
    const body = await requests
      .find((request) => request.method === "POST")!
      .json();
    expect(body.customInputs).toEqual([
      groupCProblem.test_cases[0].input,
      "broken",
    ]);
    view.unmount();
    render(<ProblemPage />);
    await screen.findByRole("heading", { name: "Two Sum" });
    await user.click(screen.getByRole("button", { name: "Editor" }));
    await user.click(screen.getByRole("button", { name: "Open console" }));
    expect(screen.getByLabelText("Custom case 3")).toHaveValue("broken");
  });
  it("renders judged/unjudged cases and diffs; Submit sends no customInputs", async () => {
    const user = userEvent.setup();
    render(<ProblemPage />);
    await screen.findByRole("heading", { name: "Two Sum" });
    await user.click(screen.getByRole("button", { name: "Editor" }));
    await user.click(screen.getByRole("button", { name: "Open console" }));
    await user.click(screen.getByRole("button", { name: "Add custom case" }));
    await user.click(screen.getByRole("button", { name: "Run code" }));
    expect(
      await screen.findByText("Expected (reference solution): [0,1]"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Not judged: Reference unavailable/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("0/1 examples · 1/1 your cases"),
    ).toBeInTheDocument();
    expect(screen.getByText(/First difference at \[1\]/)).toBeInTheDocument();
    const original = handler;
    handler = (request) =>
      request.method === "POST"
        ? {
            body: {
              mode: "submit",
              passed: false,
              status: "failed",
              submissionId: "sub",
              results: [
                {
                  passed: false,
                  hidden: false,
                  input: "nums = [1], target = 5",
                  expectedOutput: "1",
                  actualOutput: "2",
                  diff: { kind: "value", path: [], expected: 1, actual: 2 },
                },
              ],
              review: {
                action: "enrolled",
                quality: 1,
                dueOn: "2026-10-12",
                intervalDays: 1,
              },
            },
          }
        : original(request);
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(
      await screen.findByText(/Added to your review queue/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/First difference at the whole output/),
    ).toBeInTheDocument();
    expect(
      await requests
        .filter((request) => request.method === "POST")
        .at(-1)!
        .json(),
    ).not.toHaveProperty("customInputs");
  });
});
it.each([true, false])(
  "daily history handles optional authentication (%s)",
  async (authed) => {
    if (!authed) localStorage.clear();
    render(<DailyPage />);
    await screen.findAllByRole("link", { name: "Two Sum" });
    const request = requests[0];
    expect(new URL(request.url).searchParams.get("days")).toBe("30");
    expect(request.headers.has("Authorization")).toBe(authed);
    expect(Boolean(screen.queryByText("3-day streak · best 7"))).toBe(authed);
    expect(Boolean(screen.queryByText("Solved on the day"))).toBe(authed);
  },
);
it("names review actions by problem while retaining their visible labels", async () => {
  handler = () => ({ body: groupCQueue });
  render(<ReviewPage />);
  await screen.findByRole("heading", { name: "Due now (1)" });
  for (const [title, problemId] of [["Two Sum", "p"], ["Valid Parentheses", "q"]]) {
    const practise = screen.getByRole("link", { name: `Practise ${title}` });
    expect(practise).toHaveAttribute("href", `/problems/${problemId}`);
    expect(practise).toHaveTextContent(/^Practise$/);
    expect(screen.getByRole("button", {
      name: `Remove ${title} from your review queue`,
    })).toHaveTextContent(/^Remove$/);
  }
});

it("renders due/upcoming review items and confirms removal", async () => {
  let removed = false;
  handler = (request) => {
    if (request.method === "DELETE") {
      removed = true;
      return { body: { ok: true } };
    }
    return {
      body: removed
        ? { ...groupCQueue, due: [], counts: { due: 0, total: 1 } }
        : groupCQueue,
    };
  };
  const confirm = vi
    .spyOn(window, "confirm")
    .mockReturnValueOnce(false)
    .mockReturnValueOnce(true);
  const user = userEvent.setup();
  render(<ReviewPage />);
  expect(
    await screen.findByRole("heading", { name: "Due now (1)" }),
  ).toBeInTheDocument();
  expect(screen.getByText(/You failed it/)).toBeInTheDocument();
  expect(screen.getByText(/Added by you.*Due 2026-10-13/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Remove Two Sum from your review queue" }));
  expect(removed).toBe(false);
  await user.click(screen.getByRole("button", { name: "Remove Two Sum from your review queue" }));
  expect(
    await screen.findByRole("heading", { name: "Due now (0)" }),
  ).toBeInTheDocument();
  expect(confirm).toHaveBeenCalledTimes(2);
});
it("distinguishes review empty from a failed queue with local retry", async () => {
  handler = () => ({ body: { error: "Queue offline" }, status: 503 });
  const user = userEvent.setup();
  render(<ReviewPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Queue offline");
  handler = () => ({
    body: {
      ...groupCQueue,
      due: [],
      upcoming: [],
      counts: { due: 0, total: 0 },
    },
  });
  await user.click(screen.getByRole("button", { name: "Retry review queue" }));
  expect(await screen.findByText(/Nothing to review yet/)).toBeInTheDocument();
});
it("places the personal path first and shows its focus breakdown and tags", async () => {
  const view = render(<PathsPage />);
  await screen.findAllByText("Personal");
  expect(screen.getAllByRole("heading", { level: 3 })[0]).toHaveTextContent(
    "My focus path",
  );
  expect(
    screen.getByRole("button", { name: "Rebuild my focus path" }),
  ).toBeInTheDocument();
  view.unmount();
  render(<PathPage />);
  expect(await screen.findByText("Built from")).toBeInTheDocument();
  expect(screen.getByText("Focus: Arrays")).toBeInTheDocument();
});
it("renders an owner's replay and loads résumé context before allowing Share", async () => {
  mocks.params.id = "s";
  render(<ReplayPage />);
  expect(
    await screen.findByRole("heading", { name: "google interview replay" }),
  ).toBeInTheDocument();
  await userEvent
    .setup()
    .click(await screen.findByRole("button", { name: "Share" }));
  expect(
    await screen.findByText(
      /questions in this interview may mention your résumé/,
    ),
  ).toBeInTheDocument();
});
it("keeps the public replay anonymous even with a viewer token and renders no viewer account", async () => {
  render(<PublicPage />);
  expect(await screen.findByText("Candidate Ada")).toBeInTheDocument();
  expect(requests).toHaveLength(1);
  expect(requests[0].headers.has("Authorization")).toBe(false);
  expect(requests[0].url).toContain("/public/interviews/public-token");
  expect(
    screen.queryByRole("link", { name: /settings/i }),
  ).not.toBeInTheDocument();
});
it("handles unknown/revoked public tokens and declares route-only privacy metadata", async () => {
  handler = () => ({ body: { error: "Not found" }, status: 404 });
  render(<PublicPage />);
  expect(
    await screen.findByText("This link doesn't exist or is no longer shared."),
  ).toBeInTheDocument();
  expect(metadata.robots).toEqual({ index: false, follow: false });
  expect(metadata.referrer).toBe("no-referrer");
});
it("shows assessment integrity after finishing", async () => {
  const original = handler;
  handler = (request) =>
    new URL(request.url).pathname.endsWith("/submit")
      ? {
          body: {
            score: 100,
            total: 1,
            passed: 1,
            status: "completed",
            integrity: groupCIntegrity,
          },
        }
      : original(request);
  render(<AssessmentPage />);
  await screen.findByRole("heading", { name: "Two Sum" });
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Finish assessment" }));
  expect(
    await screen.findByRole("heading", { name: "Integrity summary" }),
  ).toBeInTheDocument();
  expect(screen.getByText("1 minute 5 seconds")).toBeInTheDocument();
});

it("finishes an assessment without waiting for a slow proctoring request", async () => {
  let resolveEvents!: (response: Response) => void;
  const slowEvents = new Promise<Response>((resolve) => {
    resolveEvents = resolve;
  });
  const original = handler;
  handler = (request) =>
    new URL(request.url).pathname.endsWith("/submit")
      ? {
          body: {
            score: 0,
            total: 1,
            passed: 0,
            status: "completed",
            integrity: groupCIntegrity,
          },
        }
      : original(request);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      requests.push(request);
      if (new URL(request.url).pathname.endsWith("/events")) return slowEvents;
      const response = handler(request);
      return new Response(JSON.stringify(response.body), {
        status: response.status ?? 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  render(<AssessmentPage />);
  await screen.findByRole("heading", { name: "Two Sum" });
  fireEvent(window, new Event("blur"));
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Finish assessment" }));
  expect(
    await screen.findByRole("heading", { name: "Integrity summary" }),
  ).toBeInTheDocument();
  expect(requests.some((request) => request.url.endsWith("/events"))).toBe(
    true,
  );
  resolveEvents(
    new Response('{"recorded":1}', {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }),
  );
});

it("updates a rebuilt personal path even when its slug stays the same", async () => {
  const original = handler;
  handler = (request) =>
    request.url.endsWith("/learning-paths/generate")
      ? {
          body: {
            ...groupCPath,
            path: { ...groupCPath.path, title: "Rebuilt focus path" },
          },
          status: 201,
        }
      : original(request);
  render(<PathPage />);
  await screen.findByRole("heading", { name: "My focus path" });
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Rebuild my focus path" }));
  expect(
    await screen.findByRole("heading", { name: "Rebuilt focus path" }),
  ).toBeInTheDocument();
});
