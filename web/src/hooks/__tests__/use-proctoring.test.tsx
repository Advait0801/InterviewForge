import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useProctoring } from "../use-proctoring";

const requests: Request[] = [];
let response = { status: 201, body: { recorded: 1 } as unknown };
beforeEach(() => {
  vi.useFakeTimers();
  requests.length = 0;
  response = { status: 201, body: { recorded: 1 } };
  localStorage.setItem("if-token", "token");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      requests.push(request);
      return new Response(JSON.stringify(response.body), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function clipboard(type: "paste" | "copy", text: string) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, "clipboardData", {
    value: { getData: () => text },
  });
  document.dispatchEvent(event);
}
async function events(index = 0) {
  return (await requests[index].json()).events as {
    type: string;
    at: string;
    chars?: number;
  }[];
}
it("captures every event type with characters only, never text", async () => {
  renderHook(() => useProctoring("a", true));
  await act(async () => {
    clipboard("paste", "private pasted content");
    clipboard("copy", "private copied content");
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: document.body,
    });
    document.dispatchEvent(new Event("fullscreenchange"));
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: null,
    });
    document.dispatchEvent(new Event("fullscreenchange"));
    vi.advanceTimersByTime(5000);
  });
  const batch = await events();
  expect(batch.map((event) => event.type)).toEqual([
    "paste",
    "copy",
    "window_blur",
    "window_focus",
    "tab_visible",
    "fullscreen_enter",
    "fullscreen_exit",
  ]);
  expect(batch[0].chars).toBe(22);
  expect(batch[1].chars).toBe(22);
  expect(JSON.stringify(batch)).not.toContain("private");
  for (const event of batch) {
    expect(Object.keys(event).sort()).toEqual(
      event.type === "paste" || event.type === "copy"
        ? ["at", "chars", "type"]
        : ["at", "type"],
    );
    expect(event.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  }
});
it("measures a normal selection and a Monaco selection length on copy", async () => {
  const input = document.createElement("textarea");
  input.value = "do not send this text";
  document.body.appendChild(input);
  input.focus();
  input.setSelectionRange(0, 5);
  renderHook(() => useProctoring("a", true));
  await act(async () => {
    clipboard("copy", "");
    document.dispatchEvent(
      new CustomEvent("if-editor-copy", { detail: { chars: 17 } }),
    );
    vi.advanceTimersByTime(5000);
  });
  const batch = await events();
  expect(batch.map((event) => event.chars)).toEqual([5, 17]);
  expect(JSON.stringify(batch)).not.toContain("do not send");
  input.remove();
});
it("flushes immediately on tab_hidden before the five second timer", async () => {
  renderHook(() => useProctoring("a", true));
  await act(async () => {
    clipboard("paste", "abc");
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(requests).toHaveLength(1);
  expect((await events()).map((event) => event.type)).toEqual([
    "paste",
    "tab_hidden",
  ]);
});
it("caps each batch at 50 even during bursts", async () => {
  renderHook(() => useProctoring("a", true));
  await act(async () => {
    for (let index = 0; index < 123; index++)
      window.dispatchEvent(new Event("blur"));
    vi.advanceTimersByTime(5000);
  });
  expect(requests).toHaveLength(3);
  const sizes = await Promise.all(
    requests.map(async (request) => (await request.json()).events.length),
  );
  expect(sizes).toEqual([50, 50, 23]);
});
it.each(["assessment_closed", "event_limit"])(
  "stops quietly after 409 %s",
  async (code) => {
    response = { status: 409, body: { error: "Stop", code } };
    renderHook(() => useProctoring("a", true));
    await act(async () => {
      window.dispatchEvent(new Event("blur"));
      vi.advanceTimersByTime(5000);
    });
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      clipboard("paste", "text");
      vi.advanceTimersByTime(10000);
    });
    expect(requests).toHaveLength(1);
  },
);
it("drops a 400 batch but continues recording later events", async () => {
  response = { status: 400, body: { error: "Invalid event" } };
  renderHook(() => useProctoring("a", true));
  await act(async () => {
    window.dispatchEvent(new Event("blur"));
    vi.advanceTimersByTime(5000);
  });
  response = { status: 201, body: { recorded: 1 } };
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(5000);
  });
  expect(requests).toHaveLength(2);
  expect((await events(1)).map((event) => event.type)).toEqual([
    "window_focus",
  ]);
});
it("flushes on stop and records nothing after submit or timeout", async () => {
  const hook = renderHook(({ active }) => useProctoring("a", active), {
    initialProps: { active: true },
  });
  await act(async () => {
    window.dispatchEvent(new Event("blur"));
    await hook.result.current.stop();
  });
  await act(async () => {
    clipboard("paste", "after stop");
    vi.advanceTimersByTime(5000);
  });
  expect(requests).toHaveLength(1);
  hook.rerender({ active: false });
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(5000);
  });
  expect(requests).toHaveLength(1);
});
it("does not capture when inactive", async () => {
  renderHook(() => useProctoring("a", false));
  await act(async () => {
    clipboard("paste", "text");
    vi.advanceTimersByTime(5000);
  });
  expect(requests).toHaveLength(0);
});
it("flushes tab_hidden immediately even with a slow previous batch", async () => {
  let finish!: (response: Response) => void;
  const first = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  let calls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn((request: Request) => {
      requests.push(request);
      calls++;
      return calls === 1
        ? first
        : Promise.resolve(
            new Response('{"recorded":1}', {
              status: 201,
              headers: { "Content-Type": "application/json" },
            }),
          );
    }),
  );
  renderHook(() => useProctoring("a", true));
  await act(async () => {
    window.dispatchEvent(new Event("blur"));
    vi.advanceTimersByTime(5000);
  });
  await act(async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(requests).toHaveLength(2);
  expect((await events(1))[0].type).toBe("tab_hidden");
  await act(async () => {
    finish(
      new Response('{"recorded":1}', {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
});
it("keeps event_limit stopped when active state toggles", async () => {
  response = { status: 409, body: { error: "Stop", code: "event_limit" } };
  const hook = renderHook(({ active }) => useProctoring("a", active), {
    initialProps: { active: true },
  });
  await act(async () => {
    window.dispatchEvent(new Event("blur"));
    vi.advanceTimersByTime(5000);
  });
  hook.rerender({ active: false });
  hook.rerender({ active: true });
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(5000);
  });
  expect(requests).toHaveLength(1);
});
