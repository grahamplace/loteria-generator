import { NextResponse } from 'next/server';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/db';
import { cards, games } from '@/db/schema';
import { isValidGameCodeFormat } from '@/lib/live-game/game-code';

/**
 * Card art for a Game's Set: `{ [cardId]: { id, label, src } }`.
 *
 * The wire protocol carries card **ids** only — a Call is one uuid, not an
 * image — so the client resolves them once per Game rather than per Call.
 *
 * Public by necessity: Players have no account. The Game Code is the gate,
 * which is the same gate as the Board itself, and an ended Game stops serving
 * so an old Code cannot be used to browse someone's Set forever.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isValidGameCodeFormat(code)) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  }

  const [game] = await db
    .select({ boardId: games.boardId })
    .from(games)
    .where(and(eq(games.code, code), ne(games.status, 'ended')))
    .limit(1);

  if (!game) return NextResponse.json({ error: 'no_such_game' }, { status: 404 });

  const rows = await db
    .select({ id: cards.id, label: cards.label, illustrationUrl: cards.illustrationUrl })
    .from(cards)
    .where(and(eq(cards.boardId, game.boardId), eq(cards.status, 'completed')));

  return NextResponse.json({
    cards: Object.fromEntries(
      rows.map((c) => [c.id, { id: c.id, label: c.label, src: c.illustrationUrl ?? '' }])
    ),
  });
}
