import { transferableAbortController } from "node:util";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ComplexityPanel, ComplexityResult } from "../complexity-panel";
import { NextUp, RatingOutcome, RatingsSection } from "../ratings";
import { complexity, rating } from "@/test/group-d-fixtures";
import type { ComplexityAnalysis } from "@/lib/api";

vi.mock("recharts", () => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    ResponsiveContainer: Wrapper,
    LineChart: Wrapper,
    Line: () => null,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
  };
});
let handler: (request: Request) => { body: unknown; status?: number };
let requests: Request[];
beforeEach(() => {
  vi.stubGlobal(
    "AbortController",
    class {
      constructor() {
        return transferableAbortController();
      }
    },
  );
  requests = [];
  localStorage.setItem("if-token", "test-token");
  handler = () => ({ body: { available: true, analysis: complexity } });
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
describe("empirical complexity", () => {
  it("retains every candidate and supplies matching accessible times", () => {
    render(<ComplexityResult analysis={complexity} />);
    expect(
      screen.getByRole("heading", { name: "O(n) or O(n log n)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/memory effects are as large as a log factor/),
    ).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Measured times" });
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(within(table).getByText("1.2 µs")).toBeInTheDocument();
    expect(within(table).getByText("1.2 ms")).toBeInTheDocument();
  });
  it.each([
    ["too_fast", /Runs in microseconds at every size: constant or logarithmic/],
    ["too_few_sizes", /Not enough sizes finished/],
  ] as const)("explains inconclusive %s", (reason, message) => {
    render(
      <ComplexityResult
        analysis={{
          ...complexity,
          fit: {
            status: "inconclusive",
            reason,
            candidates: ["O(1)", "O(log n)"],
            points: [],
          },
        }}
      />,
    );
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByText("No timings were collected.")).toBeInTheDocument();
  });
  it("explains the partial fit after a timeout", () => {
    render(
      <ComplexityResult analysis={{ ...complexity, stopped: "time_limit" }} />,
    );
    expect(
      screen.getByText(/largest sizes didn't finish in 20 s/),
    ).toBeInTheDocument();
  });
  it("shows execution error and failed size", () => {
    render(
      <ComplexityResult
        analysis={{
          ...complexity,
          stopped: "error",
          error: "Sandbox failure",
          errorAtN: 2048,
        }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Sandbox failure at n = 2,048",
    );
  });
  it.each([
    ["agrees", "The measurement found exactly this."],
    ["consistent", "One of the classes the data allows."],
    ["log_factor", "Differs only by a log factor."],
    ["disagrees", "The measured classes disagree with this claim."],
    [
      "not_comparable",
      "No claim yet or nothing measured that can be compared.",
    ],
  ] as const)("explains claim verdict %s", (verdict, message) => {
    render(
      <ComplexityResult
        analysis={{ ...complexity, claim: { ...complexity.claim, verdict } }}
      />,
    );
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByText("Claim: O(n)")).toBeInTheDocument();
  });
  it("shows a stored analysis without running a new measurement", async () => {
    render(<ComplexityPanel submissionId="s" />);
    await screen.findByRole("heading", { name: "O(n) or O(n log n)" });
    expect(requests.map((r) => r.method)).toEqual(["GET"]);
    expect(
      screen.getByRole("button", { name: "Measure again" }),
    ).toBeInTheDocument();
  });
  it("only offers measurement when available", async () => {
    handler = () => ({ body: { available: false, analysis: null } });
    render(<ComplexityPanel submissionId="s" />);
    await screen.findByText(/unavailable for this problem/);
    expect(
      screen.queryByRole("button", { name: /Measure/ }),
    ).not.toBeInTheDocument();
  });
  it("recovers a failed availability request locally", async () => {
    handler = () => ({ status: 502, body: { error: "Availability offline" } });
    render(<ComplexityPanel submissionId="s" />);
    await screen.findByText("Availability offline");
    handler = () => ({ body: { available: true, analysis: null } });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Retry complexity" }));
    expect(
      await screen.findByRole("button", { name: "Measure time complexity" }),
    ).toBeInTheDocument();
  });
  it.each([
    [400, false, "Accepted submissions only"],
    [429, false, "Ten measurements per 15 minutes"],
    [503, true, "Queue unavailable"],
    [503, false, "Timing unavailable"],
    [502, false, "Runner failed"],
  ])(
    "handles %i retryable=%s without automatic retries",
    async (status, retryable, error) => {
      handler = (request) =>
        request.method === "POST"
          ? { status, body: { error, retryable } }
          : { body: { available: true, analysis: null } };
      render(<ComplexityPanel submissionId="s" />);
      await userEvent.setup().click(
        await screen.findByRole("button", {
          name: "Measure time complexity",
        }),
      );
      await screen.findByText(error);
      expect(
        Boolean(screen.queryByRole("button", { name: "Retry measurement" })),
      ).toBe(status === 503 && retryable);
      expect(requests.filter((r) => r.method === "POST")).toHaveLength(1);
      if (retryable) {
        handler = (request) => ({
          body:
            request.method === "POST"
              ? { analysis: complexity }
              : { available: true, analysis: null },
        });
        await userEvent
          .setup()
          .click(screen.getByRole("button", { name: "Retry measurement" }));
        await screen.findByRole("heading", { name: "O(n) or O(n log n)" });
      }
    },
  );
  it("aborts measurement on navigation and exposes a nonblocking progress message", async () => {
    handler = () => ({ body: { available: true, analysis: null } });
    const view = render(<ComplexityPanel submissionId="s" />);
    await screen.findByRole("button", { name: "Measure time complexity" });
    vi.stubGlobal(
      "fetch",
      vi.fn((request: Request) => {
        requests.push(request);
        return new Promise(() => {});
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Measure time complexity" }),
    );
    expect(
      screen.getByText(/Timing your code on doubling input sizes/),
    ).toBeInTheDocument();
    expect(requests.at(-1)?.signal.aborted).toBe(false);
    view.unmount();
    expect(requests.at(-1)?.signal.aborted).toBe(true);
  });
  it("cancels the active request locally", async () => {
    handler = () => ({ body: { available: true, analysis: null } });
    render(<ComplexityPanel submissionId="s" />);
    await screen.findByRole("button", { name: "Measure time complexity" });
    vi.stubGlobal(
      "fetch",
      vi.fn((request: Request) => {
        requests.push(request);
        return new Promise(() => {});
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Measure time complexity" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel request" }));
    expect(requests.at(-1)?.signal.aborted).toBe(true);
    expect(screen.queryByText(/Timing your code/)).not.toBeInTheDocument();
  });
  it("runs a stored AI review and fetches the updated comparison", async () => {
    let reviewed = false;
    const withoutClaim: ComplexityAnalysis = {
      ...complexity,
      claim: { text: null, class: null, verdict: "not_comparable" },
    };
    handler = (request) => {
      if (request.method === "POST") {
        reviewed = true;
        return { body: { review: {} } };
      }
      return {
        body: {
          available: true,
          analysis: reviewed ? complexity : withoutClaim,
        },
      };
    };
    render(<ComplexityPanel submissionId="s" />);
    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Run AI review" }));
    expect(await screen.findByText("Claim: O(n)")).toBeInTheDocument();
    expect(requests.map((r) => [r.method, new URL(r.url).pathname])).toEqual([
      ["GET", "/api/submissions/s/complexity"],
      ["POST", "/api/submissions/s/review"],
      ["GET", "/api/submissions/s/complexity"],
    ]);
  });
  it("ignores a previous submission's late response", async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn((request: Request) =>
        request.url.includes("/s/")
          ? new Promise<Response>((r) => {
              resolve = r;
            })
          : Promise.resolve(
              new Response(JSON.stringify({ available: true, analysis: null })),
            ),
      ),
    );
    const view = render(<ComplexityPanel submissionId="s" />);
    view.rerender(<ComplexityPanel submissionId="new" />);
    await screen.findByRole("button", { name: "Measure time complexity" });
    await act(async () =>
      resolve(
        new Response(JSON.stringify({ available: true, analysis: complexity })),
      ),
    );
    expect(screen.queryByText("O(n) or O(n log n)")).not.toBeInTheDocument();
  });
});
describe("Elo and adaptive picks", () => {
  it("renders a first-submit rating and hints score; null adds nothing", () => {
    const view = render(<RatingOutcome outcome={{ ...rating, score: 0.5 }} />);
    expect(screen.getByText("+6 rating")).toBeInTheDocument();
    expect(
      screen.getByText(/85% predicted to pass first time/),
    ).toHaveTextContent("passed after viewing hints");
    view.rerender(<RatingOutcome outcome={null} />);
    expect(view.container).toBeEmptyDOMElement();
  });
  it("shows a negative change", () => {
    render(<RatingOutcome outcome={{ ...rating, score: 0, delta: -12 }} />);
    expect(screen.getByText("-12 rating")).toBeInTheDocument();
  });
  it("links picks, includes percentages, and applies and clears a topic filter", async () => {
    handler = () => ({
      body: {
        target: 0.65,
        picks: [
          {
            problem: {
              id: "p",
              title: "Two Sum",
              difficulty: "easy",
              topics: ["Arrays"],
            },
            predictedSuccess: 0.68,
          },
        ],
      },
    });
    render(<NextUp />);
    expect(
      await screen.findByRole("link", { name: "Two Sum" }),
    ).toHaveAttribute("href", "/problems/p");
    expect(
      screen.getByText("68% predicted to pass first time"),
    ).toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Topic filter (optional)"), "Arrays");
    await user.click(screen.getByRole("button", { name: "Apply topic" }));
    await waitFor(() =>
      expect(new URL(requests.at(-1)!.url).searchParams.get("topic")).toBe(
        "Arrays",
      ),
    );
    await user.click(screen.getByRole("button", { name: "Clear topic" }));
    await waitFor(() =>
      expect(new URL(requests.at(-1)!.url).searchParams.has("topic")).toBe(
        false,
      ),
    );
  });
  it("distinguishes pick errors from an empty selection", async () => {
    handler = () => ({ status: 500, body: { error: "Picks offline" } });
    render(<NextUp />);
    await screen.findByText("Picks offline");
    handler = () => ({ body: { target: 0.65, picks: [] } });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Retry picks" }));
    expect(
      await screen.findByText("Nothing left in this selection"),
    ).toBeInTheDocument();
  });
  it("sorts topic ratings by games and marks provisional values", async () => {
    handler = () => ({
      body: {
        overall: { rating: 1512, games: 12 },
        topics: [
          { topic: "Graphs", rating: 1480, games: 2 },
          { topic: "Arrays", rating: 1540, games: 10 },
        ],
      },
    });
    render(<RatingsSection />);
    await screen.findByText(/Overall: 1512/);
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
    ).toEqual(["Arrays", "Graphs"]);
    expect(screen.getAllByText("Provisional")).toHaveLength(1);
  });
  it("provides a new-user rating state and recovers from a failed fetch", async () => {
    handler = () => ({ status: 500, body: { error: "Ratings offline" } });
    render(<RatingsSection />);
    await screen.findByText("Ratings offline");
    handler = () => ({
      body: { overall: { rating: 1500, games: 0 }, topics: [] },
    });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Retry ratings" }));
    expect(
      await screen.findByText(
        "Your first Submit of any problem starts your rating",
      ),
    ).toBeInTheDocument();
  });
});

it("refreshes the stored comparison after another review completes", async () => {
  const view = render(<ComplexityPanel submissionId="s" reviewVersion={0} />);
  await screen.findByText("Claim: O(n)");
  handler = () => ({
    body: {
      available: true,
      analysis: {
        ...complexity,
        claim: { text: "O(n²)", class: "O(n²)", verdict: "disagrees" },
      },
    },
  });
  view.rerender(<ComplexityPanel submissionId="s" reviewVersion={1} />);
  await screen.findByText("Claim: O(n²)");
  expect(screen.queryByText("Claim: O(n)")).not.toBeInTheDocument();
  expect(requests).toHaveLength(2);
  expect(
    screen.getByText("The measured classes disagree with this claim."),
  ).toBeInTheDocument();
});

it("retries a failed AI comparison through the review endpoint", async () => {
  const withoutClaim = {
    ...complexity,
    claim: { text: null, class: null, verdict: "not_comparable" },
  };
  handler = (r) =>
    r.method === "POST"
      ? { status: 503, body: { error: "Review unavailable", retryable: true } }
      : { body: { available: true, analysis: withoutClaim } };
  render(<ComplexityPanel submissionId="s" />);
  await userEvent
    .setup()
    .click(await screen.findByRole("button", { name: "Run AI review" }));
  await screen.findByText("Review unavailable");
  handler = (r) => ({
    body:
      r.method === "POST"
        ? { review: {} }
        : { available: true, analysis: complexity },
  });
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Retry AI review" }));
  await screen.findByText("Claim: O(n)");
  expect(
    requests
      .filter((r) => r.method === "POST")
      .map((r) => new URL(r.url).pathname),
  ).toEqual(["/api/submissions/s/review", "/api/submissions/s/review"]);
});
