/**
 * The socket server's own database client.
 *
 * Deliberately NOT `@/db`: the app uses `@neondatabase/serverless`, whose HTTP
 * driver has no transaction support. A long-lived process needs `pg` +
 * `drizzle-orm/node-postgres`. See docs/adr/0001.
 */
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@/db/schema';

/**
 * `idleTimeoutMillis` is deliberately long. Measured from `iad` against Neon
 * `us-east-1`: a warm query is 2-3ms, a reconnect is 25-400ms. A manual-draw
 * game leaves gaps of seconds to minutes between Calls, so a short timeout
 * would make almost every Call pay a fresh TLS handshake. See ADR 0001's
 * amendment.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 4,
  idleTimeoutMillis: 10 * 60_000,
  connectionTimeoutMillis: 5_000,
});

// Not optional: an unhandled pool error takes the process down, and with it
// every Game this server is the sole arbiter for.
pool.on('error', (err) => {
  console.error('[pool] idle client error', err.message);
});

export const db = drizzle(pool, { schema });
