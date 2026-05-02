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
 * Server-side admin gate. Call at the top of admin layouts/pages.
 * Returns the session if admin, calls notFound() otherwise.
 */
export async function requireAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user || !isAdminEmail(session.user.email)) {
    notFound();
  }

  return session;
}
