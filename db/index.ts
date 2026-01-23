import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Create the Neon client
const sql = neon(process.env.DATABASE_URL!);

// Create the Drizzle database instance with schema
export const db = drizzle(sql, { schema });

// Export schema for convenience
export * from './schema';
