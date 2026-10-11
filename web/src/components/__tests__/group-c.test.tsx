import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutputDiff } from "@/components/output-diff";
import { ReviewOutcome } from "@/components/review-outcome";
import { ReviewDue } from "@/components/review-due";
import { ProgressiveHints } from "@/components/progressive-hints";
import { CustomResults } from "@/components/custom-cases";
import { DailyProblemCard } from "@/components/daily-problem";
import { FocusTopics, GenerateFocusPath } from "@/components/focus-path";
import { ReplayTimeline } from "@/components/interview/replay-timeline";
import { InterviewHistory } from "@/components/interview/history";
import { ShareLinks } from "@/components/interview/share-links";
import { IntegritySummary } from "@/components/integrity-summary";
import { EmailConfirmation } from "@/components/email-confirmation";
import {
  groupCDaily,
  groupCIntegrity,
  groupCLink,
  groupCPath,
  groupCQueue,
  groupCReplay,
  groupCSession,
} from "@/test/group-c-fixtures";
import type { OutputDiff as Diff, ReviewOutcome as Outcome } from "@/lib/api";

const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav }));
const requests: Request[] = [];
let responder: (request: Request) => { body: unknown; status?: number };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
beforeEach(() => {
  requests.length = 0;
  nav.push.mockClear();
  nav.refresh.mockClear();
  responder = () => ({ body: { ok: true } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      requests.push(request);
      const result = responder(request);
      return json(result.body, result.status);
    }),
  );
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const diffs: [Diff, string][] = [
  [{ kind: "format" }, "The output isn't valid JSON"],
  [
    { kind: "type", path: [], expectedType: "array", actualType: "null" },
    "Expected an array, got null",
  ],
  [
    { kind: "value", path: [2, 1], expected: 4, actual: 5 },
    "First difference at [2][1]: expected 4, got 5",
  ],
  [
    { kind: "length", path: [1], expectedLength: 3, actualLength: 2 },
    "Expected 3 items, got 2 at [1]",
  ],
  [
    {
      kind: "items",
      missing: [1, 2],
      unexpected: [3],
      expectedLength: 3,
      actualLength: 2,
    },
    "Missing: [1,2] · Unexpected: [3]",
  ],
];
describe("output explanations", () => {
  it.each(diffs)("explains $0.kind", (diff, expected) => {
    render(<OutputDiff diff={diff} />);
    expect(screen.getByText(expected, { exact: false })).toBeInTheDocument();
  });
  it("marks the first differing character with words and handles a string ending", () => {
    const { container } = render(
      <OutputDiff
        diff={{
          kind: "value",
          path: [],
          expected: "cat",
          actual: "car",
          charIndex: 2,
        }}
      />,
    );
    expect(
      screen.getByText(/first difference at character 3/),
    ).toBeInTheDocument();
    expect(
      [...container.querySelectorAll("mark")].map((mark) => mark.textContent),
    ).toEqual(["t", "r"]);
  });
  it("shows the missing character at end of output", () => {
    render(
      <OutputDiff
        diff={{
          kind: "value",
          path: [1],
          expected: "abc",
          actual: "ab",
          charIndex: 2,
        }}
      />,
    );
    expect(screen.getByText("(end of string)")).toBeInTheDocument();
  });
  it("renders judged and unjudged custom results without conflating them", () => {
    render(
      <CustomResults
        results={[
          {
            input: "target = 6",
            judged: true,
            passed: false,
            expectedOutput: "4",
            actualOutput: "5",
            diff: diffs[2][0],
          },
          {
            input: "target = 7",
            judged: false,
            passed: false,
            inputError: "Reference unavailable",
            actualOutput: "7",
            error: "Timed out",
          },
        ]}
      />,
    );
    expect(
      screen.getByText("Expected (reference solution): 4"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Not judged: Reference unavailable/),
    ).toBeInTheDocument();
    expect(screen.getByText("Output: 7")).toBeInTheDocument();
    expect(screen.getByText("Error: Timed out")).toBeInTheDocument();
  });
});
const outcomes: [Outcome, string][] = [
  [
    { action: "enrolled", quality: 2, dueOn: "2026-10-12", intervalDays: 1 },
    "Added to your review queue — due 2026-10-12",
  ],
  [
    { action: "reviewed", quality: 5, dueOn: "2026-10-18", intervalDays: 7 },
    "Review recorded (5/5) — next review 2026-10-18",
  ],
  [
    { action: "lapsed", quality: 1, dueOn: "2026-10-12", intervalDays: 1 },
    "Back in your review queue — due tomorrow",
  ],
  [
    { action: "unchanged", dueOn: "2026-10-18" },
    "Already in your review queue — due 2026-10-18",
  ],
];
it.each(outcomes)("renders review outcome $0.action", (outcome, line) => {
  render(<ReviewOutcome outcome={outcome} />);
  expect(screen.getByText(line, { exact: false })).toBeInTheDocument();
  expect(screen.getByRole("link")).toHaveAttribute("href", "/review");
});
it("renders nothing for a null review outcome", () => {
  expect(
    render(<ReviewOutcome outcome={null} />).container,
  ).toBeEmptyDOMElement();
});
it.each([true, false])(
  "reports hints only signed in (%s), never on reset",
  async (signedIn) => {
    if (signedIn) localStorage.setItem("if-token", "token");
    const user = userEvent.setup();
    render(<ProgressiveHints problemId="p" hints={["First", "Second"]} />);
    await user.click(screen.getByRole("button", { name: "Show hint 1" }));
    await user.click(screen.getByRole("button", { name: "Show hint 2" }));
    await user.click(screen.getByRole("button", { name: "Reset hints" }));
    expect(requests.length).toBe(signedIn ? 2 : 0);
    if (signedIn)
      expect(
        await Promise.all(requests.map((request) => request.json())),
      ).toEqual([{ count: 1 }, { count: 2 }]);
  },
);
it.each([true, false])(
  "shows daily personal badges only signed in (%s)",
  (signedIn) => {
    render(<DailyProblemCard day={groupCDaily} signedIn={signedIn} />);
    expect(screen.getByRole("link", { name: "Solve" })).toHaveAttribute(
      "href",
      "/problems/p",
    );
    expect(Boolean(screen.queryByText("Solved today"))).toBe(signedIn);
    expect(Boolean(screen.queryByText("3-day streak · best 7"))).toBe(signedIn);
  },
);
it("navigates to a newly generated personal path", async () => {
  responder = () => ({ body: groupCPath, status: 201 });
  render(<GenerateFocusPath />);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Build my focus path" }));
  expect(nav.push).toHaveBeenCalledWith("/paths/my-focus");
  expect(requests[0].method).toBe("POST");
});
it.each(["not_enough_history", "no_weak_topics", "nothing_left_to_practise"])(
  "shows server path conflict message for %s",
  async (code) => {
    responder = () => ({
      body: { error: `Message for ${code}`, code },
      status: 409,
    });
    render(<GenerateFocusPath rebuild />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Rebuild my focus path" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      `Message for ${code}`,
    );
  },
);
it("explains what the focus path was built from", () => {
  render(<FocusTopics topics={groupCPath.path.focusTopics!} />);
  expect(screen.getByText(/3 of 4 submissions failed/)).toBeInTheDocument();
  expect(screen.getByText("Score 0.80")).toBeInTheDocument();
});
it("lists completed and active interviews with links only for completed sessions", async () => {
  responder = () => ({
    body: {
      sessions: [
        groupCSession,
        { ...groupCSession, id: "active", company: "meta", status: "active" },
      ],
    },
  });
  render(<InterviewHistory />);
  expect(await screen.findByRole("link", { name: "Replay" })).toHaveAttribute(
    "href",
    "/interview/s",
  );
  expect(screen.getByText("In progress")).toBeInTheDocument();
  expect(screen.getAllByRole("link")).toHaveLength(1);
});
it("shows stages, offsets, pushback, hint penalties and the report", () => {
  render(<ReplayTimeline replay={groupCReplay} />);
  expect(screen.getByText("02:00")).toBeInTheDocument();
  expect(screen.getByText("Pushed back")).toBeInTheDocument();
  expect(screen.getByText("Hint 2")).toBeInTheDocument();
  expect(screen.getByText(/Hint penalty: 2/)).toBeInTheDocument();
  expect(screen.getByText("Overall score: 7/10")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "coding" })).toBeInTheDocument();
});
it("plays compressed offsets, pauses and shows all without live announcements", async () => {
  vi.useFakeTimers();
  const { container } = render(<ReplayTimeline replay={groupCReplay} />);
  fireEvent.click(screen.getByRole("button", { name: "Play" }));
  expect(screen.queryByText("Solve Two Sum.")).not.toBeInTheDocument();
  await act(async () => vi.advanceTimersByTime(2000));
  expect(screen.getByText(/I clarified/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  await act(async () => vi.advanceTimersByTime(10000));
  expect(
    screen.queryByText("How did you measure the impact?"),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Speed"), { target: { value: "4" } });
  fireEvent.click(screen.getByRole("button", { name: "Play" }));
  await act(async () => vi.advanceTimersByTime(25));
  expect(
    screen.getByText("How did you measure the impact?"),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show all" }));
  expect(screen.getByText("Solve Two Sum.")).toBeInTheDocument();
  expect(container.querySelector("[aria-live]")).toBeNull();
});
it("shows everything with reduced motion and disables playback", () => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
  render(<ReplayTimeline replay={groupCReplay} />);
  expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
  expect(screen.getByText("Solve Two Sum.")).toBeInTheDocument();
});
it("warns before creating and shows a share token only in that dialog", async () => {
  responder = (request) =>
    request.method === "GET"
      ? { body: { links: [] } }
      : {
          status: 201,
          body: {
            link: groupCLink,
            token: "one-time-token",
            resumeGrounded: true,
          },
        };
  const user = userEvent.setup();
  render(<ShareLinks id="s" resumeGrounded />);
  await screen.findByText("No active share links.");
  await user.click(screen.getByRole("button", { name: "Share" }));
  const dialog = screen.getByRole("dialog");
  expect(
    within(dialog).getByText(
      "The questions in this interview may mention your résumé.",
    ),
  ).toBeInTheDocument();
  expect(requests.filter((request) => request.method === "POST")).toHaveLength(
    0,
  );
  await user.type(screen.getByLabelText("Display name (optional)"), "Ada");
  await user.selectOptions(screen.getByLabelText("Expires after"), "never");
  await user.click(screen.getByRole("button", { name: "Create share link" }));
  expect(await screen.findByLabelText("Share URL")).toHaveValue(
    `${window.location.origin}/share/one-time-token`,
  );
  expect(screen.getByText("You won't see this link again")).toBeInTheDocument();
  expect(
    await requests.find((request) => request.method === "POST")!.json(),
  ).toEqual({ displayName: "Ada", expiresInDays: null });
  await user.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByLabelText("Share URL")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Share" }));
  expect(screen.queryByLabelText("Share URL")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Create share link" }),
  ).toBeInTheDocument();
});
it.each(["report_not_ready", "too_many_links"])(
  "shows sharing conflicts %s",
  async (code) => {
    responder = (request) =>
      request.method === "GET"
        ? { body: { links: [] } }
        : { body: { error: "Five active links", code }, status: 409 };
    const user = userEvent.setup();
    render(<ShareLinks id="s" resumeGrounded={false} />);
    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(screen.getByRole("button", { name: "Create share link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      code === "report_not_ready"
        ? "Generate the report first"
        : "Five active links",
    );
    if (code === "report_not_ready")
      expect(
        screen.getByRole("link", { name: "Back to interview" }),
      ).toHaveAttribute("href", "/interview");
  },
);
it("confirms before revoking a link and refreshes the active list", async () => {
  let revoked = false;
  responder = (request) => {
    if (request.method === "DELETE") revoked = true;
    return {
      body:
        request.method === "GET"
          ? { links: revoked ? [] : [groupCLink] }
          : { ok: true },
    };
  };
  const confirm = vi
    .spyOn(window, "confirm")
    .mockReturnValueOnce(false)
    .mockReturnValueOnce(true);
  const user = userEvent.setup();
  render(<ShareLinks id="s" resumeGrounded={false} />);
  await user.click(await screen.findByRole("button", { name: "Revoke …ab3d" }));
  expect(revoked).toBe(false);
  await user.click(screen.getByRole("button", { name: "Revoke …ab3d" }));
  expect(await screen.findByText("No active share links.")).toBeInTheDocument();
  expect(confirm).toHaveBeenCalledTimes(2);
  confirm.mockRestore();
});
it.each([
  [0, "0 reviews due"],
  [1, "1 review due"],
  [2, "2 reviews due"],
])("labels the dashboard review link for %i due", async (due, name) => {
  responder = () => ({ body: { ...groupCQueue, counts: { due, total: due } } });
  render(<ReviewDue />);
  expect(await screen.findByRole("link", { name })).toHaveAttribute("href", "/review");
});

it.each([
  [0, "0 seconds"],
  [1, "1 second"],
  [45, "45 seconds"],
  [60, "1 minute"],
  [61, "1 minute 1 second"],
  [120, "2 minutes"],
  [125, "2 minutes 5 seconds"],
])("formats %i seconds away as %s", (hiddenSeconds, expected) => {
  render(<IntegritySummary integrity={{ ...groupCIntegrity, hiddenSeconds }} />);
  const row = screen.getByText("Time away").parentElement!;
  expect(within(row).getByText(expected)).toBeInTheDocument();
});

it.each([
  [0, "0 characters"],
  [1, "1 character"],
  [21, "21 characters"],
])("formats paste character counts for %i characters", (characters, expected) => {
  render(<IntegritySummary integrity={{
    ...groupCIntegrity, pastedChars: characters, largestPaste: characters,
  }} />);
  const pastes = screen.getByText("Pastes").parentElement!;
  const largest = screen.getByText("Largest paste").parentElement!;
  expect(within(pastes).getByText(`2 (${expected})`)).toBeInTheDocument();
  expect(within(largest).getByText(expected)).toBeInTheDocument();
});

it("summarizes integrity neutrally", () => {
  const { container } = render(
    <IntegritySummary integrity={groupCIntegrity} />,
  );
  expect(screen.getByText("1 minute 5 seconds")).toBeInTheDocument();
  expect(screen.getByText("2 (240 characters)")).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Worth reviewing" }),
  ).toBeInTheDocument();
  expect(container.querySelector(".text-error")).toBeNull();
});
it("dismisses the email banner", async () => {
  render(
    <EmailConfirmation email="ada@example.test" confirmed={false} banner />,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Dismiss email reminder" }));
  expect(
    screen.queryByRole("region", { name: "Email confirmation" }),
  ).not.toBeInTheDocument();
});
it("resends verification and reports it as queued/sent", async () => {
  render(
    <EmailConfirmation email="ada@example.test" confirmed={false} banner />,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Resend email" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Sent — check your inbox and Spam",
  );
});
it("counts down a 429 and re-enables resend", async () => {
  vi.useFakeTimers();
  responder = () => ({
    body: { error: "Wait", retryAfterSeconds: 3 },
    status: 429,
  });
  render(<EmailConfirmation email="ada@example.test" confirmed={false} />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Resend email" }));
  });
  expect(screen.getByRole("status")).toHaveTextContent(
    "You can resend in 3 seconds",
  );
  expect(screen.getByRole("button", { name: "Resend email" })).toBeDisabled();
  await act(async () => vi.advanceTimersByTime(1000));
  expect(screen.getByRole("status")).toHaveTextContent("2 seconds");
  await act(async () => vi.advanceTimersByTime(2000));
  expect(screen.getByRole("button", { name: "Resend email" })).toBeEnabled();
});
it("treats already_verified as confirmed", async () => {
  responder = () => ({
    body: { error: "Already verified", code: "already_verified" },
    status: 409,
  });
  render(<EmailConfirmation email="ada@example.test" confirmed={false} />);
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Resend email" }));
  expect(await screen.findByText("Confirmed")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Resend email" }),
  ).not.toBeInTheDocument();
});

it("shows a dashboard email banner as confirmed on already_verified", async () => {
  responder = () => ({
    body: { error: "Already verified", code: "already_verified" },
    status: 409,
  });
  render(
    <EmailConfirmation email="ada@example.test" confirmed={false} banner />,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Resend email" }));
  expect(await screen.findByText("Confirmed")).toBeInTheDocument();
  expect(screen.queryByText(/Confirm your email/)).not.toBeInTheDocument();
});
