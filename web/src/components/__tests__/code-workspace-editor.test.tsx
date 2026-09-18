import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CodeWorkspaceEditor } from "../code-workspace-editor";

const mocks = vi.hoisted(() => ({
  theme: "dark" as "dark" | "light",
  reducedMotion: false,
  editorProps: null as Record<string, unknown> | null,
}));

vi.mock("@/components/ui/theme-provider", () => ({
  useTheme: () => ({ theme: mocks.theme, mounted: true }),
}));

vi.mock("@monaco-editor/react", () => ({
  default: (props: Record<string, unknown>) => {
    mocks.editorProps = props;
    return <div data-testid="monaco-editor" />;
  },
}));

beforeEach(() => {
  mocks.theme = "dark";
  mocks.reducedMotion = false;
  mocks.editorProps = null;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: query.includes("reduced-motion") && mocks.reducedMotion,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
});

describe("CodeWorkspaceEditor", () => {
  it("uses the website theme and disables decorative editor motion when requested", () => {
    mocks.theme = "light";
    mocks.reducedMotion = true;
    render(<CodeWorkspaceEditor language="cpp" value="int main() {}" onChange={() => {}} />);

    expect(mocks.editorProps?.theme).toBe("interviewforge-light");
    expect(mocks.editorProps?.language).toBe("cpp");
    expect(mocks.editorProps?.options).toMatchObject({
      ariaLabel: "Code editor",
      cursorBlinking: "solid",
      smoothScrolling: false,
      readOnly: false,
    });
  });

  it("defines both editor themes and lays out without stealing focus", () => {
    render(<CodeWorkspaceEditor language="python3" value="pass" onChange={() => {}} />);
    const defineTheme = vi.fn();
    const setTheme = vi.fn();
    const layout = vi.fn();
    const focus = vi.fn();
    const monaco = { editor: { defineTheme, setTheme } };

    (mocks.editorProps?.beforeMount as (value: unknown) => void)(monaco);
    (mocks.editorProps?.onMount as (editor: unknown, value: unknown) => void)({ layout, focus }, monaco);

    expect(defineTheme).toHaveBeenCalledTimes(2);
    expect(setTheme).toHaveBeenCalledWith("interviewforge-dark");
    expect(layout).toHaveBeenCalledTimes(1);
    expect(focus).not.toHaveBeenCalled();
  });
});
