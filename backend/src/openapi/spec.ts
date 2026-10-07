import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { parse } from "yaml";

/**
 * The API contract (backend/openapi/openapi.yaml, D-062) and a response validator over it.
 * Used by the route test harness, by the opt-in OPENAPI_VALIDATE_RESPONSES middleware, and
 * to serve the spec at /api/openapi.json.
 */

/** Two levels up from both src/openapi and dist/openapi. */
export const SPEC_PATH = join(__dirname, "..", "..", "openapi", "openapi.yaml");

/** Paths in the spec are relative to this prefix (its `servers` entry). */
const API_PREFIX = "/api";

type ResponseObject = { $ref?: string; content?: Record<string, { schema?: unknown }> };
type Operation = { operationId?: string; responses: Record<string, ResponseObject> };
type Spec = {
  paths: Record<string, Record<string, Operation | unknown>>;
  components: { responses?: Record<string, ResponseObject> };
};

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

let cachedSpec: Spec | undefined;
export function loadSpec(): Spec {
  cachedSpec ??= parse(readFileSync(SPEC_PATH, "utf8")) as Spec;
  return cachedSpec;
}

type Route = { method: string; template: string; pattern: RegExp; params: number; operation: Operation };

function compileRoutes(spec: Spec): Route[] {
  const routes: Route[] = [];
  for (const [template, item] of Object.entries(spec.paths)) {
    for (const method of METHODS) {
      const operation = item[method] as Operation | undefined;
      if (!operation) continue;
      const source = template
        .split("/")
        .map((seg) => (seg.startsWith("{") ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
        .join("/");
      routes.push({
        method,
        template,
        pattern: new RegExp(`^${source}/?$`),
        params: (template.match(/\{/g) ?? []).length,
        operation,
      });
    }
  }
  // A literal segment beats a parameter: /users/me before /users/{username}.
  return routes.sort((a, b) => a.params - b.params);
}

/** Every documented operation as `METHOD /api/path/{param}`. */
export function documentedOperations(spec = loadSpec()): string[] {
  return compileRoutes(spec).map((r) => `${r.method.toUpperCase()} ${API_PREFIX}${r.template}`);
}

export type ResponseCheck = { ok: true } | { ok: false; problem: string };

export function createResponseValidator(spec = loadSpec()) {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  ajv.addSchema(spec as object, "spec");
  const routes = compileRoutes(spec);
  const compiled = new Map<string, ValidateFunction>();

  const pointer = (...parts: string[]) =>
    "spec#/" + parts.map((p) => p.replace(/~/g, "~0").replace(/\//g, "~1")).join("/");

  function resolveResponse(response: ResponseObject): { ref: string[]; response: ResponseObject } | null {
    if (response.$ref) {
      const name = response.$ref.replace("#/components/responses/", "");
      const target = spec.components.responses?.[name];
      return target ? { ref: ["components", "responses", name], response: target } : null;
    }
    return { ref: [], response };
  }

  /** Check one response against the spec. `path` is the request path, query string allowed. */
  return function checkResponse(method: string, path: string, status: number, body: unknown): ResponseCheck {
    const bare = path.split("?")[0];
    if (!bare.startsWith(API_PREFIX)) return { ok: false, problem: `${path} is outside ${API_PREFIX}` };
    const local = bare.slice(API_PREFIX.length) || "/";
    const route = routes.find((r) => r.method === method.toLowerCase() && r.pattern.test(local));
    if (!route) return { ok: false, problem: `${method.toUpperCase()} ${bare} is not in the spec` };

    const declared = route.operation.responses[String(status)];
    if (!declared) {
      return { ok: false, problem: `${method.toUpperCase()} ${route.template} doesn't document status ${status}` };
    }
    const resolved = resolveResponse(declared);
    if (!resolved) return { ok: false, problem: `unresolvable response $ref ${declared.$ref}` };
    if (!resolved.response.content?.["application/json"]) return { ok: true }; // e.g. a redirect

    const key = `${route.method} ${route.template} ${status}`;
    let validate = compiled.get(key);
    if (!validate) {
      const ref = resolved.ref.length
        ? pointer(...resolved.ref, "content", "application/json", "schema")
        : pointer("paths", route.template, route.method, "responses", String(status), "content", "application/json", "schema");
      validate = ajv.compile({ $ref: ref });
      compiled.set(key, validate);
    }
    if (validate(body)) return { ok: true };
    const errors = (validate.errors ?? [])
      .slice(0, 5)
      .map((e) => `${e.instancePath || "(body)"} ${e.message}${e.params && "additionalProperty" in e.params ? ` (${(e.params as { additionalProperty: string }).additionalProperty})` : ""}`)
      .join("; ");
    return { ok: false, problem: `${method.toUpperCase()} ${route.template} ${status}: ${errors}` };
  };
}
