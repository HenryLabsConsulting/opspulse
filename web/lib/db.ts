import { Pool } from "pg";

// A single shared connection pool, reused across requests. In Next.js the
// module is evaluated once per server process, so the pool persists.
let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        "postgresql://opspulse:opspulse@localhost:5432/opspulse",
      max: 5,
    });
  }
  return pool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}
