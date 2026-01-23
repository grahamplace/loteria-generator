import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db, cards, boards } from '@/db';
import { eq, and } from 'drizzle-orm';

/**
 * Private image proxy - serves images from Vercel Blob with auth check
 * URL pattern: /api/images/{boardId}/{cardId}/{type}
 * where type is 'original' or 'illustration'
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Get the session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const pathParts = (await params).path;

    if (pathParts.length < 3) {
      return new NextResponse('Invalid path', { status: 400 });
    }

    const [boardId, cardId, type] = pathParts;

    if (type !== 'original' && type !== 'illustration') {
      return new NextResponse('Invalid image type', { status: 400 });
    }

    // Verify the user owns this board
    const board = await db.query.boards.findFirst({
      where: and(eq(boards.id, boardId), eq(boards.userId, session.user.id)),
    });

    if (!board) {
      return new NextResponse('Not found', { status: 404 });
    }

    // Get the card to retrieve the image URL
    const card = await db.query.cards.findFirst({
      where: and(eq(cards.id, cardId), eq(cards.boardId, boardId)),
    });

    if (!card) {
      return new NextResponse('Card not found', { status: 404 });
    }

    const imageUrl = type === 'original' ? card.originalImageUrl : card.illustrationUrl;

    if (!imageUrl) {
      return new NextResponse('Image not found', { status: 404 });
    }

    // Fetch the image from Vercel Blob and proxy it
    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      return new NextResponse('Failed to fetch image', { status: 500 });
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/png';

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}
