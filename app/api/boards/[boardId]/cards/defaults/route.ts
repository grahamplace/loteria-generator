import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db, boards, cards } from '@/db';
import { addDefaultCardsSchema } from '@/lib/validations';
import { DEFAULT_CARDS_BY_ID } from '@/lib/default-cards';
import { invalidateBoardPreview } from '@/lib/invalidate-board-preview';
import { getPostHogClient } from '@/lib/posthog-server';

const MAX_CARDS_FREE = 4;
const MAX_CARDS_UNLOCKED = 54;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { boardId } = await params;
    const body = await request.json();
    const parsed = addDefaultCardsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { defaultCardIds } = parsed.data;

    // Validate every id exists in the manifest.
    const unknown = defaultCardIds.filter((id) => !DEFAULT_CARDS_BY_ID[id]);
    if (unknown.length > 0) {
      return NextResponse.json(
        {
          error: 'Unknown default card id(s)',
          code: 'INVALID_DEFAULT_ID',
          unknownIds: unknown,
        },
        { status: 400 }
      );
    }

    // Verify board ownership.
    const board = await db.query.boards.findFirst({
      where: and(eq(boards.id, boardId), eq(boards.userId, session.user.id)),
    });
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Pull existing cards once for dedup + limit checks.
    const existingCards = await db.query.cards.findMany({
      where: eq(cards.boardId, boardId),
    });

    // Dedup against existing default ids on this board.
    const existingDefaultIds = new Set(
      existingCards.map((c) => c.defaultCardId).filter((id): id is string => !!id)
    );
    const conflicts = defaultCardIds.filter((id) => existingDefaultIds.has(id));
    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          error: 'One or more classics already on this board',
          code: 'ALREADY_ADDED',
          conflictIds: conflicts,
        },
        { status: 409 }
      );
    }

    // Card-limit check.
    const maxCards = board.isUnlocked ? MAX_CARDS_UNLOCKED : MAX_CARDS_FREE;
    if (existingCards.length + defaultCardIds.length > maxCards) {
      return NextResponse.json(
        {
          error: 'Card limit reached',
          message: board.isUnlocked
            ? `Maximum of ${MAX_CARDS_UNLOCKED} cards allowed`
            : `Unlock this board to add more than ${MAX_CARDS_FREE} cards`,
          code: 'CARD_LIMIT_REACHED',
        },
        { status: 403 }
      );
    }

    // Compute starting number.
    const maxNumber = existingCards.reduce((m, c) => (c.number > m ? c.number : m), 0);

    // Build insert rows.
    const rows = defaultCardIds.map((id, i) => {
      const def = DEFAULT_CARDS_BY_ID[id]!;
      return {
        boardId,
        userId: session.user.id,
        number: maxNumber + i + 1,
        label: def.label,
        originalImageUrl: null,
        illustrationUrl: def.src,
        status: 'completed' as const,
        isDefault: true,
        defaultCardId: id,
      };
    });

    const inserted = await db.insert(cards).values(rows).returning();

    await invalidateBoardPreview(boardId, session.user.id);

    const ph = getPostHogClient();
    if (ph) {
      ph.capture({
        distinctId: session.user.id,
        event: 'default_cards_added',
        properties: {
          count: defaultCardIds.length,
          ids: defaultCardIds,
          board_id: boardId,
        },
      });
    }

    return NextResponse.json({ cards: inserted });
  } catch (error) {
    // Postgres unique_violation in the partial index = concurrent dedup race.
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === '23505'
    ) {
      return NextResponse.json(
        { error: 'One or more classics already on this board', code: 'ALREADY_ADDED' },
        { status: 409 }
      );
    }
    console.error('Error adding default cards:', error);
    return NextResponse.json({ error: 'Failed to add default cards' }, { status: 500 });
  }
}
