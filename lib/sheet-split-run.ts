import sharp from 'sharp';
import { db, boards, cards, getGenerationLimit } from '@/db';
import { eq } from 'drizzle-orm';
import { fetchBlob, uploadOriginalImage, uploadSheetImage } from '@/lib/blob';
import { insertCardsWithinLimit } from '@/lib/boards/add-cards';
import { deleteCardAndRenumber } from '@/lib/boards/delete-card';
import { FREE_CARD_LIMIT, TOTAL_CARD_COUNT } from '@/lib/constants';
import {
  boxToRegion,
  computeSheetSlots,
  selectSheetCards,
  type SheetCard,
  type SheetExtraction,
} from '@/lib/sheet-split';

export type SplitResult =
  | {
      status: 'split';
      foundCount: number;
      createdCount: number;
      skippedCount: number;
      first: { originalImageUrl: string; titled: boolean };
      others: { cardId: string; originalImageUrl: string; titled: boolean }[];
    }
  | { status: 'all-duplicates'; foundCount: number; skippedCount: number }
  | { status: 'no-slots' };

type Crop = { card: SheetCard; buffer: Buffer };

export async function splitSheetCard(a: {
  cardId: string;
  boardId: string;
  userId: string;
  isAdmin: boolean;
  originalImageUrl: string;
  extraction: SheetExtraction;
}): Promise<SplitResult> {
  const { cardId, boardId, userId, isAdmin, extraction } = a;
  const foundCount = extraction.cards.length;

  const { buffer: sheetBuffer, contentType } = await fetchBlob(a.originalImageUrl);

  const board = await db.query.boards.findFirst({ where: eq(boards.id, boardId) });
  if (!board) return { status: 'no-slots' };
  const boardCards = await db.query.cards.findMany({ where: eq(cards.boardId, boardId) });
  const existingLabels = boardCards.filter((c) => c.id !== cardId).map((c) => c.label ?? '');

  const cardLimit = board.isUnlocked ? TOTAL_CARD_COUNT : FREE_CARD_LIMIT;
  const slotsFor = (currentCardCount: number) =>
    computeSheetSlots({
      cardLimit,
      currentCardCount,
      generationLimit: getGenerationLimit(board),
      imageGenerationsUsed: board.imageGenerationsUsed,
      isAdmin,
    });

  // Every titled card already on the board: the uploaded sheet is a duplicate.
  const all = selectSheetCards(extraction.cards, existingLabels, Infinity);
  if (all.selected.length === 0 && all.skippedCount > 0) {
    await deleteCardAndRenumber(boardId, cardId, userId);
    return { status: 'all-duplicates', foundCount, skippedCount: all.skippedCount };
  }
  const skippedCount = all.skippedCount;

  const slots = slotsFor(boardCards.length);
  if (slots < 1) return { status: 'no-slots' };
  const selected = all.selected.slice(0, slots);

  // Decode once (honoring EXIF orientation) and crop every selected card.
  const rotated = await sharp(sheetBuffer).rotate().toBuffer({ resolveWithObject: true });
  const { width, height } = rotated.info;
  const crops: Crop[] = [];
  for (const card of selected) {
    const region = boxToRegion(card.box, width, height);
    if (!region) {
      if (crops.length === 0) return { status: 'no-slots' };
      continue;
    }
    const buffer = await sharp(rotated.data).extract(region).png().toBuffer();
    crops.push({ card, buffer });
  }
  if (crops.length === 0) return { status: 'no-slots' };

  await uploadSheetImage(userId, boardId, cardId, sheetBuffer, contentType);

  const [firstCrop, ...otherCrops] = crops;
  const firstUrl = await uploadOriginalImage(
    userId,
    boardId,
    cardId,
    firstCrop.buffer,
    'image/png'
  );
  const firstTitle = firstCrop.card.title;
  await db
    .update(cards)
    .set({
      ...(firstTitle !== null ? { label: firstTitle } : {}),
      fromSheet: true,
      originalImageUrl: firstUrl,
      updatedAt: new Date(),
    })
    .where(eq(cards.id, cardId));

  const toRows = (list: Crop[]) =>
    list.map((c) => ({
      label: c.card.title ?? '',
      status: 'processing' as const,
      fromSheet: true,
    }));

  let toCreate = otherCrops;
  let inserted =
    toCreate.length > 0 ? await insertCardsWithinLimit(boardId, userId, toRows(toCreate)) : [];
  if (toCreate.length > 0 && inserted.length === 0) {
    // Another upload took a slot mid-split: recount and retry once, smaller.
    const recount = await db.query.cards.findMany({ where: eq(cards.boardId, boardId) });
    const room = Math.max(0, slotsFor(recount.length) - 1);
    toCreate = otherCrops.slice(0, room);
    inserted =
      toCreate.length > 0 ? await insertCardsWithinLimit(boardId, userId, toRows(toCreate)) : [];
    if (inserted.length === 0) toCreate = [];
  }

  const others: { cardId: string; originalImageUrl: string; titled: boolean }[] = [];
  for (let i = 0; i < inserted.length; i++) {
    const row = inserted[i];
    const crop = toCreate[i];
    const url = await uploadOriginalImage(userId, boardId, row.id, crop.buffer, 'image/png');
    await db.update(cards).set({ originalImageUrl: url }).where(eq(cards.id, row.id));
    others.push({ cardId: row.id, originalImageUrl: url, titled: crop.card.title !== null });
  }

  await db.update(boards).set({ sheetCardsFound: foundCount }).where(eq(boards.id, boardId));

  return {
    status: 'split',
    foundCount,
    createdCount: 1 + others.length,
    skippedCount,
    first: { originalImageUrl: firstUrl, titled: firstTitle !== null },
    others,
  };
}
