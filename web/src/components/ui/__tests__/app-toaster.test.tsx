import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AppToaster } from "../app-toaster";
const mocks = vi.hoisted(() => ({ pathname: "/dashboard", dismiss: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("sonner", () => ({
  Toaster: () => <aside>Private account notification</aside>,
  toast: { dismiss: mocks.dismiss },
}));
it("removes and clears account notifications on the public share route", () => {
  const view = render(<AppToaster theme="light" />);
  expect(screen.getByText("Private account notification")).toBeInTheDocument();
  mocks.pathname = "/share/public-token";
  view.rerender(<AppToaster theme="light" />);
  expect(
    screen.queryByText("Private account notification"),
  ).not.toBeInTheDocument();
  expect(mocks.dismiss).toHaveBeenCalledOnce();
});
