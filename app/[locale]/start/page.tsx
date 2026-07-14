import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { ensureFirstBoard } from '@/lib/boards/ensure-first-board';

/**
 * Post-signup landing route. Drops a brand-new user straight into their first
 * board (auto-creating it) so they skip the empty dashboard entirely. Returning
 * users who already have boards fall through to the dashboard.
 *
 * Signup (email + Google) redirects here; sign-in still goes to /dashboard.
 */
export default async function StartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect('/sign-in');
  }

  const { boardId, created } = await ensureFirstBoard(session.user);
  redirect(created ? `/boards/${boardId}` : '/dashboard');
}
