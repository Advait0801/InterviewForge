import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";
import type { AuthRequest } from "./auth.middleware";

function intFromEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Key on the authenticated user, falling back to IP.
 *
 * A purely IP-based key is the wrong unit for an LLM budget: everyone behind one
 * NAT shares a bucket, while one user on a phone gets a fresh bucket per
 * reconnect. `ipKeyGenerator` is used for the anonymous fallback because raw
 * `req.ip` mishandles IPv6 -- each address in a /64 would otherwise get its own
 * bucket, which is free to bypass.
 */
function userOrIpKey(req: Request): string {
  const userId = (req as AuthRequest).user?.id;
  return userId ? `user:${userId}` : `ip:${ipKeyGenerator(req.ip ?? "")}`;
}

/** Broad limit across the whole API. Protects against generic hammering. */
export const apiLimiter = rateLimit({
  windowMs: intFromEnv("API_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
  max: intFromEnv("API_RATE_LIMIT_MAX", 500),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
});

/**
 * Tight limit for routes that reach an LLM provider.
 *
 * These cost real money per call, and the global limiter is the wrong tool:
 * 500 requests in a window is generous for reading problems and catastrophic
 * for code review. Before this, one user could exhaust the entire provider
 * quota for everyone (F-04).
 *
 * Sized so a full interview (roughly 10 turns, plus a report) and a handful of
 * code reviews fit comfortably, while a script does not.
 */
export const llmLimiter = rateLimit({
  windowMs: intFromEnv("LLM_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
  max: intFromEnv("LLM_RATE_LIMIT_MAX", 40),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: {
    error:
      "AI request limit reached. These requests are rate limited per user to protect " +
      "shared model capacity. Please wait a few minutes and try again.",
  },
});
