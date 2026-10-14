/** Small, comparable theme swatches made with the production board renderer. */
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { installCanvasRuntime } from './canvas-runtime';
import { renderBoardToCanvas } from '@/lib/generate-boards';
import { themePresets } from '@/lib/themes/presets';
import type { SampleManifest } from './render-samples';

async function main() {
  await installCanvasRuntime();
  const manifest: SampleManifest = JSON.parse(
    await readFile('scripts/themes/samples/birthday.json', 'utf8')
  );
  // Keep the same approved example cards in every swatch so the preset is the
  // only difference. These thumbnails never use a customer's photos.
  const cards = manifest.cards.slice(0, 16).map((card) => ({
    ...card,
    illustration: resolve(card.illustration),
  }));
  await mkdir('public/themes/picker', { recursive: true });
  for (const preset of themePresets) {
    const canvas = await renderBoardToCanvas(cards, { presetId: preset.id }, 'Lotería');
    const png = Buffer.from(canvas.toDataURL('image/png').split(',')[1], 'base64');
    await sharp(png)
      .resize(96)
      .webp({ quality: 85 })
      .toFile(`public/themes/picker/${preset.id}.webp`);
  }
  process.stdout.write(`Rendered ${themePresets.length} picker previews.\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
