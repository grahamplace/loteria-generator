import { test, expect } from '@playwright/test';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { cards } from '@/db/schema';
import { db } from './helpers/db';
import { deleteBoardsForUser } from './helpers/cleanup';
import { getUserIdByEmail } from './helpers/get-user-id';
import { seedBoard } from './helpers/seed-board';

const SEEDED_EMAIL = 'e2etest@example.com';
const TEST_IMAGE = path.resolve(__dirname, 'fixtures/test-card.png');

test.describe('card upload', () => {
  let userId: string;
  let boardId: string;

  test.beforeEach(async () => {
    userId = await getUserIdByEmail(SEEDED_EMAIL);
    await deleteBoardsForUser(userId);
    const board = await seedBoard({ userId, name: 'Upload Test', isUnlocked: true });
    boardId = board.id;
  });

  test.afterEach(async () => {
    await deleteBoardsForUser(userId);
  });

  test('uploading a photo creates a completed card (skip-AI mode)', async ({ page }) => {
    await page.goto(`/boards/${boardId}`);

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(TEST_IMAGE);

    // Wait for the card count to update from 0 to 1.
    await expect(page.getByText('1/54').first()).toBeVisible({ timeout: 15_000 });

    // DB assertion: card exists and is completed (skip-AI marks it completed synchronously).
    // Poll until the card reaches 'completed' — the blob upload inside the same
    // request handler takes a moment, so we wait rather than reading once.
    await expect
      .poll(
        async () => {
          const rows = await db
            .select({ status: cards.status })
            .from(cards)
            .where(eq(cards.boardId, boardId));
          return rows[0]?.status ?? null;
        },
        { timeout: 20_000, intervals: [500, 1_000, 2_000] }
      )
      .toBe('completed');

    const rows = await db
      .select({
        status: cards.status,
        originalImageUrl: cards.originalImageUrl,
        illustrationUrl: cards.illustrationUrl,
      })
      .from(cards)
      .where(eq(cards.boardId, boardId));
    expect(rows[0].status).toBe('completed');
    expect(rows[0].originalImageUrl).toBeTruthy();
    expect(rows[0].illustrationUrl).toBe(rows[0].originalImageUrl);
  });
});
