import { db, userProfiles } from '@/db';
import { eq } from 'drizzle-orm';
import { parseThemeEntry } from '@/lib/theme-entry';
import { ThemeEntry } from '@/components/theme-entry';
import { DEFAULT_BOARD_NAME } from '@/lib/constants';
import { cookies, headers } from 'next/headers';
import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { auth } from '@/lib/auth';
import { ensureFirstBoard } from '@/lib/boards/ensure-first-board';
import { RECENT_BOARD_COOKIE } from '@/lib/boards/recent-board';
import { SIGN_IN_LOOP_BREAKER_PARAM, SIGN_IN_LOOP_BREAKER_VALUE } from '@/lib/safe-redirect';

/**
 * The universal post-auth funnel. Signup, sign-in, and the proxy's bounce of an
 * already-authenticated user off `/sign-in` / `/sign-up` all land here.
 *
 * It guarantees a board exists (`ensureFirstBoard` is idempotent, so this also
 * repairs users who somehow ended up with zero), then opens their last-used
 * board, falling back to their most recently updated board. Switching boards
 * happens inside the editor; there is no intermediate board index.
 *
 * Every redirect below goes through next-intl's locale-aware `redirect` so a
 * Spanish visitor stays on `/es/…`. Since this route is now on the path of every
 * sign-in, a plain `next/navigation` redirect here would drop `es-MX` users into
 * the English tree on every single login.
 */
export default async function StartPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ theme?: string; mode?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const entry = parseThemeEntry(query.theme, query.mode);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    // Reaching this branch means the proxy saw a session cookie (that is all it
    // can see at the edge) but the token behind it is expired or revoked. A bare
    // `/sign-in` redirect would be bounced straight back here by the proxy's
    // auth-route rule, looping until the browser gives up — so tag it.
    redirect({
      href: {
        pathname: '/sign-in',
        query: {
          [SIGN_IN_LOOP_BREAKER_PARAM]: SIGN_IN_LOOP_BREAKER_VALUE,
          ...(entry
            ? {
                callbackUrl: `${locale === 'es-MX' ? '/es' : ''}/start?theme=${entry.theme}&mode=${entry.photoMode}`,
              }
            : {}),
        },
      },
      locale,
    });
    // Unreachable — `redirect` throws. next-intl's `redirect` is a destructured
    // const rather than a declared function, so TypeScript won't treat its
    // `never` return as terminating the branch; this return does the narrowing.
    return null;
  }

  const store = await cookies();
  const { boardId } = await ensureFirstBoard(session.user, store.get(RECENT_BOARD_COOKIE)?.value);
  if (entry) {
    const available = await db.query.boards.findMany({
      where: (board, { eq }) => eq(board.userId, session.user.id),
      with: { cards: { columns: { id: true } } },
    });
    const starter =
      available.length === 1 &&
      available[0].name === DEFAULT_BOARD_NAME &&
      !available[0].styleOptions &&
      available[0].cards.length === 0
        ? available[0].id
        : undefined;
    return (
      <ThemeEntry
        theme={entry.theme}
        photoMode={entry.photoMode}
        boards={available.map((b) => ({ id: b.id, name: b.name, cardCount: b.cards.length }))}
        starterId={starter}
      />
    );
  }
  // Saved preferences apply at the authenticated entry point, never on public pages.
  if (!store.get('LOCALE')) {
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, session.user.id),
      columns: { locale: true },
    });
    if ((profile?.locale === 'en' || profile?.locale === 'es-MX') && profile.locale !== locale)
      redirect({ href: '/start', locale: profile.locale });
  }
  redirect({
    href: `/boards/${boardId}`,
    locale,
  });
}
