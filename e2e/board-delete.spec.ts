import { test, expect } from '@playwright/test';
import { eq } from 'drizzle-orm';
import { boards } from '@/db/schema';
import { db } from './helpers/db';
import { deleteBoardsForUser } from './helpers/cleanup';
import { getUserIdByEmail } from './helpers/get-user-id';
import { seedBoard } from './helpers/seed-board';

const SEEDED_EMAIL = 'e2etest@example.com';

test.describe('board delete', () => {
  let userId: string;

  test.beforeEach(async () => {
    userId = await getUserIdByEmail(SEEDED_EMAIL);
    await deleteBoardsForUser(userId);
    await seedBoard({ userId, name: 'Keep Me', isUnlocked: false });
    await seedBoard({ userId, name: 'Delete Me', isUnlocked: false });
  });

  test.afterEach(async () => {
    await deleteBoardsForUser(userId);
  });

  test('user can delete a board from the dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    // Both boards visible.
    await expect(page.getByText('Keep Me')).toBeVisible();
    await expect(page.getByText('Delete Me')).toBeVisible();

    // Open the actions menu for "Delete Me" via the aria-label added in Task 4.
    await page.getByRole('button', { name: /more actions for board Delete Me/i }).click();
    await page.getByRole('menuitem', { name: /delete/i }).click();

    // AlertDialog confirm.
    await page
      .getByRole('button', { name: /^(yes,?\s*)?delete/i })
      .last()
      .click();

    // "Delete Me" gone; "Keep Me" remains.
    await expect(page.getByText('Delete Me')).toHaveCount(0, { timeout: 5_000 });
    await expect(page.getByText('Keep Me')).toBeVisible();

    const rows = await db
      .select({ name: boards.name })
      .from(boards)
      .where(eq(boards.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Keep Me');
  });
});
