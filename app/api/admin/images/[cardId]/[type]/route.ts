import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isAdminEmail } from '@/lib/admin';
import { db, cards } from '@/db';
import { eq } from 'drizzle-orm';
import { getPrivateBlob } from '@/lib/blob';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string; type: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user || !isAdminEmail(session.user.email)) {
      return new NextResponse('Not found', { status: 404 });
    }

    const { cardId, type } = await params;

    if (type !== 'original' && type !== 'illustration') {
      return new NextResponse('Not found', { status: 404 });
    }

    const card = await db.query.cards.findFirst({
      where: eq(cards.id, cardId),
    });

    if (!card) {
      return new NextResponse('Not found', { status: 404 });
    }

    const imageUrl = type === 'original' ? card.originalImageUrl : card.illustrationUrl;

    if (!imageUrl) {
      return new NextResponse('Not found', { status: 404 });
    }

    const result = await getPrivateBlob(imageUrl);

    if (result?.statusCode !== 200) {
      return new NextResponse('Not found', { status: 404 });
    }

    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-cache',
        ETag: result.blob.etag,
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
