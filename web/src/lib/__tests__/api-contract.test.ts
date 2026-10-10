import { transferableAbortController } from "node:util";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { api, ApiError, emailVerificationUrl, type Assessment, type InterviewReport } from "@/lib/api";
import { getToken, setToken } from "@/lib/auth";
import type { components } from "@/lib/api/schema";

const fetchMock = vi.fn<(request: Request) => Promise<Response>>();
function respond(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}
function request() { return fetchMock.mock.calls.at(-1)![0]; }

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("generated API client compatibility", () => {
  it("reads the current bearer token on every authenticated request", async () => {
    setToken("first");
    respond({ user: {} });
    await api.me();
    expect(request().headers.get("Authorization")).toBe("Bearer first");
    setToken("second");
    respond({ user: {} });
    await api.me();
    expect(request().headers.get("Authorization")).toBe("Bearer second");
  });

  it("keeps public requests anonymous and optional-auth requests authenticated", async () => {
    setToken("token");
    respond({ problems: [] });
    await api.listProblems();
    expect(request().headers.has("Authorization")).toBe(false);
    respond({ problems: [] });
    await api.listProblems({ auth: true });
    expect(request().headers.get("Authorization")).toBe("Bearer token");
  });

  it("encodes filters and omits all-filter sentinels from the query", async () => {
    respond({ problems: [] });
    await api.listProblems({ difficulty: "all", topic: "all", solved: "all", company: "all", search: "hash & map?" });
    const url = new URL(request().url);
    expect(url.pathname).toBe("/api/problems");
    expect([...url.searchParams.entries()]).toEqual([["search", "hash & map?"]]);
  });

  it("encodes dynamic path values as one segment", async () => {
    respond({});
    await api.getPublicProfile("name/with ?#");
    expect(request().url).toBe("http://localhost:4000/api/users/name%2Fwith%20%3F%23");
    expect(emailVerificationUrl("a&b")).toBe("http://localhost:4000/api/auth/verify-email?token=a%26b");
  });

  it("retains audio MIME types without supplying a filename", async () => {
    respond({ transcript: "A clear explanation" });
    await api.transcribeSpeech("encoded-audio", "audio/mp4");
    expect(await request().json()).toEqual({ audioBase64: "encoded-audio", mimeType: "audio/mp4" });
    respond({ transcript: "A clear explanation", evaluation: {} });
    await api.evaluateExplanation("encoded-audio", "Why a map?", "audio/webm;codecs=opus");
    expect(await request().json()).toEqual({ audioBase64: "encoded-audio", question: "Why a map?", mimeType: "audio/webm;codecs=opus" });
  });

  it.each([[422, false], [413, false], [429, true], [503, true]])("preserves speech failure status %i and retryability %s", async (status, retryable) => {
    respond({ error: "Speech unavailable", retryable }, status);
    await expect(api.transcribeSpeech("audio", "audio/mp4")).rejects.toMatchObject({ name: "ApiError", message: "Speech unavailable", status, retryable });
  });

  it("uses detail errors and does not end an anonymous request's session", async () => {
    setToken("keep-this-session");
    respond({ detail: "Wrong credentials", code: "session_invalid" }, 401);
    await expect(api.login("user", "wrong")).rejects.toThrow("Wrong credentials");
    expect(getToken()).toBe("keep-this-session");
  });

  it("reports an HTTP failure when a proxy returns non-JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Proxy unavailable", { status: 502 }));
    await expect(api.me()).rejects.toThrow("Request failed (502)");
  });

  it("separates Run and Submit without requesting hidden cases", async () => {
    respond({ mode: "run", passed: true, testCases: [], results: [] });
    const run = await api.runCode("problem-id", "python3", "code");
    expect(run.mode).toBe("run");
    expect(await request().json()).toEqual({ problemId: "problem-id", language: "python3", code: "code", mode: "run" });
    respond({ mode: "submit", submissionId: "submission-id", status: "passed", passed: true, results: [{ passed: true, hidden: true }] }, 201);
    const submit = await api.submitCode("problem-id", "cpp", "code");
    expect(submit.results).toEqual([{ passed: true, hidden: true }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a response with the wrong execution mode", async () => {
    respond({ mode: "submit", results: [] });
    await expect(api.runCode("id", "python3", "code")).rejects.toThrow("Run result");
  });

  it("reports an unexpected empty success response", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(api.me()).rejects.toBeInstanceOf(ApiError);
  });

  it("keeps database scores, report scores, and answer actions from the generated contract", () => {
    expectTypeOf<Assessment["score"]>().toEqualTypeOf<string | null>();
    expectTypeOf<InterviewReport["stageScores"][string]["score"]>().toEqualTypeOf<number | string>();
    expectTypeOf<Awaited<ReturnType<typeof api.answerInterview>>>().toEqualTypeOf<components["schemas"]["AnswerOutcome"]>();
    const live: components["schemas"]["LiveIngestion"] = { triggered: false, reason: "local context sufficient" };
    expect(live.triggered).toBe(false);
  });
});

describe("interview streams and hints", () => {
  function events(body: unknown[]) {
    fetchMock.mockResolvedValueOnce(new Response(body.map((event) => {
      const value = event as { type: string };
      return `event: ${value.type}\r\ndata: ${JSON.stringify(value)}\r\n\r\n`;
    }).join(""), { headers: { "Content-Type": "text/event-stream" } }));
  }
  it("streams through the typed client, sends preferences, and returns the authoritative result", async () => {
    const result = { session: { id: "s" }, openingQuestion: { question: "Final" } };
    events([{ type: "question", kind: "question", stage: "behavioral" }, { type: "delta", text: "Draft" }, { type: "done", result }]);
    const onEvent = vi.fn(); const controller = transferableAbortController();
    expect(await api.startInterviewStream({ company: "google", persona: "terse", mode: "agent" }, onEvent, controller.signal)).toEqual(result);
    expect(onEvent).toHaveBeenCalledTimes(3);
    expect(new URL(request().url).pathname).toBe("/api/interviews/stream");
    expect(await request().json()).toEqual({ company: "google", persona: "terse", mode: "agent" });
  });
  it("handles JSON rejection before a stream and preserves normal 401 authentication", async () => {
    setToken("keep-session"); respond({ error: "Service credentials unavailable" }, 401);
    await expect(api.startInterviewStream({ company: "google" }, vi.fn())).rejects.toMatchObject({ status: 401, message: "Service credentials unavailable" });
    expect(getToken()).toBe("keep-session");
  });
  it.each([true, false])("preserves mid-stream error retryability %s", async (retryable) => {
    events([{ type: "evaluation", evaluation: {} }, { type: "error", status: retryable ? 503 : 409, error: "Stream failed", retryable }]);
    await expect(api.answerInterviewStream("session", "Same answer", vi.fn())).rejects.toMatchObject({ name: "ApiError", retryable, message: "Stream failed" });
    expect(await request().json()).toEqual({ answer: "Same answer" });
  });
  it("treats EOF without a terminal event as unconfirmed", async () => {
    events([{ type: "delta", text: "partial" }]);
    await expect(api.answerInterviewStream("s", "draft", vi.fn())).rejects.toMatchObject({ status: 502, retryable: undefined });
  });
  it("preserves hint lock information and sends the draft", async () => {
    const availableAt = "2026-10-10T02:00:30Z";
    respond({ error: "Hint locked", code: "hint_locked", availableAt }, 409);
    await expect(api.interviewHint("s", "draft")).rejects.toMatchObject({ code: "hint_locked", availableAt, status: 409 });
    expect(await request().json()).toEqual({ draft: "draft" });
  });
  it("aborts an active answer stream without a terminal event", async () => {
    const controller = transferableAbortController(); const onEvent = vi.fn(() => controller.abort());
    events([{ type: "question", kind: "question", stage: "coding" }, { type: "delta", text: "unfinished" }]);
    await expect(api.answerInterviewStream("s", "draft", onEvent, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});
