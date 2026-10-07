import type { Router } from "express";
import { describe, expect, it } from "vitest";
import { API_ROUTES } from "../routes";
import { createResponseValidator, documentedOperations, loadSpec } from "../openapi/spec";

/**
 * The spec and the mounted routes must describe the same API (D-062). Response shapes are
 * checked separately: the route-test harness validates every response it receives.
 */
type Layer = { route?: { path: string; methods: Record<string, boolean> } };

function mountedOperations(): string[] {
  const ops: string[] = [];
  for (const [mountPath, router] of API_ROUTES) {
    for (const layer of (router as Router & { stack: Layer[] }).stack) {
      if (!layer.route) continue;
      const sub = layer.route.path === "/" ? "" : layer.route.path;
      const path = `/api${mountPath}${sub}`.replace(/:(\w+)/g, "{$1}");
      for (const method of Object.keys(layer.route.methods)) ops.push(`${method.toUpperCase()} ${path}`);
    }
  }
  return ops.sort();
}

describe("OpenAPI contract", () => {
  it("documents every mounted route, and nothing that isn't mounted", () => {
    expect(documentedOperations().sort()).toEqual(mountedOperations());
  });

  it("gives every operation an id, which the generated client uses for names", () => {
    const missing = Object.entries(loadSpec().paths).flatMap(([path, item]) =>
      Object.entries(item as Record<string, { operationId?: string }>)
        .filter(([method, op]) => ["get", "post", "put", "patch", "delete"].includes(method) && !op.operationId)
        .map(([method]) => `${method.toUpperCase()} ${path}`)
    );
    expect(missing).toEqual([]);
  });

  it("documents a 401 with the session code on every protected operation", () => {
    const spec = loadSpec() as unknown as {
      security: unknown[];
      paths: Record<string, Record<string, { security?: unknown[]; responses: Record<string, unknown> }>>;
    };
    const unprotectedOk = (sec?: unknown[]) => Array.isArray(sec) && (sec.length === 0 || sec.some((s) => JSON.stringify(s) === "{}"));
    const missing: string[] = [];
    for (const [path, item] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(item)) {
        if (!op?.responses || unprotectedOk(op.security)) continue;
        if (!op.responses["401"]) missing.push(`${method.toUpperCase()} ${path}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("rejects a response that drifts from the spec", () => {
    const check = createResponseValidator();
    const good = { leaderboard: [], total: 0, page: 1, limit: 20 };
    expect(check("GET", "/api/leaderboard?page=1", 200, good)).toEqual({ ok: true });
    // A renamed field, an undocumented status, an undocumented route.
    expect(check("GET", "/api/leaderboard", 200, { ...good, totals: 0 }).ok).toBe(false);
    expect(check("GET", "/api/leaderboard", 418, { error: "teapot" }).ok).toBe(false);
    expect(check("GET", "/api/nope", 200, {}).ok).toBe(false);
    // A literal segment wins over a parameter: /users/me is not /users/{username}.
    expect(check("GET", "/api/users/me", 200, { profile: {} }).ok).toBe(false);
  });
});

describe("OpenAPI document", () => {
  it("is a valid OpenAPI 3.1 document", async () => {
    const { Validator } = await import("@seriousme/openapi-schema-validator");
    const validator = new Validator();
    const result = await validator.validate(loadSpec() as unknown as Parameters<typeof validator.validate>[0]);
    expect(result.errors ?? []).toEqual([]);
    expect(result.valid).toBe(true);
  });
});
