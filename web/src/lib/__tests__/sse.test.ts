import { describe, expect, it, vi } from "vitest";
import { readSse } from "../sse";

const encode = (text: string) => new TextEncoder().encode(text);
function stream(chunks: Uint8Array[]) {
  return new ReadableStream<Uint8Array>({ start(controller) { chunks.forEach((chunk) => controller.enqueue(chunk)); controller.close(); } });
}
async function collect(body: ReadableStream<Uint8Array>, signal?: AbortSignal) {
  const result = [];
  for await (const event of readSse(body, signal)) result.push(event);
  return result;
}

describe("SSE reader", () => {
  it("handles every single-byte split, including UTF-8 characters, CRLF, and comments", async () => {
    const bytes = encode(': keepalive\r\nevent: delta\r\ndata: {"type":"delta","text":"café 🎯"}\r\n\r\n: ping\r\n\r\nevent: done\r\ndata: {"type":"done","result":{}}\r\n\r\n');
    expect(await collect(stream([...bytes].map((byte) => new Uint8Array([byte]))))).toEqual([{ type: "delta", text: "café 🎯" }, { type: "done", result: {} }]);
  });
  it("reads several events in one chunk and preserves error payloads", async () => {
    expect(await collect(stream([encode('event: question\ndata: {"type":"question","stage":"coding"}\n\nevent: error\ndata: {"type":"error","status":503,"error":"Try again","retryable":true}\n\n')]))).toEqual([
      { type: "question", stage: "coding" }, { type: "error", status: 503, error: "Try again", retryable: true },
    ]);
  });
  it("cancels a pending read on abort and releases the stream lock", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const controller = new AbortController();
    const result = collect(body, controller.signal);
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(cancel).toHaveBeenCalled();
    expect(body.locked).toBe(false);
  });
  it("handles an already-aborted signal", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(collect(stream([]), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
  it.each(['event: delta\ndata: {"type":"question"}\n\n', 'event: delta\ndata: invalid\n\n', 'event: delta\ndata: {"type":"delta"}\n'])('rejects malformed or incomplete frames: %s', async (input) => {
    await expect(collect(stream([encode(input)]))).rejects.toThrow();
  });
  it("ignores empty frames and unknown fields", async () => {
    expect(await collect(stream([encode('\n: ping\n\nretry: 1000\nid: a\nevent: delta\ndata: {"type":"delta","text":"ok"}\n\n')]))).toEqual([{ type: "delta", text: "ok" }]);
  });
});
