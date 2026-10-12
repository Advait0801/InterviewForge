import { cloneElement, type ReactElement } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import AnalyticsPage from "../analytics/page";
import { populatedAnalytics } from "@/test/group-d-fixtures";

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...original,
    api: {
      ...original.api,
      getUserAnalytics: vi.fn(async () => populatedAnalytics),
      getRatings: vi.fn(async () => ({
        overall: { rating: 1500, games: 1 },
        topics: [],
      })),
    },
  };
});
vi.mock("@/components/auth/protected", () => ({
  Protected: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/layout/page-shell", () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("recharts", async (importOriginal) => {
  const original = await importOriginal<typeof import("recharts")>();
  return {
    ...original,
    // jsdom has no layout. Supply dimensions while retaining the real charts,
    // including their default accessibility-layer focus behavior.
    ResponsiveContainer: ({
      children,
    }: {
      children: ReactElement<{ width?: number; height?: number }>;
    }) => cloneElement(children, { width: 600, height: 280 }),
  };
});

it("keeps every populated analytics chart's hidden subtree free of keyboard focus targets", async () => {
  const { container } = render(<AnalyticsPage />);
  await screen.findByRole("heading", { name: "Solved by day" });
  await waitFor(() =>
    expect(
      container.querySelectorAll(
        '[aria-hidden="true"] .recharts-wrapper > svg.recharts-surface',
      ),
    ).toHaveLength(4),
  );

  const focusable =
    'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex^="-"]), [contenteditable="true"], audio[controls], video[controls], iframe, summary';
  for (const hidden of container.querySelectorAll('[aria-hidden="true"]')) {
    expect(
      [...hidden.querySelectorAll(focusable)].map(
        (element) => element.outerHTML,
      ),
    ).toEqual([]);
  }
  const summaries = container.querySelectorAll("details summary");
  expect(summaries).toHaveLength(4);
  const user = userEvent.setup();
  for (const summary of summaries) await user.click(summary);
  for (const region of container.querySelectorAll('details [role="region"]'))
    expect(region).toHaveAttribute("tabindex", "0");
  expect(
    [...container.querySelectorAll("table caption")].map(
      (caption) => caption.textContent,
    ),
  ).toEqual([
    "Problems solved by day",
    "Problems solved by difficulty",
    "Problems solved by topic",
    "Weekly submission acceptance",
  ]);
});
