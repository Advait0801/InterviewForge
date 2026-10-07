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
