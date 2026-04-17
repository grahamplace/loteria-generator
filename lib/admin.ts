import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

export const ADMIN_EMAIL = 'graham@stonecutterlabs.com';

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
