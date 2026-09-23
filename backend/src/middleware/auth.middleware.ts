import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../auth";
import { query } from "../db";

export interface AuthRequest extends Request {
  user?: { id: string };
  /** Memoised result of authenticate(); see below. */
  authResult?: Promise<AuthResult>;
}

/**
 * Sent with every 401 caused by the session itself (missing, expired, revoked, or the
 * user no longer exists). The web client signs out only on this code, so a 401 that
 * means something else, like "current password is incorrect", doesn't log anyone out.
 */
export const SESSION_INVALID = "session_invalid";

type AuthResult =
  | { kind: "none" }
  | { kind: "ok"; userId: string }
  | { kind: "invalid"; error: string }
  | { kind: "unavailable" };

async function checkToken(authHeader: string | undefined): Promise<AuthResult> {
  if (!authHeader?.startsWith("Bearer ")) return { kind: "none" };

  let claims;
  try {
    claims = verifyAccessToken(authHeader.substring("Bearer ".length));
  } catch {
    return { kind: "invalid", error: "Invalid or expired token" };
  }

  // Revocation check (D-055): one primary-key lookup. Deliberately not cached in
  // process -- a cache would keep a revoked token alive on every other instance
  // for its TTL, which is the same per-instance trap as F-19.
  try {
    const r = await query<{ token_version: number }>(
      "SELECT token_version FROM users WHERE id = $1",
      [claims.userId]
    );
    if (r.rows.length === 0) return { kind: "invalid", error: "Account no longer exists" };
    if (r.rows[0].token_version !== claims.tokenVersion) {
      return { kind: "invalid", error: "Session has been signed out" };
    }
    return { kind: "ok", userId: claims.userId };
  } catch (err) {
    console.error("Auth token check failed", err);
    return { kind: "unavailable" };
  }
}

/**
 * Resolve the request's identity once. optionalAuth runs globally ahead of the rate
 * limiter and requireAuth runs again on protected routes; memoising on the request
 * keeps that to a single database lookup per request.
 */
function authenticate(req: AuthRequest): Promise<AuthResult> {
  req.authResult ??= checkToken(req.headers.authorization);
  return req.authResult;
}

function sendUnavailable(res: Response) {
  // A database blip is not a reason to sign the user out: 503, retryable, like the
  // other dependency-down paths.
  return res
    .status(503)
    .json({ error: "Authentication is temporarily unavailable. Please retry.", retryable: true });
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const result = await authenticate(req);
  switch (result.kind) {
    case "ok":
      req.user = { id: result.userId };
      return next();
    case "none":
      return res
        .status(401)
        .json({ error: "Missing or invalid Authorization header", code: SESSION_INVALID });
    case "invalid":
      return res.status(401).json({ error: result.error, code: SESSION_INVALID });
    case "unavailable":
      return sendUnavailable(res);
  }
}

/**
 * Sets req.user when a valid, unrevoked Bearer token is present; otherwise continues
 * anonymously. A bad token is ignored rather than rejected, so public routes keep
 * working for a client holding a stale token.
 */
export async function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const result = await authenticate(req);
  if (result.kind === "unavailable") return sendUnavailable(res);
  if (result.kind === "ok") req.user = { id: result.userId };
  next();
}
