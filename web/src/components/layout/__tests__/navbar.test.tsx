import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Navbar } from "../navbar";
import { ThemeProvider } from "@/components/ui/theme-provider";

const mocks = vi.hoisted(() => ({
  pathname: "/problems/two-sum",
  me: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("@/lib/api", () => ({
  api: { me: mocks.me },
}));

function renderNavbar() {
  return render(<ThemeProvider><Navbar /></ThemeProvider>);
}

describe("Navbar", () => {
  beforeEach(() => {
    mocks.pathname = "/problems/two-sum";
    mocks.me.mockResolvedValue({ user: { avatar_url: null, name: "Ada Lovelace", username: "ada" } });
  });

  it("marks the matching nested route as current and uses the full assessment label", async () => {
    renderNavbar();
    await waitFor(() => expect(screen.getByRole("link", { name: "Login" })).toBeInTheDocument());
    const primary = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(primary).getByRole("link", { name: "Practice" })).toHaveAttribute("aria-current", "page");
    expect(within(primary).getByRole("link", { name: "Assessments" })).toBeInTheDocument();
    expect(within(primary).getAllByRole("link").filter(link => link.hasAttribute("aria-current"))).toHaveLength(1);
  });

  it("opens by keyboard, exposes state, and closes on Escape with focus restored", async () => {
    const user = userEvent.setup();
    renderNavbar();
    const trigger = screen.getByRole("button", { name: "Toggle menu" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    trigger.focus();
    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(screen.getByRole("navigation", { name: "Mobile navigation" })).toBeInTheDocument());

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("resolves signed-in account controls without blocking navigation", async () => {
    localStorage.setItem("if-token", "test-token");
    renderNavbar();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("link", { name: "Account settings" })).toBeInTheDocument());
    expect(mocks.me).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  });
});
