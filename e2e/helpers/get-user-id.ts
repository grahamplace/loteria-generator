import { eq } from 'drizzle-orm';
import { user } from '@/db/schema';
import { db } from './db';

export async function getUserIdByEmail(email: string): Promise<string> {
  const rows = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
  if (rows.length === 0) {
    throw new Error(`No user with email ${email}`);
  }
  return rows[0].id;
}
