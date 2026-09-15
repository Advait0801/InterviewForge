import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../button";
import { Card } from "../card";
import { Input } from "../input";
import { PasswordField } from "../password-field";

describe("shared controls", () => {
  it("keeps buttons inert by default and exposes loading state", async () => {
    const user = userEvent.setup();
    const submitted = vi.fn((event: React.FormEvent) => event.preventDefault());
    const clicked = vi.fn();
    const { rerender } = render(
      <form onSubmit={submitted}>
        <Button onClick={clicked}>Continue</Button>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(clicked).toHaveBeenCalledOnce();
    expect(submitted).not.toHaveBeenCalled();

    rerender(<Button loading loadingLabel="Saving changes">Continue</Button>);
    const loading = screen.getByRole("button", { name: "Saving changes" });
    expect(loading).toBeDisabled();
    expect(loading).toHaveAttribute("aria-busy", "true");
  });

  it("connects labels, hints, caller descriptions, and errors", () => {
    const { rerender } = render(
      <>
        <p id="account-help">Use your work email.</p>
        <Input label="Email" hint="Required" aria-describedby="account-help" />
      </>,
    );

    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input.getAttribute("aria-describedby")).toContain("account-help");
    expect(input.getAttribute("aria-describedby")).toContain("description");

    rerender(<Input label="Email" error="Enter a valid email" />);
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Enter a valid email")).toHaveAttribute("id");
  });

  it("keeps the password visibility control keyboard reachable", async () => {
    const user = userEvent.setup();
    render(<PasswordField label="Password" />);
    const field = screen.getByLabelText("Password");
    expect(field).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(field).toHaveAttribute("type", "text");
  });

  it("keeps static cards semantic and non-interactive", () => {
    render(<Card>Summary</Card>);
    expect(screen.getByText("Summary")).not.toHaveAttribute("tabindex");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
