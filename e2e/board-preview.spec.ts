import { test, expect, type Page } from '@playwright/test';
import samples from '../scripts/themes/samples/birthday.json';

// Exercise the real editor and renderer with browser-local fixtures. No API
// request in this suite can read or mutate a user's board.
async function openEditor(page: Page, { count = 24, locale = 'en' } = {}) {
  const boardId = 'preview-layout-fixture';
  let board = {
    id: boardId,
    name: 'Our Halloween',
    isUnlocked: true,
    photoMode: 'original',
    styleOptions: { presetId: 'halloween', showTitle: true },
  };
  let cards = Array.from({ length: count }, (_, index) => {
    const card = samples.cards[index % samples.cards.length];
    return {
      id: `card-${index}`,
      number: index + 1,
      label: `${card.label} ${index + 1}`,
      illustrationUrl: card.illustration.replace(/^public/, ''),
      originalImageUrl: null,
      status: 'completed',
      isDefault: true,
    };
  });
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([
      { name: 'better-auth.session_token', value: 'ui-fixture-only', url: 'http://localhost:3006' },
    ]);
  await page.addInitScript(() =>
    localStorage.setItem('loteria.onboarding.v1', '{"status":"skipped"}')
  );
  await page.route('**/ingest/**', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/boards/**', async (route) => {
    const url = new URL(route.request().url());
    const data = route.request().postDataJSON();
    if (url.pathname === `/api/boards/${boardId}`) {
      if (route.request().method() === 'PATCH') board = { ...board, ...data };
      return route.fulfill({ json: { board } });
    }
    if (url.pathname === `/api/boards/${boardId}/cards`) {
      if (route.request().method() === 'PATCH')
        cards = cards.map((card) =>
          card.id === data.cardId ? { ...card, label: data.label } : card
        );
      return route.fulfill({ json: { cards } });
    }
    return route.fulfill({ status: 404, json: { error: 'Unexpected fixture request' } });
  });
  await page.goto(`${locale === 'es' ? '/es' : ''}/boards/${boardId}`);
}

for (const width of [1024, 1440, 2560]) {
  test(`preview stays beside card editing while scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1024 ? 700 : 900 });
    await openEditor(page);
    const panel = page.getByRole('complementary', { name: 'Live preview' });
    const image = panel.getByRole('img');
    await expect(image).toBeVisible();
    await expect(panel.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByText('Export your sample', { exact: true })).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 1100));
    await expect.poll(async () => (await panel.boundingBox())!.y).toBeCloseTo(80, 0);
    const bounds = (await panel.boundingBox())!;
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    await expect(panel.getByRole('button', { name: 'Download set' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await page.screenshot({
      animations: 'disabled',
      path: `.scratch/theme-work/sidebar-scrolled-${width}.png`,
    });
    if (width === 1440) {
      const mountedPanel = await panel.elementHandle();
      const before = await image.getAttribute('src');
      await page.getByText('El Abuelo 1', { exact: true }).click();
      await page.getByRole('textbox', { name: 'Card label', exact: true }).fill('El Fantasma');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect.poll(() => image.getAttribute('src')).not.toBe(before);
      expect(await mountedPanel!.evaluate((element) => element.isConnected)).toBe(true);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        animations: 'disabled',
        path: '.scratch/theme-work/sidebar-desktop.png',
      });
    }
  });
}

test('mobile preview traps focus, returns to editing, and downloads the sample', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEditor(page, { count: 4 });
  const trigger = page.getByRole('button', { name: 'Preview & download', exact: true });
  await expect(trigger).toBeInViewport();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(trigger).toBeInViewport();
  await page.screenshot({
    animations: 'disabled',
    path: '.scratch/theme-work/sidebar-mobile-editor.png',
  });
  await trigger.click();
  const sheet = page.getByRole('dialog', { name: 'Live preview', exact: true });
  await expect(sheet.getByRole('img')).toBeVisible();
  await expect(sheet.locator('[aria-busy]')).toHaveAttribute('aria-busy', 'false');
  await expect(sheet.getByRole('button', { name: 'Download preview' })).toBeInViewport();
  await page.keyboard.press('Shift+Tab');
  expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.screenshot({
    animations: 'disabled',
    path: '.scratch/theme-work/sidebar-mobile-preview.png',
  });
  const downloaded = page.waitForEvent('download');
  await sheet.getByRole('button', { name: 'Download preview' }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe('our-halloween-sample.pdf');
  await file.saveAs('.scratch/theme-work/sidebar-sample.pdf');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(trigger).toBeFocused();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add photos', exact: true }).click();
  expect((await chooser).isMultiple()).toBe(true);
});

test('Spanish small-screen empty state and sheet close are accessible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await openEditor(page, { count: 0, locale: 'es' });
  const trigger = page.getByRole('button', { name: 'Ver y descargar', exact: true });
  await trigger.click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('img')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Descargar muestra' })).toBeDisabled();
  await expect(sheet.getByRole('button', { name: 'Descargar muestra' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    animations: 'disabled',
    path: '.scratch/theme-work/sidebar-mobile-es.png',
  });
  await sheet.getByRole('button', { name: 'Cerrar vista previa' }).click();
  await expect(trigger).toBeFocused();
});

test('board count survives the mobile sheet and a switch back to desktop', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await openEditor(page, { count: 16 });
  const trigger = page.getByRole('button', { name: 'Preview & download', exact: true });
  await trigger.click();
  await page.getByRole('dialog').getByRole('spinbutton').fill('2');
  await page.keyboard.press('Escape');
  await trigger.click();
  await expect(page.getByRole('dialog').getByRole('spinbutton')).toHaveValue('2');
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const panel = page.getByRole('complementary', { name: 'Live preview' });
  await expect(panel.getByRole('spinbutton')).toHaveValue('2');
  const downloaded = page.waitForEvent('download');
  await panel.getByRole('button', { name: 'Download set' }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe('our-halloween-loteria-set.pdf');
  await file.saveAs('.scratch/theme-work/sidebar-full-set.pdf');
});
