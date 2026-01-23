import { defineConfig } from 'drizzle-kit';
import { loadEnvConfig } from '@next/env';

// Ensure drizzle-kit loads Next.js env files (.env.local, etc.)
loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL (or POSTGRES_URL) for drizzle-kit.');
}

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  // Only manage our public schema tables, not neon_auth
  schemaFilter: ['public'],
});
