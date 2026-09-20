import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LeaderboardPage from "../leaderboard/page";
import PublicProfilePage from "../profile/[username]/page";
import SettingsPage from "../settings/page";
import LeaderboardError from "../leaderboard/error";

const mocks = vi.hoisted(() => ({
  username: "missing_user",
  getLeaderboard: vi.fn(),
  getPublicProfile: vi.fn(),
  me: vi.fn(),
  changePassword: vi.fn(),
  uploadAvatar: vi.fn(),
  removeAvatar: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useParams: () => ({ username: mocks.username }) }));
vi.mock("@/components/auth/protected", () => ({ Protected: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/layout/page-shell", () => ({ PageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/ui/activity-heatmap", () => ({ ActivityHeatmap: () => <div>Activity grid</div> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return { ...original, api: { ...original.api, ...mocks } };
});

describe("completion pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.username = "missing_user";
    mocks.me.mockResolvedValue({ user: { username: "ava", email: "ava@example.com", name: "Ava", avatar_url: null } });
    mocks.getLeaderboard.mockResolvedValue({ leaderboard: [], total: 0, page: 1, limit: 20 });
    mocks.getPublicProfile.mockRejectedValue(new Error("User not found"));
    mocks.changePassword.mockResolvedValue({ ok: true });
  });

  it("separates empty rankings from a failed load and retries", async () => {
    const user = userEvent.setup();
    mocks.getLeaderboard.mockRejectedValueOnce(new Error("Ranking service unavailable"));
    render(<LeaderboardPage />);
    expect(await screen.findByRole("heading", { name: "Rankings unavailable" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry rankings" }));
    expect(await screen.findByRole("heading", { name: "No ranked submissions yet" })).toBeInTheDocument();
    expect(mocks.getLeaderboard).toHaveBeenCalledTimes(2);
  });

  it("keeps the successful ranking page when the next page fails", async () => {
    const user = userEvent.setup();
    mocks.getLeaderboard.mockResolvedValueOnce({ leaderboard: [{ rank: 1, username: "ava", name: "Ava", avatar_url: null, solved: 3, acceptanceRate: 75 }], total: 21, page: 1, limit: 20 });
    mocks.getLeaderboard.mockRejectedValueOnce(new Error("Page two unavailable"));
    render(<LeaderboardPage />);
    expect(await screen.findByText("Page 1 of 2 · 21 ranked users")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("heading", { name: "Rankings unavailable" })).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2 · 21 ranked users")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ava/ })).toHaveAttribute("href", "/profile/ava");
  });

  it("distinguishes a missing public profile from a network failure", async () => {
    const { rerender } = render(<PublicProfilePage />);
    expect(await screen.findByRole("heading", { name: "Profile not found" })).toBeInTheDocument();
    mocks.username = "failed_user";
    mocks.getPublicProfile.mockRejectedValue(new Error("Network unavailable"));
    rerender(<PublicProfilePage />);
    expect(await screen.findByRole("heading", { name: "Profile unavailable" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry profile" })).toBeInTheDocument();
  });

  it("ignores an older profile response after the username changes", async () => {
    let resolveOld!: (value: unknown) => void;
    const oldRequest = new Promise((resolve) => { resolveOld = resolve; });
    const profile = (username: string) => ({
      profile: { username, name: username, avatar_url: null, createdAt: "2026-09-20T00:00:00Z" },
      stats: { problemsAttempted: 0, problemsSolved: 0, interviewsStarted: 0, submissionsCount: 0, acceptanceRate: 0 },
      recentActivity: [], activityMap: {},
    });
    mocks.username = "old_user";
    mocks.getPublicProfile.mockReturnValueOnce(oldRequest).mockResolvedValueOnce(profile("new_user"));
    const { rerender } = render(<PublicProfilePage />);
    mocks.username = "new_user";
    rerender(<PublicProfilePage />);
    expect(await screen.findByRole("heading", { name: "new_user" })).toBeInTheDocument();
    resolveOld(profile("old_user"));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "old_user" })).not.toBeInTheDocument());
  });

  it("validates passwords locally and preserves values after a server error", async () => {
    const user = userEvent.setup();
    mocks.changePassword.mockRejectedValueOnce(new Error("Current password is incorrect"));
    render(<SettingsPage />);
    await screen.findByText("ava@example.com");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(screen.getByText("Current password is required")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Current password"), "oldpass");
    await user.type(screen.getByLabelText("New password"), "oldpass");
    await user.type(screen.getByLabelText("Confirm new password"), "oldpass");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(screen.getByText("Choose a different password")).toBeInTheDocument();
    expect(mocks.changePassword).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("New password"));
    await user.clear(screen.getByLabelText("Confirm new password"));
    await user.type(screen.getByLabelText("New password"), "newpass");
    await user.type(screen.getByLabelText("Confirm new password"), "newpass");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText("Current password is incorrect")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toHaveValue("newpass");
    expect(mocks.changePassword).toHaveBeenCalledWith("oldpass", "newpass");
  });

  it("recovers account loading and offers route-error reset", async () => {
    const user = userEvent.setup();
    mocks.me.mockRejectedValueOnce(new Error("Session lookup failed"));
    render(<SettingsPage />);
    expect(await screen.findByRole("heading", { name: "Account unavailable" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry account" }));
    expect(await screen.findByText("ava@example.com")).toBeInTheDocument();
    const reset = vi.fn();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<LeaderboardError error={new Error("Render failed")} reset={reset} />);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(reset).toHaveBeenCalledOnce());
    log.mockRestore();
  });

  it("rejects images that exceed the backend limit after base64 encoding", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await screen.findByText("ava@example.com");
    const image = new File([new Uint8Array(400_000)], "avatar.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Choose profile picture"), image);
    expect(await screen.findByText(/too large after encoding/)).toBeInTheDocument();
    expect(mocks.uploadAvatar).not.toHaveBeenCalled();
  });
});
