import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../auth";

export interface AuthRequest extends Request {
  user?: { id: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.substring("Bearer ".length);

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.userId };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Sets req.user when a valid Bearer token is present; otherwise continues without user. */
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next();
  }
  const token = authHeader.substring("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.userId };
  } catch {
    // ignore invalid token
  }
  next();
}