import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

export const ADMIN_EMAIL = 'graham@stonecutterlabs.com';

// Cards left in 'processing' longer than this are treated as stuck and become
// eligible for the bulk retry endpoint. regenerate-illustration runs with
// `concurrency: { key: userId, limit: 1 }`, so a long queue can legitimately
// take 30+ minutes to drain — pick a threshold safely past worst-case queue
// time so we don't re-fan-out work that's just waiting its turn.
export const STUCK_PROCESSING_THRESHOLD_MS = 30 * 60 * 1000;

export function isRetriableCard(
  card: { status: string; originalImageUrl: string | null; updatedAt: Date },
  now: Date = new Date()
): boolean {
  if (card.originalImageUrl === null) return false;
  if (card.status === 'error') return true;
  if (card.status === 'processing') {
    return now.getTime() - card.updatedAt.getTime() > STUCK_PROCESSING_THRESHOLD_MS;
  }
  return false;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase() === ADMIN_EMAIL;
}

/**
 * Local-only escape hatch: with ADMIN_AUTH_BYPASS=1 under `next dev`, every
 * admin check passes without signing in. Both conditions are required, and
 * NODE_ENV is 'production' in every deployed build, so the flag does nothing
 * on Vercel even if it were set there.
 */
function adminAuthBypassed(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.ADMIN_AUTH_BYPASS === '1';
}

type AdminSession = { user: { email: string } };

/**
 * The current session if it belongs to the admin, otherwise null. For API
 * routes, which answer 404 themselves; pages and actions use requireAdmin().
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  if (adminAuthBypassed()) {
    return { user: { email: ADMIN_EMAIL } };
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user || !isAdminEmail(session.user.email)) {
    return null;
  }

  return session;
}

/**
 * Server-side admin gate. Call at the top of admin layouts/pages.
 * Returns the session if admin, calls notFound() otherwise.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    notFound();
  }
  return session;
}
