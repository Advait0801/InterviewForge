import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSpeechRecording } from "../use-speech-recording";

const transcribeSpeech = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ api: { transcribeSpeech } }));

let now = 0;
let audioSize = 2048;
let supportedType = "audio/webm;codecs=opus";
const stopTrack = vi.fn();
const stream = { getTracks: () => [{ stop: stopTrack }] };
class FakeRecorder {
  static isTypeSupported(type: string) { return type === supportedType; }
  state = "inactive";
  stream = stream;
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(_stream: unknown, options: { mimeType: string }) { this.mimeType = options.mimeType; }
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["a".repeat(audioSize)]) });
    this.onstop?.();
  }
}

beforeEach(() => {
  now = 0;
  audioSize = 2048;
  supportedType = "audio/webm;codecs=opus";
  stopTrack.mockReset();
  transcribeSpeech.mockReset().mockResolvedValue({ transcript: "Use a hash map." });
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
  Object.defineProperty(Blob.prototype, "arrayBuffer", { configurable: true, value: async () => new TextEncoder().encode("audio").buffer });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function record(speech: { current: ReturnType<typeof useSpeechRecording> }, duration = 1000) {
  await act(() => speech.current.toggleRecording());
  now += duration;
  await act(() => speech.current.toggleRecording());
}

describe("shared microphone recording", () => {
  it.each([
    ["NotAllowedError", "Microphone access is blocked"],
    ["NotFoundError", "No microphone was found"],
    ["OverconstrainedError", "No microphone was found"],
    ["NotReadableError", "microphone is in use by another app"],
    ["SecurityError", "secure connection"],
    ["UnknownError", "Could not access the microphone"],
  ])("explains %s without exposing the DOMException", async (name, copy) => {
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(new DOMException("RAW DEVICE ERROR", name));
    const { result } = renderHook(() => useSpeechRecording(vi.fn()));
    await act(() => result.current.toggleRecording());
    expect(result.current.error?.message).toContain(copy);
    expect(result.current.error?.message).toContain("type your answer");
    expect(result.current.error?.message).not.toContain("RAW DEVICE ERROR");
    expect(transcribeSpeech).not.toHaveBeenCalled();
  });

  it("explains an insecure context before asking for permission", async () => {
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: false });
    const { result } = renderHook(() => useSpeechRecording(vi.fn()));
    await act(() => result.current.toggleRecording());
    expect(result.current.error?.message).toContain("HTTPS or localhost");
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it.each(["audio/webm;codecs=opus", "audio/webm", "audio/mp4"])("uploads the actual %s recorder type and appends valid speech", async (mimeType) => {
    supportedType = mimeType;
    const append = vi.fn();
    const { result } = renderHook(() => useSpeechRecording(append));
    await record(result);
    await waitFor(() => expect(append).toHaveBeenCalledWith("Use a hash map."));
    expect(transcribeSpeech).toHaveBeenCalledWith(expect.any(String), mimeType);
    expect(result.current.lastAudio?.mimeType).toBe(mimeType);
    expect(stopTrack).toHaveBeenCalled();
  });

  it.each([[100, 2048], [1000, 0], [1000, 1023]])("skips unusable recordings (%i ms, %i bytes)", async (duration, size) => {
    audioSize = size;
    const { result } = renderHook(() => useSpeechRecording(vi.fn()));
    await record(result, duration);
    expect(result.current.error?.message).toContain("That recording was too short");
    expect(transcribeSpeech).not.toHaveBeenCalled();
    expect(stopTrack).toHaveBeenCalled();
  });

  it.each([400, 413, 422])("discards rejected audio on %i and never retries it", async (status) => {
    transcribeSpeech.mockRejectedValue(Object.assign(new Error("Record again"), { status, retryable: false }));
    const { result } = renderHook(() => useSpeechRecording(vi.fn()));
    await record(result);
    await waitFor(() => expect(result.current.error?.retryable).toBe(false));
    expect(result.current.lastAudio).toBeNull();
    act(() => result.current.retryTranscription());
    expect(transcribeSpeech).toHaveBeenCalledTimes(1);
  });

  it.each([429, 503])("retries the same usable audio on %i", async (status) => {
    transcribeSpeech.mockRejectedValueOnce(Object.assign(new Error("Please retry"), { status, retryable: true }));
    const append = vi.fn();
    const { result } = renderHook(() => useSpeechRecording(append));
    await record(result);
    await waitFor(() => expect(result.current.error?.retryable).toBe(true));
    await act(() => result.current.retryTranscription());
    await waitFor(() => expect(append).toHaveBeenCalledTimes(1));
    expect(transcribeSpeech.mock.calls[1]).toEqual(transcribeSpeech.mock.calls[0]);
  });

  it("holds a one-word transcript until the user confirms it", async () => {
    transcribeSpeech.mockResolvedValue({ transcript: "You" });
    const append = vi.fn();
    const { result } = renderHook(() => useSpeechRecording(append));
    await record(result);
    await waitFor(() => expect(result.current.pendingTranscript).toBe("You"));
    expect(append).not.toHaveBeenCalled();
    act(() => result.current.confirmTranscript());
    expect(append).toHaveBeenCalledWith("You");
    expect(result.current.pendingTranscript).toBeNull();
  });

  it("can discard empty or one-word speech without changing the draft", async () => {
    transcribeSpeech.mockResolvedValue({ transcript: "" });
    const append = vi.fn();
    const { result } = renderHook(() => useSpeechRecording(append));
    await record(result);
    await waitFor(() => expect(result.current.pendingTranscript).toBe(""));
    act(() => result.current.discardTranscript());
    expect(append).not.toHaveBeenCalled();
    expect(result.current.lastAudio).toBeNull();
  });

  it("releases tracks on unmount and never uploads the interrupted recording", async () => {
    const { result, unmount } = renderHook(() => useSpeechRecording(vi.fn()));
    await act(() => result.current.toggleRecording());
    unmount();
    expect(stopTrack).toHaveBeenCalled();
    expect(transcribeSpeech).not.toHaveBeenCalled();
  });

  it("releases a permission request resolved after unmount", async () => {
    let resolve!: (value: typeof stream) => void;
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(() => new Promise<typeof stream>((done) => { resolve = done; })) } });
    const { result, unmount } = renderHook(() => useSpeechRecording(vi.fn()));
    let pending!: Promise<void>;
    act(() => { pending = result.current.toggleRecording(); });
    unmount();
    resolve(stream);
    await pending;
    expect(stopTrack).toHaveBeenCalled();
    expect(transcribeSpeech).not.toHaveBeenCalled();
  });
});
