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

export * from "./fake-db";
import { USER_ID } from "./fake-db";

export const tokenFor = (userId = USER_ID) => signAccessToken({ userId, tokenVersion: 0 });

export type TestServer = {
  request: (
    method: string,
    path: string,
    opts?: { body?: unknown; token?: string | null }
  ) => Promise<{ status: number; body: Record<string, any> }>;
  close: () => Promise<void>;
};

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
      return { status: res.status, body: text ? JSON.parse(text) : {} };
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
