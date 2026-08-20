import { headers } from 'next/headers';
import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { auth } from '@/lib/auth';
import { ensureFirstBoard } from '@/lib/boards/ensure-first-board';
import { SIGN_IN_LOOP_BREAKER_PARAM, SIGN_IN_LOOP_BREAKER_VALUE } from '@/lib/safe-redirect';

/**
 * The universal post-auth funnel. Signup, sign-in, and the proxy's bounce of an
 * already-authenticated user off `/sign-in` / `/sign-up` all land here.
 *
 * It guarantees a board exists (`ensureFirstBoard` is idempotent, so this also
 * repairs users who somehow ended up with zero) and then routes by board count:
 * a user with exactly one board goes straight into it — nobody sees an empty
 * dashboard, a known drop-off point. Only multi-board users get the dashboard.
 *
 * Every redirect below goes through next-intl's locale-aware `redirect` so a
 * Spanish visitor stays on `/es/…`. Since this route is now on the path of every
 * sign-in, a plain `next/navigation` redirect here would drop `es-MX` users into
 * the English tree on every single login.
 */
export default async function StartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    // Reaching this branch means the proxy saw a session cookie (that is all it
    // can see at the edge) but the token behind it is expired or revoked. A bare
    // `/sign-in` redirect would be bounced straight back here by the proxy's
    // auth-route rule, looping until the browser gives up — so tag it.
    redirect({
      href: {
        pathname: '/sign-in',
        query: { [SIGN_IN_LOOP_BREAKER_PARAM]: SIGN_IN_LOOP_BREAKER_VALUE },
      },
      locale,
    });
    // Unreachable — `redirect` throws. next-intl's `redirect` is a destructured
    // const rather than a declared function, so TypeScript won't treat its
    // `never` return as terminating the branch; this return does the narrowing.
    return null;
  }

  const { boardId, created, boardCount } = await ensureFirstBoard(session.user);
  redirect({
    href: created || boardCount === 1 ? `/boards/${boardId}` : '/dashboard',
    locale,
  });
}
