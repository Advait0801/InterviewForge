import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Protected } from "../protected";

const mocks = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

describe("Protected", () => {
  beforeEach(() => {
    mocks.replace.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("hydrates authenticated content from the same neutral server markup", async () => {
    localStorage.setItem("if-token", "test-token");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const serverMarkup = renderToString(<Protected><p>Private content</p></Protected>);
    expect(serverMarkup).toContain("Checking your session");
    const container = document.createElement("div");
    container.innerHTML = serverMarkup;
    document.body.append(container);

    await act(async () => {
      hydrateRoot(container, <Protected><p>Private content</p></Protected>);
    });

    expect(container).toHaveTextContent("Private content");
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("redirects signed-out users without flashing protected content", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Protected><p>Private content</p></Protected>);
    expect(container).toHaveTextContent("Checking your session");
    document.body.append(container);

    await act(async () => {
      hydrateRoot(container, <Protected><p>Private content</p></Protected>);
    });

    expect(container).toBeEmptyDOMElement();
    expect(mocks.replace).toHaveBeenCalledWith("/login");
  });
});
