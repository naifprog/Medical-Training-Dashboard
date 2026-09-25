import pg from "pg";

// PostgreSQL's `date` type (OID 1082) has no time-of-day/timezone component,
// but node-postgres's default parser turns it into a JS Date at UTC
// midnight, which display code can then shift by a day depending on the
// viewer's local timezone. Keep it as the plain "YYYY-MM-DD" text Postgres
// already sends on the wire so date-only columns (e.g. assignments.due_date)
// are never subject to timezone conversion at any layer.
pg.types.setTypeParser(1082, (val) => val);

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export function query(text, params) {
  return pool.query(text, params);
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
