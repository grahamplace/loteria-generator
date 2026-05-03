import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '@/db/schema';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL required for e2e helpers');
}

export const db = drizzle(neon(url), { schema });
