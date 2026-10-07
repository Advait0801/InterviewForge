import type { NextFunction, Request, Response } from "express";
import { createResponseValidator } from "./spec";

/**
 * Dev-only: with OPENAPI_VALIDATE_RESPONSES=1, every JSON response under /api is checked
 * against the spec and a violation is logged as `openapi_violation`. The route tests check
 * fixtures; this checks what real Postgres rows, real model output and real runner results
 * look like. Never enabled in production: it costs a schema validation per response.
 */
export function validateResponses() {
  const check = createResponseValidator();
  return (req: Request, res: Response, next: NextFunction) => {
    const json = res.json.bind(res);
    res.json = (body: unknown) => {
      // Check what goes over the wire: pg hands back Date objects that only become
      // ISO strings when serialised.
      const wire = body === undefined ? undefined : JSON.parse(JSON.stringify(body));
      const result = check(req.method, req.originalUrl, res.statusCode, wire);
      if (!result.ok) {
        console.warn(JSON.stringify({ level: "warn", event: "openapi_violation", problem: result.problem }));
      }
      return json(body);
    };
    next();
  };
}
