import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { io } from "socket.io-client";
import PeerPage from "../peer/page";
import JoinPage from "../peer/join/page";
import RoomPage from "../peer/[id]/page";
import ProblemPage from "../problems/[id]/page";
import LoginPage from "../login/page";
import { peerSession, rating } from "@/test/group-d-fixtures";
import { groupCProblem } from "@/test/group-c-fixtures";
import {
  installPeerMocks,
  MockPeer,
  MockSocket,
  MockStream,
} from "@/test/peer-mocks";
import type { PeerSession } from "@/lib/api";
const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  params: { id: "peer-id" },
}));
vi.mock("next/navigation", () => ({
  useParams: () => navigation.params,
  useRouter: () => navigation,
}));
vi.mock("socket.io-client", () => ({ io: vi.fn() }));
vi.mock("@/components/layout/page-shell", () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("@/components/ui/theme-provider", () => ({
  useTheme: () => ({ theme: "light", mounted: true }),
}));
vi.mock("next/dynamic", () => ({
  default: () =>
    function Editor({
      value,
      onChange,
      readOnly,
    }: {
      value: string;
      onChange: (value: string) => void;
      readOnly?: boolean;
    }) {
      return (
        <textarea
          aria-label="Code editor"
          value={value}
          readOnly={readOnly}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
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
let socket: MockSocket;
let session: PeerSession;
let getUserMedia: ReturnType<typeof installPeerMocks>;
let requests: Request[];
let handler: (request: Request) => { body: unknown; status?: number };
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
  navigation.params.id = "peer-id";
  localStorage.setItem("if-token", "test-token");
  session = { ...peerSession };
  requests = [];
  socket = new MockSocket();
  vi.mocked(io).mockReturnValue(socket as unknown as ReturnType<typeof io>);
  getUserMedia = installPeerMocks();
  handler = (request) => {
    const path = new URL(request.url).pathname;
    if (path.endsWith("/ice-servers"))
      return {
        body: { iceServers: [{ urls: ["stun:example.org"] }], expiresAt: null },
      };
    if (path.endsWith("/peer-sessions") && request.method === "GET")
      return { body: { sessions: [] } };
    if (path.endsWith("/peer-sessions") && request.method === "POST")
      return {
        body: { session, inviteToken: "single-seat-token" },
        status: 201,
      };
    if (path.endsWith("/problems"))
      return { body: { problems: [groupCProblem] } };
    if (path.endsWith("/join")) return { body: { session } };
    if (path.endsWith("/feedback")) {
      session = {
        ...session,
        feedback: {
          ...session.feedback,
          given: {
            ratings: { clarity: 4 },
            notes: "Helpful",
            createdAt: "2026-10-11",
          },
        },
      };
      return { body: { session } };
    }
    return { body: { session } };
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("peer hosting and invites", () => {
  it("creates a role/problem/duration invite, shows a fragment once, and clears it on dismissal", async () => {
    const user = userEvent.setup();
    const view = render(<PeerPage />);
    await screen.findByText("No peer interviews yet");
    await user.selectOptions(screen.getByLabelText("Your role"), "candidate");
    await user.type(screen.getByLabelText("Search problems (optional)"), "Two");
    await user.selectOptions(screen.getByLabelText("Problem (optional)"), "p");
    fireEvent.change(screen.getByLabelText("Duration (minutes)"), {
      target: { value: "60" },
    });
    await user.click(screen.getByRole("button", { name: "Create invite" }));
    expect(await screen.findByLabelText("Invite link")).toHaveValue(
      "http://localhost:3000/peer/join#single-seat-token",
    );
    expect(screen.getByText(/seats exactly one person/)).toBeInTheDocument();
    const request = requests.find((r) => r.method === "POST")!;
    expect(await request.json()).toEqual({
      role: "candidate",
      problemId: "p",
      durationMinutes: 60,
    });
    await user.click(screen.getByRole("button", { name: "Copy invite" }));
    expect(
      await screen.findByRole("button", { name: "Copied" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open room" })).toHaveAttribute(
      "href",
      "/peer/peer-id",
    );
    await user.click(screen.getByRole("button", { name: "Dismiss invite" }));
    expect(screen.queryByLabelText("Invite link")).not.toBeInTheDocument();
    view.unmount();
    render(<PeerPage />);
    await screen.findByText("No peer interviews yet");
    expect(screen.queryByLabelText("Invite link")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("single-seat-token")).toBeNull();
  });
  it("sends the default 45 minutes with no optional problem", async () => {
    render(<PeerPage />);
    await screen.findByText("No peer interviews yet");
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Create invite" }));
    await screen.findByLabelText("Invite link");
    expect(await requests.find((r) => r.method === "POST")!.json()).toEqual({
      role: "interviewer",
      durationMinutes: 45,
    });
  });
  it("shows the backend's open-invite conflict and permits another attempt", async () => {
    const original = handler;
    handler = (r) =>
      r.method === "POST"
        ? { status: 409, body: { error: "You already have 5 open invites" } }
        : original(r);
    render(<PeerPage />);
    await screen.findByText("No peer interviews yet");
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Create invite" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "5 open invites",
    );
    expect(screen.getByRole("button", { name: "Create invite" })).toBeEnabled();
  });
  it("distinguishes missing problem choices and session failures from empty data", async () => {
    handler = () => ({ status: 503, body: { error: "Service offline" } });
    render(<PeerPage />);
    expect(
      await screen.findByRole("button", { name: "Retry sessions" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retry problems" }),
    ).toBeInTheDocument();
    handler = (request) => ({
      body: request.url.endsWith("/problems")
        ? { problems: [] }
        : { sessions: [] },
    });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Retry sessions" }));
    await screen.findByText("No peer interviews yet");
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Retry problems" }));
    await screen.findByLabelText("Problem (optional)");
  });
  it("lists each session's status, role, partner, problem and times", async () => {
    const original = handler;
    handler = (r) =>
      r.url.endsWith("/peer-sessions")
        ? {
            body: {
              sessions: [
                session,
                {
                  ...session,
                  id: "done",
                  status: "completed",
                  startedAt: "2026-10-11T20:00:00Z",
                  endedAt: "2026-10-11T20:45:00Z",
                },
              ],
            },
          }
        : original(r);
    render(<PeerPage />);
    await screen.findByRole("link", { name: "View feedback" });
    expect(screen.getByRole("link", { name: "Open room" })).toHaveAttribute(
      "href",
      "/peer/peer-id",
    );
    expect(screen.getAllByText("Partner: Grace")).toHaveLength(2);
    expect(screen.getByText(/Started/)).toBeInTheDocument();
    expect(screen.getByText(/Ended/)).toBeInTheDocument();
  });
});
describe("join flow", () => {
  it("reads and clears the hash before posting, even in Strict Mode", async () => {
    const { StrictMode } = await import("react");
    window.history.replaceState(null, "", "/peer/join#one-seat");
    const original = handler;
    handler = (request) => {
      expect(window.location.hash).toBe("");
      return original(request);
    };
    render(
      <StrictMode>
        <JoinPage />
      </StrictMode>,
    );
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith("/peer/peer-id"),
    );
    expect(requests).toHaveLength(1);
    expect(await requests[0].json()).toEqual({ token: "one-seat" });
  });
  it.each([
    [404, "This invite doesn't exist or is no longer open."],
    [409, "This interview already has both participants."],
  ])("maps %i into a single invite message", async (status, message) => {
    window.history.replaceState(null, "", "/peer/join#bad");
    handler = () => ({
      status: Number(status),
      body: { error: "Backend detail" },
    });
    render(<JoinPage />);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Retry join" }),
    ).not.toBeInTheDocument();
    expect(window.location.hash).toBe("");
  });
  it("handles no invite without posting", async () => {
    render(<JoinPage />);
    await screen.findByText("This invite doesn't exist or is no longer open.");
    expect(requests).toHaveLength(0);
  });
  it("retains the invite only in the tab while signing in, then resumes it", async () => {
    localStorage.clear();
    window.history.replaceState(null, "", "/peer/join#pending-invite");
    const view = render(<JoinPage />);
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith(
        "/login?next=%2Fpeer%2Fjoin",
      ),
    );
    expect(window.location.hash).toBe("");
    expect(sessionStorage.getItem("if-peer-pending-invite")).toBe(
      "pending-invite",
    );
    expect(requests).toHaveLength(0);
    view.unmount();
    localStorage.setItem("if-token", "signed-in");
    render(<JoinPage />);
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith("/peer/peer-id"),
    );
    expect(await requests[0].json()).toEqual({ token: "pending-invite" });
    expect(sessionStorage.getItem("if-peer-pending-invite")).toBeNull();
  });
  it("recovers a transient join error", async () => {
    window.history.replaceState(null, "", "/peer/join#invite");
    handler = () => ({ status: 503, body: { error: "Join unavailable" } });
    render(<JoinPage />);
    await screen.findByText("Join unavailable");
    handler = () => ({ body: { session } });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Retry join" }));
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith("/peer/peer-id"),
    );
  });
  it("returns to peer join after login and rejects arbitrary next destinations", async () => {
    window.history.replaceState(null, "", "/login?next=%2Fpeer%2Fjoin");
    handler = () => ({ body: { token: "new-token" } });
    render(<LoginPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email or username"), "ada");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(navigation.push).toHaveBeenCalledWith("/peer/join"),
    );
  });
});
describe("peer room UI", () => {
  it("shows presence, problem and server clock with no media access", async () => {
    render(<RoomPage />);
    await screen.findByRole("heading", { name: "Peer interview room" });
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(screen.getByText("waiting for your partner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Two Sum" })).toHaveAttribute(
      "href",
      "/problems/p",
    );
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    act(() => {
      socket.fire("presence", { interviewer: true, candidate: true });
      socket.fire("started", {
        startedAt: new Date(now).toISOString(),
        endsAt: new Date(now + 65000).toISOString(),
      });
    });
    expect(
      screen.getByText(/Interviewer: in the room · Candidate: in the room/),
    ).toBeInTheDocument();
    expect(screen.getByText(/1:0[56] remaining/)).toBeInTheDocument();
    vi.spyOn(Date, "now").mockReturnValue(now + 66000);
    act(() => socket.fire("presence", { interviewer: true, candidate: false }));
    expect(
      screen.getByText(/Waiting for the server to confirm the end/),
    ).toBeInTheDocument();
    expect(socket.emit.mock.calls.some(([e]) => e === "end")).toBe(false);
  });
  it.each(["invalid", "not_found", "ended", "unavailable"])(
    "shows a recoverable %s room join ack",
    async (code) => {
      socket.joinAck = { ok: false, code, error: "Join failed" };
      render(<RoomPage />);
      expect(await screen.findByRole("alert")).toHaveTextContent("Join failed");
      expect(
        screen.getAllByRole("button", { name: "Retry connection" }).length,
      ).toBeGreaterThan(0);
      expect(screen.getByText(/relay \(TURN\)/)).toBeInTheDocument();
    },
  );
  it("distinguishes a missing room from an error and retries errors", async () => {
    handler = () => ({ status: 503, body: { error: "Room offline" } });
    render(<RoomPage />);
    await screen.findByText("Room offline");
    handler = () => ({ status: 404, body: { error: "Not found" } });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Retry room" }));
    expect(
      await screen.findByText("Peer interview not found"),
    ).toBeInTheDocument();
    expect(io).not.toHaveBeenCalled();
  });
  it("shares code and language and applies partner updates", async () => {
    render(<RoomPage />);
    await screen.findByLabelText("Code editor");
    const user = userEvent.setup();
    fireEvent.change(screen.getByLabelText("Code editor"), {
      target: { value: "local code" },
    });
    await user.selectOptions(screen.getByLabelText("Language"), "rust");
    await waitFor(() =>
      expect(socket.emit).toHaveBeenCalledWith("code", {
        code: "local code",
        language: "rust",
      }),
    );
    act(() =>
      socket.fire("code", {
        from: "partner",
        code: "remote code",
        language: "go",
      }),
    );
    expect(screen.getByLabelText("Code editor")).toHaveValue("remote code");
    expect(screen.getByLabelText("Language")).toHaveValue("go");
    act(() =>
      socket.fire("peer_error", {
        code: "not_joined",
        error: "Please join the room",
      }),
    );
    expect(screen.getByText("Please join the room")).toBeInTheDocument();
  });
  it("only requests microphone and camera on explicit clicks, then supports mute/off", async () => {
    render(<RoomPage />);
    await screen.findByRole("heading", { name: "Peer interview room" });
    expect(getUserMedia).not.toHaveBeenCalled();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Turn on microphone" }),
    );
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
    await user.click(
      await screen.findByRole("button", { name: "Mute microphone" }),
    );
    expect(
      screen.getByRole("button", { name: "Unmute microphone" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Turn on camera" }));
    expect(getUserMedia).toHaveBeenCalledWith({ audio: false, video: true });
    await user.click(
      await screen.findByRole("button", { name: "Turn off camera" }),
    );
    expect(screen.getByText("Camera off")).toBeInTheDocument();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });
  it.each([
    ["NotAllowedError", /Microphone access is blocked/],
    ["NotFoundError", /No microphone was found/],
    ["NotReadableError", /microphone is in use/],
  ])(
    "reports %s microphone access while code remains usable",
    async (name, message) => {
      getUserMedia.mockRejectedValue(
        new DOMException("device error", String(name)),
      );
      render(<RoomPage />);
      await screen.findByLabelText("Code editor");
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "Turn on microphone" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(screen.getByLabelText("Code editor")).not.toHaveAttribute(
        "readonly",
      );
    },
  );
  it("reports camera denial using camera wording", async () => {
    getUserMedia.mockRejectedValue(
      new DOMException("blocked", "NotAllowedError"),
    );
    render(<RoomPage />);
    await screen.findByLabelText("Code editor");
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Turn on camera" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Camera access is blocked",
    );
  });
  it("leaves without ending, stopping media and closing the connection", async () => {
    render(<RoomPage />);
    await screen.findByLabelText("Code editor");
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Turn on microphone" }),
    );
    const stream = (await getUserMedia.mock.results[0].value) as MockStream;
    await user.click(screen.getByRole("button", { name: "Leave room" }));
    expect(navigation.push).toHaveBeenCalledWith("/peer");
    expect(socket.emit).toHaveBeenCalledWith("leave");
    expect(socket.emit.mock.calls.some(([e]) => e === "end")).toBe(false);
    expect(stream.getTracks()[0].stop).toHaveBeenCalledOnce();
    expect(MockPeer.instances[0].close).toHaveBeenCalledOnce();
  });
  it("confirms before ending for both and shows feedback after the end ack", async () => {
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    render(<RoomPage />);
    await screen.findByLabelText("Code editor");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "End session" }));
    expect(socket.emit.mock.calls.some(([e]) => e === "end")).toBe(false);
    session = {
      ...session,
      status: "completed",
      endedReason: "ended_by_participant",
    };
    await user.click(screen.getByRole("button", { name: "End session" }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByText("A participant ended the interview."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Code editor")).toHaveAttribute("readonly");
  });
  it.each(["interviewer", "candidate"] as const)(
    "provides exactly the %s feedback fields and submits once",
    async (role) => {
      session = {
        ...session,
        status: "completed",
        myRole: role,
        endedReason: "time_up",
      };
      render(<RoomPage />);
      await screen.findByRole("heading", { name: "Your feedback" });
      const user = userEvent.setup();
      const labels =
        role === "interviewer"
          ? ["Problem solving", "Communication", "Code quality"]
          : ["Clarity", "Helpfulness"];
      for (const label of labels)
        await user.selectOptions(screen.getByLabelText(label), "4");
      expect(
        screen.queryByLabelText(
          role === "interviewer" ? "Clarity" : "Problem solving",
        ),
      ).not.toBeInTheDocument();
      await user.type(screen.getByLabelText("Notes (optional)"), "Helpful");
      expect(screen.getByLabelText("Notes (optional)")).toHaveAttribute(
        "maxlength",
        "2000",
      );
      await user.click(screen.getByRole("button", { name: "Submit feedback" }));
      await screen.findByText("Feedback submitted");
      const request = requests.find((r) => r.url.endsWith("/feedback"))!;
      expect(await request.json()).toEqual({
        ratings:
          role === "interviewer"
            ? { problemSolving: 4, communication: 4, codeQuality: 4 }
            : { clarity: 4, helpfulness: 4 },
        notes: "Helpful",
      });
      expect(
        screen.queryByRole("button", { name: "Submit feedback" }),
      ).not.toBeInTheDocument();
      expect(io).not.toHaveBeenCalled();
    },
  );
  it("shows partner feedback and recovers a failed feedback save", async () => {
    session = {
      ...session,
      status: "completed",
      endedReason: "time_up",
      feedback: {
        given: null,
        received: {
          ratings: { clarity: 5, helpfulness: 4 },
          notes: "Great interviewer",
          createdAt: "2026-10-11",
        },
      },
    };
    const original = handler;
    handler = (r) =>
      r.url.endsWith("/feedback")
        ? { status: 503, body: { error: "Feedback unavailable" } }
        : original(r);
    render(<RoomPage />);
    await screen.findByText("Great interviewer");
    const user = userEvent.setup();
    for (const label of ["Problem solving", "Communication", "Code quality"])
      await user.selectOptions(screen.getByLabelText(label), "3");
    await user.click(screen.getByRole("button", { name: "Submit feedback" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Feedback unavailable",
    );
    expect(screen.getByLabelText("Communication")).toHaveValue("3");
    handler = original;
    await user.click(screen.getByRole("button", { name: "Submit feedback" }));
    await screen.findByText("Feedback submitted");
  });
  it("shows the server's ended reason and refreshes partner feedback", async () => {
    render(<RoomPage />);
    await screen.findByLabelText("Code editor");
    session = { ...session, status: "completed", endedReason: "time_up" };
    act(() => socket.fire("ended", { reason: "time_up" }));
    expect(
      await screen.findByText("The interview time is up."),
    ).toBeInTheDocument();
    session = {
      ...session,
      feedback: {
        given: null,
        received: {
          ratings: { clarity: 5 },
          notes: "Well done",
          createdAt: "2026-10-11",
        },
      },
    };
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Refresh partner feedback" }));
    expect(await screen.findByText("Well done")).toBeInTheDocument();
  });
});
describe("problem submit outcomes", () => {
  it.each([true, false])(
    "shows rating only when present (%s) and complexity only after passing Submit",
    async (present) => {
      navigation.params.id = "p";
      handler = (request) => {
        const path = new URL(request.url).pathname;
        if (path.endsWith("/complexity"))
          return { body: { available: true, analysis: null } };
        if (path.endsWith("/submissions") && request.method === "GET")
          return { body: { submissions: [], total: 0, limit: 50, offset: 0 } };
        if (path.endsWith("/submissions") && request.method === "POST")
          return {
            body: {
              mode: "submit",
              passed: true,
              status: "passed",
              submissionId: "sub",
              review: null,
              rating: present ? { ...rating, score: 0.5 } : null,
              results: [
                {
                  passed: true,
                  hidden: false,
                  input: "1",
                  expectedOutput: "1",
                  actualOutput: "1",
                },
              ],
            },
          };
        return { body: { problem: groupCProblem } };
      };
      render(<ProblemPage />);
      await screen.findByRole("heading", { name: "Two Sum" });
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Editor" }));
      await user.click(screen.getByRole("button", { name: "Submit" }));
      await screen.findByRole("button", { name: "Measure time complexity" });
      expect(Boolean(screen.queryByText("+6 rating"))).toBe(present);
      if (present)
        expect(
          screen.getByText(/85% predicted to pass first time/),
        ).toHaveTextContent("passed after viewing hints");
    },
  );
});
