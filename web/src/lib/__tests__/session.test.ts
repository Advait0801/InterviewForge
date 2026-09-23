import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { getToken, setToken } from "@/lib/auth";

// D-055: the client signs out only when the backend says the session itself is invalid.
function respond(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

describe("session handling in api.request", () => {
  const assign = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    setToken("stored-token");
    vi.stubGlobal("location", { ...window.location, pathname: "/dashboard", assign });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    assign.mockReset();
  });

  it("clears the token and goes to login when the session is revoked", async () => {
    respond(401, { error: "Session has been signed out", code: "session_invalid" });
    await expect(api.me()).rejects.toThrow("Session has been signed out");
    expect(getToken()).toBeNull();
    expect(assign).toHaveBeenCalledWith("/login?expired=1");
  });

  it("keeps the session on a 401 that is about the request, not the session", async () => {
    respond(401, { error: "Current password is incorrect" });
    await expect(api.changePassword("wrong", "new-password")).rejects.toThrow(
      "Current password is incorrect",
    );
    expect(getToken()).toBe("stored-token");
    expect(assign).not.toHaveBeenCalled();
  });

  it("keeps the session when the backend is only temporarily unavailable", async () => {
    respond(503, { error: "Authentication is temporarily unavailable. Please retry.", retryable: true });
    await expect(api.me()).rejects.toThrow("temporarily unavailable");
    expect(getToken()).toBe("stored-token");
    expect(assign).not.toHaveBeenCalled();
  });

  it("does not redirect when already on the login page", async () => {
    vi.stubGlobal("location", { ...window.location, pathname: "/login", assign });
    respond(401, { error: "Invalid or expired token", code: "session_invalid" });
    await expect(api.me()).rejects.toThrow();
    expect(getToken()).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });
});
