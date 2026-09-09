import { randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";

export const CORRELATION_HEADER = "x-request-id";

export interface CorrelatedRequest extends Request {
  correlationId?: string;
}

/**
 * Give every request an id and propagate it downstream.
 *
 * A single user action fans out across four services -- browser to Express, then
 * to ai-service and code-runner -- and without a shared id their logs cannot be
 * joined. Debugging "the interview failed" then means guessing which of three
 * ai-service log lines belongs to your request.
 *
 * An inbound id is trusted and reused so a client (or a future gateway) can
 * correlate across a whole session; otherwise one is generated.
 */
export function correlationId(req: CorrelatedRequest, res: Response, next: NextFunction) {
  const inbound = req.header(CORRELATION_HEADER);
  const id = inbound && inbound.length <= 200 ? inbound : randomUUID();
  req.correlationId = id;
  res.setHeader(CORRELATION_HEADER, id);
  next();
}

/** Async-local storage would be cleaner, but this keeps the change small. */
let current: string | undefined;

export function setCurrentCorrelationId(id: string | undefined) {
  current = id;
}

export function getCurrentCorrelationId(): string | undefined {
  return current;
}
