import { test, expect } from '@playwright/test';
import { themePages, themePath } from '@/lib/themes/catalog';
import { deleteBoardsForUser } from './helpers/cleanup';
import { getUserIdByEmail } from './helpers/get-user-id';
import { seedBoard } from './helpers/seed-board';
import { seedCards } from './helpers/seed-cards';
import { DEFAULT_CARDS } from '@/lib/default-cards';
import { readFile } from 'node:fs/promises';
import { DEFAULT_BOARD_NAME } from '@/lib/constants';

test.describe('themed Lotería', () => {
  let userId: string;
  test.beforeEach(async () => {
    userId = await getUserIdByEmail('e2etest@example.com');
    await deleteBoardsForUser(userId);
  });
  test.afterEach(async () => {
    await deleteBoardsForUser(userId);
  });

  test('mixed concurrent classic and photo uploads obey one shared free limit', async ({
    page,
  }) => {
    const board = await seedBoard({ userId });
    const originalImageBase64 =
      'data:image/png;base64,' + (await readFile('e2e/fixtures/test-card.png')).toString('base64');
    const attempts = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        i % 2
          ? page.request.post(`/api/boards/${board.id}/cards`, { data: { originalImageBase64 } })
          : page.request.post(`/api/boards/${board.id}/cards/defaults`, {
              data: { defaultCardIds: [DEFAULT_CARDS[i].id] },
            })
      )
    );
    expect(attempts.filter((response) => response.ok())).toHaveLength(4);
    expect(attempts.filter((response) => response.status() === 403)).toHaveLength(4);
    const data = await (await page.request.get(`/api/boards/${board.id}/cards`)).json();
    expect(data.cards).toHaveLength(4);
    expect(new Set(data.cards.map((card: { number: number }) => card.number)).size).toBe(4);
  });

  test('all localized pages and hubs serve content and SEO to signed-in visitors', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    for (const locale of ['en', 'es-MX']) {
      for (const theme of themePages) {
        const response = await page.request.get(themePath(theme.id, locale));
        expect(response.status(), theme.id).toBe(200);
        const html = await response.text();
        expect(html).toContain(theme[locale === 'en' ? 'en' : 'es-MX'].ideas[0]);
        expect(html).toContain('rel="canonical"');
        expect(html).toContain('hrefLang="es-MX"');
        expect(html).toContain('BreadcrumbList');
        expect(html).toContain(`/themes/${theme.id}/og-${locale === 'en' ? 'en' : 'es'}.jpg`);
      }
      expect((await page.request.get(locale === 'en' ? '/loteria' : '/es/loteria')).status()).toBe(
        200
      );
    }
    expect((await page.request.get('/loteria/unknown-theme')).status()).toBe(404);
    const sitemap = await (await page.request.get('/sitemap.xml')).text();
    for (const theme of themePages) expect(sitemap).toContain(`/es/loteria/${theme.id}`);
  });

  test('reuses untouched starter and preserves theme and locale through refresh', async ({
    page,
  }) => {
    const starter = await seedBoard({ userId, name: DEFAULT_BOARD_NAME });
    await page.goto('/es/start?theme=halloween&mode=original');
    await expect(page).toHaveURL(new RegExp(`/es/boards/${starter.id}$`));
    await page.reload();
    const data = await (await page.request.get(`/api/boards/${starter.id}`)).json();
    expect(data.board.photoMode).toBe('original');
    expect(data.board.styleOptions).toMatchObject({ presetId: 'halloween', showTitle: true });
    await expect(
      page.getByRole('checkbox', { name: 'Mostrar título en las tablas' })
    ).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: 'Mostrar título en las tablas' })
    ).toBeChecked();
    await expect(
      page
        .getByRole('region', { name: 'Diseña tu juego' })
        .getByRole('switch', { name: 'Ilustrar mis fotos' })
    ).not.toBeChecked();
  });

  test('existing work needs an explicit choice; new sets are free', async ({ page }) => {
    const existing = await seedBoard({ userId, name: 'Our family' });
    await seedCards({ userId, boardId: existing.id, count: 1 });
    await page.goto('/start?theme=halloween&mode=illustrated');
    await expect(page.getByRole('button', { name: /create a new/i })).toBeVisible();
    const before = await (await page.request.get(`/api/boards/${existing.id}`)).json();
    expect(before.board.styleOptions).toBeNull();
    await page.getByRole('button', { name: /create a new/i }).click();
    await expect(page).toHaveURL(/\/boards\/[^/]+$/);
    expect(page.url()).not.toContain(existing.id);
    const after = await (await page.request.get(`/api/boards/${existing.id}`)).json();
    expect(after.board.name).toBe('Our family');
    expect(after.board.styleOptions).toBeNull();
  });

  test('free sample exports twice and theme changes keep original cards', async ({ page }) => {
    test.setTimeout(90_000);
    const board = await seedBoard({ userId, name: 'Spooky José' });
    await page.request.patch(`/api/boards/${board.id}`, {
      data: { photoMode: 'original', styleOptions: { presetId: 'halloween', showTitle: true } },
    });
    await page.goto(`/boards/${board.id}`);
    const uploadDone = page.waitForResponse(
      (response) => response.url().endsWith('/cards') && response.request().method() === 'POST'
    );
    await page.locator('input[type=file]').first().setInputFiles('e2e/fixtures/test-card.png');
    expect((await uploadDone).status()).toBe(201);
    await expect(page.getByText('1/4').first()).toBeVisible({ timeout: 15000 });
    const uploaded = await (await page.request.get(`/api/boards/${board.id}/cards`)).json();
    expect(uploaded.cards[0]).toMatchObject({
      preserveOriginal: true,
      status: 'completed',
      label: 'test-card',
    });
    const cardId = uploaded.cards[0].id;
    await page.getByText('test-card', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Crop photo', exact: true }).click();
    const cropSaved = page.waitForResponse(
      (response) => response.url().endsWith('/cards') && response.request().method() === 'PATCH'
    );
    await page.getByRole('button', { name: 'Save crop', exact: true }).click();
    expect((await cropSaved).ok()).toBe(true);
    await page.getByRole('radio', { name: 'Christmas', exact: true }).focus();
    await page.getByRole('radio', { name: 'Christmas', exact: true }).press('Space');
    await expect(page.getByRole('radio', { name: 'Christmas', exact: true })).toBeEnabled();
    await expect(
      page.getByRole('img', { name: 'Your board rendered with the selected theme', exact: true })
    ).toBeVisible();
    await page.screenshot({ path: '.scratch/theme-work/builder-desktop.png', fullPage: true });

    expect(
      (
        await page.request.patch(`/api/boards/${board.id}/cards`, {
          data: { cardId, label: 'Mi foto', cropData: { x: 0, y: 0, width: 2, height: 3 } },
        })
      ).ok()
    ).toBe(true);
    await page.request.patch(`/api/boards/${board.id}`, {
      data: { photoMode: 'illustrated', styleOptions: { presetId: 'christmas' } },
    });
    const unchanged = await (await page.request.get(`/api/boards/${board.id}/cards`)).json();
    expect(unchanged.cards[0]).toMatchObject({
      id: cardId,
      preserveOriginal: true,
      label: 'Mi foto',
    });
    await page.reload();
    const titleToggle = page.getByRole('checkbox', { name: 'Show title on boards', exact: true });
    await expect(titleToggle).toBeVisible();
    await expect(titleToggle).toHaveAccessibleDescription(
      'Print “Spooky José” at the top of each board.'
    );
    for (const showTitle of [false, true]) {
      const saved = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/boards/${board.id}`) &&
          response.request().method() === 'PATCH'
      );
      await expect(titleToggle).toBeChecked({ checked: !showTitle });
      await titleToggle.click();
      expect((await saved).ok()).toBe(true);
      await expect(titleToggle).toBeChecked({ checked: showTitle });
      await page.reload();
      await expect(titleToggle).toBeChecked({ checked: showTitle });
      const preview = page.getByRole('img', {
        name: 'Your board rendered with the selected theme',
        exact: true,
      });
      await expect(preview).toBeVisible();
      await preview.screenshot({
        path: `.scratch/theme-work/consumer-title-${showTitle ? 'on' : 'off'}-preview.png`,
      });
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: /download preview/i }).click();
      const pdf = await download;
      expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
      await pdf.saveAs(`.scratch/theme-work/consumer-title-${showTitle ? 'on' : 'off'}.pdf`);
    }
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('themed email signup', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test('keeps Spanish theme selection through signup and creates a configured starter', async ({
    page,
  }) => {
    const email = `theme-signup-${Date.now()}@example.com`;
    try {
      await page.goto('/es/loteria/halloween');
      await page
        .getByRole('link', { name: /Crear mi lotería.*Halloween/i })
        .first()
        .click();
      await expect(page).toHaveURL(/\/es\/sign-up\?callbackUrl=/);
      await page.locator('#name').fill('María');
      await page.locator('#email').fill(email);
      await page.locator('#password').fill('TestPassword123!');
      await page.locator('button[type=submit]').click();
      await expect(page).toHaveURL(/\/es\/boards\/[^/]+$/, { timeout: 15000 });
      const id = page.url().split('/').pop();
      const data = await (await page.request.get(`/api/boards/${id}`)).json();
      expect(data.board.styleOptions).toMatchObject({ presetId: 'halloween', showTitle: true });
      expect(data.board.photoMode).toBe('illustrated');
    } finally {
      const { deleteUser } = await import('./helpers/cleanup');
      try {
        await deleteUser(await getUserIdByEmail(email));
      } catch {
        /* signup may not finish */
      }
    }
  });
});
