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