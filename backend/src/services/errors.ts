/**
 * An expected failure a service reports to its route: the status and message are
 * exactly what the client receives, and `extra` is merged into the JSON body. Routes
 * turn it into a response with `sendDomainError`; anything else is a 500.
 */
export class DomainError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly extra: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const badRequest = (message: string) => new DomainError(400, message);
export const notFound = (message: string) => new DomainError(404, message);

// Connection-level failures, as `pg` reports them: the network codes when Postgres can't be
// reached, SQLSTATE class 08 (connection exception), 57P01-57P03 (shutdown, crash, starting
// up) and 53300 (too many connections). A query error such as a constraint violation is
// none of these and stays a 500.
const UNAVAILABLE_CODES = new Set([
  "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EHOSTUNREACH", "ENETUNREACH", "EPIPE",
  "57P01", "57P02", "57P03", "53300",
]);
const UNAVAILABLE_MESSAGES = [
  "Connection terminated",
  "timeout exceeded when trying to connect",
  "Client has encountered a connection error",
];

/** True when the database is unreachable rather than the request having hit a bug. */
export function isDatabaseUnavailable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string" && (UNAVAILABLE_CODES.has(code) || code.startsWith("08"))) return true;
  return UNAVAILABLE_MESSAGES.some((m) => err.message.includes(m));
}
