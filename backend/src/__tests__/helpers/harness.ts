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
 *   const db = vi.hoisted(() => ({ handlers: [] as Handler[], calls: [] as Call[] }));
 *   vi.mock("../db", () => ({ query: vi.fn((sql, params) => fakeQuery(db, sql, params)) }));
 */
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express, { type Router } from "express";
import { signAccessToken } from "../../auth";
import { optionalAuth } from "../../middleware/auth.middleware";

export type Row = Record<string, unknown>;
export type Call = { sql: string; params: unknown[] };
export type Result = { rows: Row[]; rowCount?: number };
export type Handler = {
  /** Matched against the whitespace-collapsed SQL. */
  match: string | RegExp;
  reply: Row[] | Result | ((params: unknown[], sql: string) => Row[] | Result);
  /** Remove the handler after it has answered once. */
  once?: boolean;
};
export type FakeDb = { handlers: Handler[]; calls: Call[] };

export const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const OTHER_USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const squash = (sql: string) => sql.replace(/\s+/g, " ").trim();

export async function fakeQuery(db: FakeDb, sql: string, params: unknown[] = []): Promise<Result> {
  const flat = squash(sql);
  db.calls.push({ sql: flat, params });

  // Every authenticated request first checks token revocation (D-055); tokens from
  // tokenFor() are always at version 0 for either known user.
  if (flat.startsWith("SELECT token_version FROM users")) {
    const known = params[0] === USER_ID || params[0] === OTHER_USER_ID;
    return { rows: known ? [{ token_version: 0 }] : [] };
  }

  const i = db.handlers.findIndex((h) =>
    typeof h.match === "string" ? flat.includes(h.match) : h.match.test(flat)
  );
  if (i === -1) throw new Error(`Unexpected query in test: ${flat.slice(0, 160)}`);
  const handler = db.handlers[i];
  if (handler.once) db.handlers.splice(i, 1);
  const out = typeof handler.reply === "function" ? handler.reply(params, flat) : handler.reply;
  return Array.isArray(out) ? { rows: out, rowCount: out.length } : { rowCount: out.rows.length, ...out };
}

export function resetDb(db: FakeDb) {
  db.handlers.length = 0;
  db.calls.length = 0;
}

/** Calls whose SQL contains `fragment`, excluding the auth lookup. */
export function callsMatching(db: FakeDb, fragment: string): Call[] {
  return db.calls.filter((c) => c.sql.includes(fragment));
}

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
