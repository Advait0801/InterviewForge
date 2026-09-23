import { Pool, type QueryResult, type QueryResultRow } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// When Postgres closes an idle pooled connection (a restart, a failover, RDS
// maintenance), pg emits "error" on the pool. With no listener, Node treats it as
// an unhandled error and the whole backend process dies. Log it instead: the pool
// drops the dead client, requests fail with a clean 5xx while the database is
// away, and the service recovers on its own when the database returns (D-055).
pool.on("error", (err) => {
  console.error("[db] idle client error (connection dropped):", err.message);
});

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}
export type Queryable = { query: typeof query };

/**
 * Run `fn` inside one transaction on one pooled connection: COMMIT if it resolves,
 * ROLLBACK if it throws (D-057). For routes that make several writes that must land
 * together -- a half-applied interview turn or a session with no question is worse
 * than a clean failure the client can retry.
 *
 * Keep slow work (LLM calls, code execution) outside `fn`: a transaction holds its
 * connection and row locks until it ends.
 */
export async function withTransaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn({
      query: <R extends QueryResultRow = any>(text: string, params?: any[]) =>
        client.query<R>(text, params),
    });
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
