import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isAdminEmail } from '@/lib/admin';
import { db, cards } from '@/db';
import { eq } from 'drizzle-orm';
import { uploadIllustration, base64ToBuffer } from '@/lib/blob';
import { invalidateBoardPreview } from '@/lib/invalidate-board-preview';
import { replaceIllustrationSchema } from '@/lib/validations';
import sharp from 'sharp';

// Cap the stored illustration so a manual upload can't balloon blob storage.
// AI illustrations are 1024×1536; 2048 leaves generous headroom for hi-res edits.
const MAX_ILLUSTRATION_WIDTH = 2048;

/**
 * PUT /api/admin/cards/[cardId]/illustration
 *
 * Admin-only escape hatch: overwrite a card's illustration with a manually
 * uploaded image, used as-is. No AI is triggered. Clears the preserve-original
 * and crop flags so the proxies serve the new image verbatim (the serve-time
 * crop only applies when preserveOriginal && cropData).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || !isAdminEmail(session.user.email)) {
      return new NextResponse('Not found', { status: 404 });
    }

    const { cardId } = await params;
    const body = await request.json();
    const parsed = replaceIllustrationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const card = await db.query.cards.findFirst({ where: eq(cards.id, cardId) });
    if (!card) {
      return new NextResponse('Not found', { status: 404 });
    }
    if (card.isDefault) {
      return NextResponse.json(
        { error: 'Cannot replace the illustration on a default card' },
        { status: 400 }
      );
    }

    // Normalize any input format (jpg/webp/png) to PNG so the bytes match the
    // fixed illustration.png path + image/png content type uploadIllustration
    // writes. rotate() bakes in EXIF orientation, then metadata is stripped.
    const buffer = base64ToBuffer(parsed.data.illustrationBase64);
    const pngBuffer = await sharp(buffer)
      .rotate()
      .resize({ width: MAX_ILLUSTRATION_WIDTH, withoutEnlargement: true })
      .png()
      .toBuffer();

    const illustrationUrl = await uploadIllustration(card.userId, card.boardId, card.id, pngBuffer);

    const [updatedCard] = await db
      .update(cards)
      .set({
        illustrationUrl,
        status: 'completed',
        errorMessage: null,
        preserveOriginal: false,
        cropData: null,
        updatedAt: new Date(),
      })
      .where(eq(cards.id, card.id))
      .returning();

    await invalidateBoardPreview(card.boardId, card.userId);

    return NextResponse.json({ card: updatedCard });
  } catch (error) {
    console.error('Error replacing illustration:', error);
    return NextResponse.json({ error: 'Failed to replace illustration' }, { status: 500 });
  }
}
