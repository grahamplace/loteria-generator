import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { lazyClient, requireEnv } from '@/lib/lazy-client';
import * as schema from './schema';

// Built on the first query rather than at module scope: `next build` evaluates
// every route module while collecting page data, and neon() throws when
// DATABASE_URL is unset — which fails the build on any environment missing the
// secret, far from the code that actually needs it.
export const db = lazyClient(() =>
  drizzle(neon(requireEnv('DATABASE_URL', 'the database client')), { schema })
);

// Export schema for convenience
export * from './schema';
