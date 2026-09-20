import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "../page";
import LoginPage from "../login/page";
import RegisterPage from "../register/page";
import ForgotPasswordPage from "../forgot-password/page";
import ResetPasswordPage from "../reset-password/page";
import VerifyEmailPage from "../verify-email/page";
import { emailVerificationUrl } from "@/lib/api";

const mocks = vi.hoisted(() => ({
  token: null as string | null,
  query: new URLSearchParams(),
  push: vi.fn(),
  replace: vi.fn(),
  setToken: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => mocks.query,
}));

vi.mock("@/components/layout/page-shell", () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => mocks.token,
  setToken: mocks.setToken,
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...original,
    api: {
      login: mocks.login,
      register: mocks.register,
      forgotPassword: mocks.forgotPassword,
      resetPassword: mocks.resetPassword,
    },
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("landing and onboarding", () => {
  beforeEach(() => {
    mocks.token = null;
    mocks.query = new URLSearchParams();
    vi.clearAllMocks();
  });

  it("hydrates signed-in home actions without nested interactive controls", async () => {
    mocks.token = "test-token";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const markup = renderToString(<Home />);
    expect(markup).not.toContain("Open dashboard");
    const container = document.createElement("div");
    container.innerHTML = markup;
    document.body.append(container);

    await act(async () => hydrateRoot(container, <Home />));

    const dashboard = await screen.findByRole("link", { name: "Open dashboard" });
    expect(dashboard).toHaveAttribute("href", "/dashboard");
    expect(container.querySelector("a button, button a")).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("labels login fields, focuses validation, and completes sign-in", async () => {
    const user = userEvent.setup();
    mocks.login.mockResolvedValue({ token: "signed-token" });
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByLabelText("Email or username")).toHaveFocus();
    expect(screen.getByText("Enter your email or username.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Email or username"), "ada");
    await user.type(screen.getByLabelText("Password"), "secret12");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(mocks.setToken).toHaveBeenCalledWith("signed-token"));
    expect(mocks.push).toHaveBeenCalledWith("/dashboard");
  });

  it("keeps registration rules visible and exposes API failures", async () => {
    const user = userEvent.setup();
    mocks.register.mockRejectedValue(new Error("Username already taken"));
    render(<RegisterPage />);

    expect(screen.getByText("3–20 letters, numbers, or underscores")).toBeInTheDocument();
    expect(screen.getByText("At least 6 characters")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Username"), "ada_dev");
    await user.type(screen.getByLabelText("Email address"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "secret12");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Username already taken");
  });

  it("shows an account-neutral durable recovery confirmation", async () => {
    const user = userEvent.setup();
    mocks.forgotPassword.mockResolvedValue({ ok: true });
    render(<ForgotPasswordPage />);
    await user.type(screen.getByLabelText("Email address"), "nobody@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset instructions" }));

    expect(await screen.findByRole("status")).toHaveTextContent("If an account exists");
    expect(screen.getByRole("status")).toHaveTextContent("request was accepted");
    expect(screen.queryByText(/backend console/i)).not.toBeInTheDocument();
  });

  it("offers recovery for a missing reset token and validates mismatched passwords", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ResetPasswordPage />);
    expect(screen.getByRole("alert")).toHaveTextContent("reset link is incomplete");
    unmount();

    mocks.query = new URLSearchParams("token=reset-token");
    render(<ResetPasswordPage />);
    await user.type(screen.getByLabelText("New password"), "secret12");
    await user.type(screen.getByLabelText("Confirm new password"), "different");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(screen.getByText("The passwords do not match.")).toBeInTheDocument();
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  it("renders distinct verification success and error recovery states", () => {
    mocks.query = new URLSearchParams("verified=1");
    const { unmount } = render(<VerifyEmailPage />);
    expect(screen.getByRole("status")).toHaveTextContent("Email verified");
    expect(screen.getByRole("link", { name: "Continue to sign in" })).toHaveAttribute("href", "/login");
    unmount();

    mocks.query = new URLSearchParams("error=invalid");
    render(<VerifyEmailPage />);
    expect(screen.getByRole("alert")).toHaveTextContent("verification link has expired");
  });

  it("encodes verification tokens into the existing backend endpoint", () => {
    expect(emailVerificationUrl("token with+/symbols")).toContain("/auth/verify-email?token=token%20with%2B%2Fsymbols");
  });
});
