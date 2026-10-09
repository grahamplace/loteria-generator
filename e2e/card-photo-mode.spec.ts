import { test, expect, type Page, type Route } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// The editor/renderer are real; all card data and processing results stay in
// browser-local fixtures. No customer data, database writes, or image API calls.
async function editor(page: Page, locale = 'en', hasIllustration = false) {
  const boardId = 'photo-mode-fixture';
  const cardId = '00000000-0000-0000-0000-000000000001';
  const photo = '/themes/birthday/photo.webp';
  const drawing = '/themes/birthday/card.webp';
  let version = Date.now();
  let generated = hasIllustration;
  let failNext = false;
  let failGeneration = false;
  let generations = 0;
  let card = {
    id: cardId,
    boardId,
    number: 1,
    label: 'El Cumpleaños',
    riddle: 'Un recuerdo',
    originalImageUrl: photo,
    illustrationUrl: photo,
    savedIllustrationUrl: hasIllustration ? drawing : (null as string | null),
    preserveOriginal: true,
    isDefault: false,
    cropData: null,
    status: 'completed',
    errorMessage: null as string | null,
    updatedAt: new Date(version).toISOString(),
  };
  const stamp = () => {
    card.updatedAt = new Date(++version).toISOString();
  };
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
  await page.route(`**/api/images/${boardId}/**`, async (route) => {
    const original = new URL(route.request().url()).pathname.endsWith('/original');
    const file = original ? photo : card.illustrationUrl || photo;
    await route.fulfill({
      contentType: 'image/webp',
      body: await readFile(resolve('public' + file)),
    });
  });
  await page.route('**/api/boards/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === `/api/boards/${boardId}`)
      return route.fulfill({
        json: {
          board: {
            id: boardId,
            name: 'Photo mode test',
            isUnlocked: false,
            photoMode: 'original',
            styleOptions: { presetId: 'birthday' },
          },
        },
      });
    if (url.pathname === `/api/boards/${boardId}/cards/${cardId}/photo-mode`) {
      if (failNext) {
        failNext = false;
        return route.fulfill({ status: 503, json: { error: 'Queue unavailable' } });
      }
      const { photoMode } = route.request().postDataJSON();
      card.preserveOriginal = photoMode === 'original';
      card.errorMessage = null;
      if (photoMode === 'original') {
        card.illustrationUrl = photo;
        card.status = 'completed';
      } else if (generated) {
        card.illustrationUrl = drawing;
        card.status = 'completed';
      } else {
        card.illustrationUrl = '';
        card.status = 'processing';
        generations++;
      }
      stamp();
      return route.fulfill({ json: { card } });
    }
    if (url.pathname === `/api/boards/${boardId}/cards`) {
      if (route.request().method() === 'PATCH') {
        card = { ...card, ...route.request().postDataJSON() };
        stamp();
      } else if (card.status === 'processing') {
        if (failGeneration) {
          card.status = 'error';
          card.errorMessage = 'Image unavailable';
        } else {
          generated = true;
          card.illustrationUrl = drawing;
          card.savedIllustrationUrl = drawing;
          card.status = 'completed';
        }
        stamp();
      }
      return route.fulfill({ json: { cards: [card] } });
    }
    return route.fulfill({ status: 404, json: { error: 'Unexpected fixture request' } });
  });
  await page.goto(`${locale === 'es' ? '/es' : ''}/boards/${boardId}`);
  await page.getByText('El Cumpleaños', { exact: true }).click();
  return {
    getCard: () => card,
    generations: () => generations,
    failRequest: () => {
      failNext = true;
    },
    failProcessing: () => {
      failGeneration = true;
    },
  };
}

for (const [locale, width] of [
  ['en', 1440],
  ['es', 390],
] as const) {
  test(`keeps the preview covered until the selected image loads (${locale})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await editor(page, locale, true);
    const dialog = page.getByRole('dialog');
    const preview = dialog.locator('img').last();
    await expect
      .poll(() => preview.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
      .toBe(true);
    for (const choice of locale === 'en'
      ? ['Use illustration', 'Use original photo']
      : ['Usar ilustración', 'Usar foto original']) {
      const previousSource = await preview.getAttribute('src');
      const previousVersion = new URL(previousSource!, 'http://localhost:3006').searchParams.get(
        'v'
      );
      let releaseImage!: () => void;
      const imageGate = new Promise<void>((resolve) => {
        releaseImage = resolve;
      });
      let requested = false;
      const delayImage = async (route: Route) => {
        const url = new URL(route.request().url());
        if (
          url.pathname.endsWith('/illustration') &&
          url.searchParams.get('v') !== previousVersion
        ) {
          requested = true;
          await imageGate;
        }
        await route.fallback();
      };
      await page.route('**/api/images/photo-mode-fixture/**', delayImage);
      try {
        await dialog
          .getByRole('radio', {
            name: choice,
            exact: true,
          })
          .click();
        await expect.poll(() => requested).toBe(true);
        await expect(preview).not.toHaveAttribute('src', previousSource!);
        await expect(dialog.getByRole('status')).toBeVisible();
        // The request has finished; the selected image is still unavailable.
        await expect(
          dialog.getByRole('radio', {
            name: choice,
            exact: true,
          })
        ).toBeEnabled();
        await expect(dialog.getByRole('status')).toBeVisible();
        const frame = await preview.boundingBox();
        const overlay = await dialog.getByRole('status').boundingBox();
        expect(overlay).toEqual(frame);
      } finally {
        releaseImage();
      }
      await expect
        .poll(() =>
          preview.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
        )
        .toBe(true);
      await expect(dialog.getByRole('status')).toHaveCount(0);
      await page.unroute('**/api/images/photo-mode-fixture/**', delayImage);
    }
  });

  test(`switch photo and illustration, reuse the drawing, and preserve edits (${locale})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const fixture = await editor(page, locale);
    const dialog = page.getByRole('dialog');
    const usePhoto = dialog.getByRole('radio', {
      name: locale === 'en' ? 'Use original photo' : 'Usar foto original',
      exact: true,
    });
    const useDrawing = dialog.getByRole('radio', {
      name: locale === 'en' ? 'Use illustration' : 'Usar ilustración',
      exact: true,
    });
    await expect(usePhoto).toBeChecked();
    const label = dialog.getByRole('textbox', {
      name: locale === 'en' ? 'Card label' : 'Etiqueta de la carta',
      exact: true,
    });
    await label.fill('La Fiesta');
    fixture.failRequest();
    await useDrawing.click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(usePhoto).toBeChecked();
    await useDrawing.click();
    await expect(dialog.getByRole('status')).toHaveText(
      locale === 'en' ? 'Creating your illustration…' : 'Creando tu ilustración…'
    );
    await expect(useDrawing).toBeDisabled();
    await expect(useDrawing).toBeEnabled({ timeout: 20_000 });
    await expect(useDrawing).toBeChecked();
    await expect(label).toHaveValue('La Fiesta');
    expect(fixture.generations()).toBe(1);
    const firstImage = await dialog.locator('img').last().getAttribute('src');
    await usePhoto.click();
    await expect(usePhoto).toBeChecked();
    await expect(
      dialog.getByRole('button', {
        name: locale === 'en' ? 'Crop photo' : 'Recortar foto',
        exact: true,
      })
    ).toBeVisible();
    await expect.poll(() => dialog.locator('img').last().getAttribute('src')).not.toBe(firstImage);
    await useDrawing.click();
    await expect(useDrawing).toBeChecked();
    expect(fixture.generations()).toBe(1);
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({
      path: `.scratch/theme-work/card-photo-mode-${locale}.png`,
      animations: 'disabled',
    });
    await dialog
      .getByRole('button', { name: locale === 'en' ? 'Save' : 'Guardar', exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await page.reload();
    await page.getByText('La Fiesta', { exact: true }).click();
    await expect(useDrawing).toBeChecked();
    expect(fixture.getCard().preserveOriginal).toBe(false);
  });
}

test('failed illustration can retry or return to the photo without losing the card', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await editor(page);
  fixture.failProcessing();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Use illustration', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Try illustration again' })).toBeVisible({
    timeout: 20_000,
  });
  await dialog.getByRole('radio', { name: 'Use original photo', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  expect(fixture.getCard().status).toBe('completed');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('El Cumpleaños', { exact: true })).toBeVisible();
});

test('a failed preview image can reload without generating another illustration', async ({
  page,
}) => {
  const fixture = await editor(page, 'en', true);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('status')).toHaveCount(0);
  let failImage = true;
  await page.route('**/api/images/photo-mode-fixture/**', async (route) => {
    if (failImage && new URL(route.request().url()).pathname.endsWith('/illustration')) {
      return route.fulfill({ status: 503, body: 'Unavailable' });
    }
    await route.fallback();
  });
  await dialog.getByRole('radio', { name: 'Use illustration', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Couldn’t load image.');
  await expect(dialog.getByRole('status')).toHaveCount(0);
  failImage = false;
  await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await expect(dialog.getByRole('status')).toHaveCount(0);
  await expect
    .poll(() =>
      dialog
        .locator('img')
        .last()
        .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
    )
    .toBe(true);
  expect(fixture.generations()).toBe(0);
});
