/**
 * The backend's half of the ai-service question streams (D-065): the SSE reader, and
 * `streamNextQuestion` against a fake ai-service over real HTTP.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readEvents } from "../services/sse-reader";

function bodyOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(chunks: string[]) {
  const out = [];
  for await (const event of readEvents(bodyOf(chunks))) out.push(event);
  return out;
}

describe("readEvents", () => {
  it("reassembles events split anywhere across chunks, including inside a multi-byte character", async () => {
    const wire = 'event: delta\ndata: {"text":"café"}\n\nevent: done\ndata: {}\n\n';
    const bytes = Buffer.from(wire, "utf8");
    // One byte per chunk, so "é" (two bytes) arrives split.
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (const b of bytes) c.enqueue(new Uint8Array([b]));
        c.close();
      },
    });
    const events = [];
    for await (const e of readEvents(stream)) events.push(e);
    expect(events).toEqual([
      { event: "delta", data: '{"text":"café"}' },
      { event: "done", data: "{}" },
    ]);
  });

  it("handles CRLF, comments, multi-line data and a final event without a blank line", async () => {
    expect(await collect([": keepalive\r\n\r\nevent: a\r\ndata: 1\r\ndata: 2\r\n\r\n", "data: last"])).toEqual([
      { event: "a", data: "1\n2" },
      { event: "message", data: "last" },
    ]);
  });
});

// --- streamNextQuestion against a fake ai-service ----------------------------

type Script = (res: http.ServerResponse, req: http.IncomingMessage) => void;
let script: Script;
let upstreamClosed = false;
let server: http.Server;
let ai: typeof import("../services/ai.service");

const PARAMS = { company: "amazon" as const, stage: "behavioral" as const, difficulty: "medium" };
const RESULT = {
  question: "Why?",
  reasoningFocus: "f",
  expectedCompetencies: [],
  retrievalHits: 1,
  context: "c",
  retrievalConfidence: null,
  liveIngestion: null,
  resumeGrounded: false,
  resumeHits: 0,
  resumeEvidence: [],
};
const sse = (event: Record<string, unknown>) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    req.resume();
    res.on("close", () => {
      if (!res.writableFinished) upstreamClosed = true;
    });
    script(res, req);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  vi.resetModules();
  process.env.AI_SERVICE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  ai = await import("../services/ai.service");
});
afterAll(() => {
  server.closeAllConnections();
  return new Promise<void>((r) => server.close(() => r()));
});

describe("streamNextQuestion", () => {
  const run = (signal = new AbortController().signal) => {
    const deltas: string[] = [];
    const promise = ai.streamNextQuestion(PARAMS, {
      signal,
      onDelta: async (text) => {
        deltas.push(text);
      },
    });
    return { deltas, promise };
  };

  it("passes deltas through and resolves with the done result", async () => {
    script = (res, req) => {
      expect(req.url).toBe("/api/interview/next-question/stream");
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write(sse({ type: "delta", text: "Wh" }));
      res.write(sse({ type: "delta", text: "y?" }));
      res.end(sse({ type: "done", result: RESULT }));
    };
    const { deltas, promise } = run();
    expect(await promise).toEqual(RESULT);
    expect(deltas).toEqual(["Wh", "y?"]);
  });

  it("an HTTP error before the stream is an AIServiceError with FastAPI's detail", async () => {
    script = (res) => {
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ detail: "LLM rate limited: quota" }));
    };
    await expect(run().promise).rejects.toMatchObject({ statusCode: 429, message: "LLM rate limited: quota" });
  });

  it("an error event becomes an AIServiceError with its status", async () => {
    script = (res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write(sse({ type: "delta", text: "Wh" }));
      res.end(sse({ type: "error", status: 503, detail: "LLM unavailable: boom" }));
    };
    await expect(run().promise).rejects.toMatchObject({ statusCode: 503, message: "LLM unavailable: boom" });
  });

  it("a stream that ends without done is a 503, never a partial question", async () => {
    script = (res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.end(sse({ type: "delta", text: "Wh" }));
    };
    await expect(run().promise).rejects.toMatchObject({ statusCode: 503 });
  });

  it("aborting rejects with the abort reason and closes the upstream connection", async () => {
    upstreamClosed = false;
    script = (res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write(sse({ type: "delta", text: "Wh" })); // then never finishes
    };
    const controller = new AbortController();
    const { deltas, promise } = run(controller.signal);
    while (deltas.length === 0) await new Promise((r) => setTimeout(r, 5));
    const reason = new Error("client gone");
    controller.abort(reason);
    await expect(promise).rejects.toBe(reason);
    while (!upstreamClosed) await new Promise((r) => setTimeout(r, 5));
    expect(upstreamClosed).toBe(true);
  });
});
