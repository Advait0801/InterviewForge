/**
 * The scripted Postgres fake behind the route tests (see harness.ts). Kept free of
 * app imports so a test's vi.mock("../db") factory can load it without a cycle.
 */
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

/**
 * Stand-in for the whole db module. withTransaction records BEGIN / COMMIT / ROLLBACK
 * as calls, so a test can assert that a failure mid-way rolled back. (The fake keeps no
 * state, so there's nothing to undo; what's under test is that the route used a
 * transaction and aborted it.)
 */
export function fakeDbModule(db: FakeDb) {
  const query = (sql: string, params: unknown[] = []) => fakeQuery(db, sql, params);
  const mark = (sql: string) => db.calls.push({ sql, params: [] });
  return {
    query,
    async withTransaction<T>(fn: (tx: { query: typeof query }) => Promise<T>): Promise<T> {
      mark("BEGIN");
      try {
        const out = await fn({ query });
        mark("COMMIT");
        return out;
      } catch (err) {
        mark("ROLLBACK");
        throw err;
      }
    },
  };
}
