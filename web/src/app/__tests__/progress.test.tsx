import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "../dashboard/page";
import AnalyticsPage from "../analytics/page";
import { ActivityHeatmap } from "@/components/ui/activity-heatmap";

const mocks = vi.hoisted(() => ({
  me: vi.fn(),
  userStats: vi.fn(),
  getUserActivity: vi.fn(),
  getRecommendations: vi.fn(),
  getUserAnalytics: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...original,
    api: {
      ...original.api,
      me: mocks.me,
      userStats: mocks.userStats,
      getUserActivity: mocks.getUserActivity,
      getRecommendations: mocks.getRecommendations,
      getUserAnalytics: mocks.getUserAnalytics,
    },
  };
});

vi.mock("@/lib/useNow", () => ({ useNow: () => Date.parse("2026-09-15T12:00:00Z") }));
vi.mock("@/components/auth/protected", () => ({ Protected: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/layout/page-shell", () => ({ PageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));

vi.mock("recharts", () => {
  const Container = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Chart = ({ children }: { children?: React.ReactNode }) => <svg>{children}</svg>;
  const Group = ({ children }: { children?: React.ReactNode }) => <g>{children}</g>;
  const Empty = () => null;
  return {
    Area: Empty,
    AreaChart: Chart,
    Cell: Empty,
    Legend: Empty,
    Line: Empty,
    LineChart: Chart,
    Pie: Group,
    PieChart: Chart,
    PolarAngleAxis: Empty,
    PolarGrid: Empty,
    PolarRadiusAxis: Empty,
    Radar: Empty,
    RadarChart: Chart,
    ResponsiveContainer: Container,
    Tooltip: Empty,
    XAxis: Empty,
    YAxis: Empty,
  };
});

describe("progress experience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.me.mockResolvedValue({ user: { name: "Ada", username: "ada", email: "ada@example.com" } });
    mocks.userStats.mockResolvedValue({ problemsAttempted: 0, problemsSolved: 0, interviewsStarted: 0, bestStreak: 0, submissionsCount: 0, acceptanceRate: 0 });
    mocks.getUserActivity.mockResolvedValue({ currentStreak: 0, bestStreak: 0, activityMap: {} });
    mocks.getRecommendations.mockResolvedValue({ recommended: [], revisit: [], focusAreas: [], reasoning: "", difficultySuggestion: "" });
    mocks.getUserAnalytics.mockResolvedValue({ solvedOverTime: [], difficultyDistribution: {}, topicStrengths: [], acceptanceTrend: [] });
  });

  it("keeps failed dashboard resources distinct and retries only the failed statistics request", async () => {
    const user = userEvent.setup();
    mocks.userStats
      .mockRejectedValueOnce(new Error("Statistics service is unavailable"))
      .mockResolvedValueOnce({ problemsAttempted: 12, problemsSolved: 8, interviewsStarted: 3, bestStreak: 5, submissionsCount: 20, acceptanceRate: 40 });
    mocks.getUserActivity.mockRejectedValueOnce(new Error("Activity service is unavailable"));
    mocks.getRecommendations.mockRejectedValueOnce(new Error("Recommendation service is unavailable"));

    render(<DashboardPage />);

    expect(await screen.findByText("Statistics service is unavailable", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Activity is unavailable")).toBeInTheDocument();
    expect(screen.getByText("Practice suggestions are unavailable")).toBeInTheDocument();
    const attemptedCard = screen.getByText("Problems attempted").closest("div.rounded-2xl");
    expect(attemptedCard).not.toBeNull();
    expect(within(attemptedCard as HTMLElement).getByText("Unavailable")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry statistics" }));
    await waitFor(() => expect(within(attemptedCard as HTMLElement).getByText("12")).toBeInTheDocument());
    expect(mocks.userStats).toHaveBeenCalledTimes(2);
    expect(mocks.getUserActivity).toHaveBeenCalledTimes(1);
    expect(mocks.getRecommendations).toHaveBeenCalledTimes(1);
  });

  it("shows analytics failures as errors and preserves exact partial data after a local retry", async () => {
    const user = userEvent.setup();
    mocks.getUserAnalytics
      .mockRejectedValueOnce(new Error("Analytics service is unavailable"))
      .mockResolvedValueOnce({
        solvedOverTime: [{ day: "2026-09-14T00:00:00.000Z", count: 2 }],
        difficultyDistribution: { easy: 4, medium: 3 },
        topicStrengths: [],
        acceptanceTrend: [{ week: "2026-09-14T00:00:00.000Z", rate: 67 }],
      });

    render(<AnalyticsPage />);

    expect(await screen.findByText("Analytics are unavailable")).toBeInTheDocument();
    expect(screen.queryByText("No coding progress yet")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry analytics" }));

    expect(await screen.findByText("7")).toBeInTheDocument();
    expect(screen.getByText("2 passed problem records across 1 active day in the past 90 days.")).toBeInTheDocument();
    expect(screen.getAllByText("Sep 14, 2026")).toHaveLength(2);
    expect(screen.getByText("Solve problems across topics to build this view.")).toBeInTheDocument();
    expect(mocks.getUserAnalytics).toHaveBeenCalledTimes(2);
    expect(mocks.userStats).not.toHaveBeenCalled();
  });

  it("gives a genuinely empty analytics account a useful first action", async () => {
    render(<AnalyticsPage />);
    expect(await screen.findByText("No coding progress yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Solve your first problem" })).toHaveAttribute("href", "/problems");
  });

  it("limits heatmap totals to the visible period and supports roving keyboard inspection", async () => {
    const user = userEvent.setup();
    render(
      <ActivityHeatmap
        weeks={2}
        endDate={new Date(2026, 8, 15, 12)}
        activityMap={{ "2026-09-15": 2, "2026-09-14": 1, "2020-01-01": 99 }}
      />,
    );

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Review 2 active days")).toBeInTheDocument();
    const today = screen.getByRole("button", { name: /2 activities on Tuesday, Sep 15, 2026/ });
    await user.click(today);
    expect(today).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    const previous = screen.getByRole("button", { name: /1 activity on Monday, Sep 14, 2026/ });
    expect(previous).toHaveFocus();
    expect(screen.getByRole("tooltip")).toHaveTextContent("1 activity on Monday, Sep 14, 2026");
    await user.keyboard("{ArrowDown}{ArrowLeft}");
    expect(screen.getByRole("button", { name: /0 activities on Tuesday, Sep 8, 2026/ })).toHaveFocus();
    expect(screen.getAllByRole("button").filter((button) => button.tabIndex === 0)).toHaveLength(1);
  });
});
