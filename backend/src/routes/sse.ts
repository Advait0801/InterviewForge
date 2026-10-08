import type { Request, Response } from "express";
import { AIServiceError } from "../services/ai.service";
import { DomainError } from "../services/errors";
import { getAIServiceMessage } from "./http";
import type { InterviewStreamEvent, TurnStream } from "../services/interviews.service";

/**
 * A `text/event-stream` response (D-065). Each event is `event: <type>` plus one JSON
 * `data` line whose `type` repeats it.
 *
 * - **Backpressure:** `send` resolves only once the socket has taken the event (it waits
 *   for `drain` when Node's buffer is full). The turn awaits each send before reading
 *   more from the ai-service, so a client that stops reading stops the model instead
 *   of growing this process's memory.
 * - **Disconnect:** when the connection closes before the stream ends, `signal` aborts.
 *   The turn passes it to every ai-service call, which cancels generation upstream, and
 *   nothing is recorded unless the question was already complete.
 * - **Keepalive:** a comment every 15 s while nothing else is sent (an evaluation can
 *   take a while), so proxies don't time the connection out.
 */
export type StreamDone = { type: "done"; result: unknown };
export type StreamError = { type: "error"; status: number; error: string; retryable: boolean };
type Event = InterviewStreamEvent | StreamDone | StreamError;

const KEEPALIVE_MS = 15_000;

export function openEventStream(req: Request, res: Response, options: { keepaliveMs?: number } = {}) {
  const controller = new AbortController();
  let ended = false;

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // Nginx (the prod proxy) buffers responses unless told not to.
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.on("close", () => {
    if (!res.writableFinished) controller.abort(new ClientGone());
  });

  const keepalive = setInterval(() => {
    if (!controller.signal.aborted && !res.writableNeedDrain) res.write(": keepalive\n\n");
  }, options.keepaliveMs ?? KEEPALIVE_MS);
  keepalive.unref();

  // Set by the dev-only OPENAPI_VALIDATE_RESPONSES middleware.
  const checkEvent = res.locals.checkEvent as ((event: unknown) => void) | undefined;

  async function send(event: Event): Promise<void> {
    if (controller.signal.aborted || ended) return;
    checkEvent?.(event);
    if (res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)) return;
    await new Promise<void>((resolve) => {
      const done = () => {
        res.off("drain", done);
        res.off("close", done);
        resolve();
      };
      res.on("drain", done);
      res.on("close", done);
    });
  }

  const turn: TurnStream = { signal: controller.signal, emit: send };

  return {
    turn,
    send,
    /** End with an `error` event mirroring the JSON endpoint's status for `err`. */
    async fail(label: string, err: unknown) {
      if (controller.signal.aborted) {
        console.info(JSON.stringify({ level: "info", event: "stream_client_gone", path: req.originalUrl }));
        return;
      }
      await send(toErrorEvent(label, err));
    },
    end() {
      ended = true;
      clearInterval(keepalive);
      if (!res.writableEnded) res.end();
    },
  };
}

class ClientGone extends Error {
  constructor() {
    super("The client closed the connection");
    this.name = "ClientGone";
  }
}

/** The event equivalent of sendInterviewError: same statuses, same messages. */
function toErrorEvent(label: string, err: unknown): StreamError {
  if (err instanceof DomainError) {
    return { type: "error", status: err.status, error: err.message, retryable: false };
  }
  if (err instanceof AIServiceError) {
    return {
      type: "error",
      status: err.statusCode === 429 ? 429 : 503,
      error: getAIServiceMessage(err),
      retryable: true,
    };
  }
  console.error(label, err);
  return { type: "error", status: 500, error: "Internal server error", retryable: false };
}
