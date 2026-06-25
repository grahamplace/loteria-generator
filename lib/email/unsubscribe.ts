// lib/email/unsubscribe.ts
//
// Marketing-email opt-out. Tokens are opaque per-user secrets stored on
// user_profiles, so an unsubscribe link works without an authenticated session.
import { randomBytes } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { db, userProfiles } from '@/db';

/** A URL-safe random token. base64url of 24 bytes => 32 chars, no padding. */
export function generateUnsubscribeToken(): string {
  return randomBytes(24).toString('base64url');
}

/**
 * Returns the user's unsubscribe token, creating (and persisting) one if absent.
 * Upserts the user_profiles row so it works even for users without a profile yet.
 * The `coalesce` keeps any existing token stable across calls.
 */
export async function getOrCreateUnsubscribeToken(userId: string): Promise<string> {
  const fresh = generateUnsubscribeToken();
  const [row] = await db
    .insert(userProfiles)
    .values({ id: userId, unsubscribeToken: fresh })
    .onConflictDoUpdate({
      target: userProfiles.id,
      set: { unsubscribeToken: sql`coalesce(${userProfiles.unsubscribeToken}, ${fresh})` },
    })
    .returning({ token: userProfiles.unsubscribeToken });
  return row.token ?? fresh;
}

/** True when the user has opted out of marketing email. Missing profile => subscribed. */
export async function isMarketingUnsubscribed(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ unsubscribedAt: userProfiles.marketingUnsubscribedAt })
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1);
  return Boolean(row?.unsubscribedAt);
}

export type UnsubscribeState = { found: boolean; unsubscribed: boolean };

/** Look up opt-out state by token, for rendering the confirmation page. */
export async function getUnsubscribeStateByToken(token: string): Promise<UnsubscribeState> {
  if (!token) return { found: false, unsubscribed: false };
  const [row] = await db
    .select({ unsubscribedAt: userProfiles.marketingUnsubscribedAt })
    .from(userProfiles)
    .where(eq(userProfiles.unsubscribeToken, token))
    .limit(1);
  if (!row) return { found: false, unsubscribed: false };
  return { found: true, unsubscribed: Boolean(row.unsubscribedAt) };
}

export type UnsubscribeResult = { ok: boolean; userId?: string };

/** Opt the token's owner out of marketing email. ok=false if the token is unknown. */
export async function unsubscribeByToken(token: string): Promise<UnsubscribeResult> {
  if (!token) return { ok: false };
  const rows = await db
    .update(userProfiles)
    .set({ marketingUnsubscribedAt: new Date() })
    .where(eq(userProfiles.unsubscribeToken, token))
    .returning({ id: userProfiles.id });
  return rows.length > 0 ? { ok: true, userId: rows[0].id } : { ok: false };
}

/** Re-subscribe the token's owner. ok=false if the token is unknown. */
export async function resubscribeByToken(token: string): Promise<UnsubscribeResult> {
  if (!token) return { ok: false };
  const rows = await db
    .update(userProfiles)
    .set({ marketingUnsubscribedAt: null })
    .where(eq(userProfiles.unsubscribeToken, token))
    .returning({ id: userProfiles.id });
  return rows.length > 0 ? { ok: true, userId: rows[0].id } : { ok: false };
}
