import type { NextFunction, Request, Response } from "express";

/**
 * The last two handlers in the chain. Without them Express answers with its own HTML pages,
 * and its error page prints the stack trace (file paths, the node_modules layout) unless
 * NODE_ENV is "production", which nothing set. The API speaks JSON on every path, errors
 * included, and never returns a stack.
 */

/** No route matched. */
export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

/** body-parser marks its own failures with `type` and the status to send. */
type BodyParserError = Error & { type?: string; status?: number };

/** Anything a route or middleware passed on, or threw, without answering. */
export function errorHandler(err: BodyParserError, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err);
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body is not valid JSON" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large" });
  }
  if (typeof err.status === "number" && err.status >= 400 && err.status < 500) {
    // Other body-parser rejections (an unsupported charset or encoding): the client's error.
    return res.status(err.status).json({ error: "The request could not be read" });
  }
  console.error(`Unhandled error on ${req.method} ${req.originalUrl}`, err);
  return res.status(500).json({ error: "Internal server error" });
}
