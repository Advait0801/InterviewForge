import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "../theme-provider";
import { ThemeToggle } from "../theme-toggle";

describe("theme controls", () => {
  it("persists a toggle and updates the document theme", async () => {
    const user = userEvent.setup();
    localStorage.setItem("if-theme", "dark");
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>);

    const toggle = await screen.findByRole("button", { name: "Switch to light mode" });
    await user.click(toggle);
    expect(localStorage.getItem("if-theme")).toBe("light");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
  });
});
