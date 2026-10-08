import type { Response } from "express";
import type { AIServiceError } from "../services/ai.service";
import { DomainError } from "../services/errors";

/** HTTP helpers shared by the route files. Routes parse and validate; services decide. */

export { UUID_REGEX } from "../services/interview-state.service";

/** Route params are string | string[]; only a plain string is a usable id. */
export function getSingleParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

export function sendDomainError(res: Response, err: DomainError) {
  return res.status(err.status).json({ error: err.message, ...err.extra });
}

export function sendInternalError(res: Response, label: string, err: unknown) {
  console.error(label, err);
  return res.status(500).json({ error: "Internal server error" });
}

/** FastAPI's `detail` when the ai-service gave one, else the error's own message. */
export function getAIServiceMessage(err: AIServiceError): string {
  if (
    typeof err.details === "object" &&
    err.details !== null &&
    "detail" in err.details &&
    typeof (err.details as { detail?: unknown }).detail === "string"
  ) {
    return (err.details as { detail: string }).detail;
  }

  return err.message;
}
