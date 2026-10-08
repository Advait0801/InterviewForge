/**
 * Shared scaffolding for route-level tests.
 *
 * Each test file mounts one real router behind the same middleware index.ts uses
 * (json body, global optionalAuth), talks to it over HTTP, and replaces Postgres with
 * a scripted fake. The fake is strict: a query no handler claims throws, which the
 * route turns into a 500, so a test can't pass while the route runs SQL nobody
 * expected.
 *
 * Usage, in a test file:
 *   const db = vi.hoisted(() => ({ handlers: [], calls: [] }) as FakeDb);
 *   vi.mock("../db", async () => (await import("./helpers/fake-db")).fakeDbModule(db));
 */
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express, { type Router } from "express";
import { signAccessToken } from "../../auth";
import { optionalAuth } from "../../middleware/auth.middleware";
import { createResponseValidator } from "../../openapi/spec";

export * from "./fake-db";
import { USER_ID } from "./fake-db";

export const tokenFor = (userId = USER_ID) => signAccessToken({ userId, tokenVersion: 0 });

// Every response a route test receives must match backend/openapi/openapi.yaml (D-062), so
// a handler can't change its shape, or start returning an undocumented status, unnoticed.
const checkResponse = createResponseValidator();

export type TestServer = {
  /**
   * `events` is set for a `text/event-stream` response: each event's parsed `data`, every
   * one checked against the spec (D-065). `body` is then empty.
   */
  request: (
    method: string,
    path: string,
    opts?: { body?: unknown; token?: string | null }
  ) => Promise<{ status: number; body: Record<string, any>; events?: Record<string, any>[] }>;
  /** The server's origin, for tests that need a raw connection (disconnects, slow readers). */
  url: string;
  close: () => Promise<void>;
};

/** Parse a whole `text/event-stream` body; `event:` must agree with the data's `type`. */
export function parseEventStream(text: string): Record<string, any>[] {
  return text
    .split("\n\n")
    .map((block) => block.split("\n").filter((line) => line && !line.startsWith(":")))
    .filter((lines) => lines.length)
    .map((lines) => {
      const field = (name: string) => lines.find((l) => l.startsWith(`${name}: `))?.slice(name.length + 2);
      const data = JSON.parse(field("data") ?? "null");
      if (field("event") !== data?.type) throw new Error(`event ${field("event")} carries type ${data?.type}`);
      return data;
    });
}

/**
 * Serve `router` at `mountPath`. Requests carry a token for USER_ID unless
 * `token: null` (anonymous) or another token is given.
 */
export async function serve(mountPath: string, router: Router): Promise<TestServer> {
  const app = express();
  app.use(express.json({ limit: "8mb" })); // as index.ts
  app.use("/api", optionalAuth);
  app.use(mountPath, router);
  const server: Server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    async request(method, path, opts = {}) {
      const token = opts.token === undefined ? tokenFor() : opts.token;
      const res = await fetch(`${base}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      });
      const text = await res.text();
      if (res.headers.get("content-type")?.startsWith("text/event-stream")) {
        const events = parseEventStream(text);
        const check = checkResponse(method, path, res.status, events);
        if (!check.ok) throw new Error(`Response breaks the OpenAPI contract: ${check.problem}`);
        return { status: res.status, body: {}, events };
      }
      const body = text ? JSON.parse(text) : {};
      const check = checkResponse(method, path, res.status, body);
      if (!check.ok) throw new Error(`Response breaks the OpenAPI contract: ${check.problem}`);
      return { status: res.status, body };
    },
    url: base,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
