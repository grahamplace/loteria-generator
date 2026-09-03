import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { boards, games } from '@/db/schema';
import { CallerView } from '@/components/live-game/caller-view';

/**
 * The Caller's screen. Gated on owning the Set, because the Caller *is* the Set
 * owner — the socket re-checks this every time it mints a ticket, and this
 * check is so the page does not render before failing.
 */
export default async function CallerPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  setRequestLocale(locale);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) notFound();

  const [game] = await db
    .select({ code: games.code, setName: boards.name })
    .from(games)
    .innerJoin(boards, eq(games.boardId, boards.id))
    .where(and(eq(games.code, code), eq(boards.userId, session.user.id)))
    .limit(1);

  // notFound rather than a 403: a Game Code belonging to someone else should
  // not be confirmable by probing this route.
  if (!game) notFound();

  return <CallerView code={game.code} setName={game.setName} />;
}
