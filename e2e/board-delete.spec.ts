import { test, expect, type Page } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { boards } from '@/db/schema';
import { db } from './helpers/db';
import { deleteBoardsForUser } from './helpers/cleanup';
import { getUserIdByEmail } from './helpers/get-user-id';
import { seedBoard } from './helpers/seed-board';

const SEEDED_EMAIL = 'e2etest@example.com';

test.describe('board delete', () => {
  let userId: string;

  // Each test seeds its own board count — the two cases below exercise
  // different post-delete destinations, so the starting state can't be shared.
  test.beforeEach(async () => {
    userId = await getUserIdByEmail(SEEDED_EMAIL);
    await deleteBoardsForUser(userId);
  });

  test.afterEach(async () => {
    await deleteBoardsForUser(userId);
  });

  async function confirmDelete(page: Page, boardName: string) {
    // Open the actions menu via the aria-label added in Task 4.
    await page
      .getByRole('button', { name: new RegExp(`more actions for board ${boardName}`, 'i') })
      .click();
    await page.getByRole('menuitem', { name: /delete/i }).click();

    // AlertDialog confirm.
    await page
      .getByRole('button', { name: /^(yes,?\s*)?delete/i })
      .last()
      .click();
  }

  test('user can delete a board from the dashboard', async ({ page }) => {
    await seedBoard({ userId, name: 'Keep Me', isUnlocked: false });
    await seedBoard({ userId, name: 'Delete Me', isUnlocked: false });

    await page.goto('/dashboard');

    // Both boards visible.
    await expect(page.getByText('Keep Me')).toBeVisible();
    await expect(page.getByText('Delete Me')).toBeVisible();

    await confirmDelete(page, 'Delete Me');

    // "Delete Me" gone; "Keep Me" remains — and we stay on the dashboard,
    // because the user still has a board.
    await expect(page.getByText('Delete Me')).toHaveCount(0, { timeout: 5_000 });
    await expect(page.getByText('Keep Me')).toBeVisible();
    await expect(page).toHaveURL(/\/(en\/)?dashboard/);

    const rows = await db
      .select({ name: boards.name })
      .from(boards)
      .where(eq(boards.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Keep Me');
  });

  test('deleting your only board lands you in a fresh board, not the empty state', async ({
    page,
  }) => {
    const only = await seedBoard({ userId, name: 'Last One', isUnlocked: false });

    await page.goto('/dashboard');
    await expect(page.getByText('Last One')).toBeVisible();

    await confirmDelete(page, 'Last One');

    // The dashboard pushes '/start' when the deleted board was the last one;
    // '/start' creates a replacement and drops the user into it. Nobody should
    // ever be parked on the empty dashboard.
    await expect(page).toHaveURL(/\/(en\/)?boards\/[0-9a-f-]+/, { timeout: 15_000 });

    // …and it is genuinely a NEW board, not the one just deleted.
    const url = new URL(page.url());
    const newBoardId = url.pathname.split('/').pop();
    expect(newBoardId).toBeTruthy();
    expect(newBoardId).not.toBe(only.id);

    const rows = await db.select({ id: boards.id }).from(boards).where(eq(boards.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(newBoardId);
  });
});
