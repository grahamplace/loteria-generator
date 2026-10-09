import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createCanvas, Image } from '@napi-rs/canvas';
import sharp from 'sharp';
import { installCanvasRuntime } from './canvas-runtime';
import { renderBoardToCanvas, drawCard } from '@/lib/generate-boards';
import { resolveBoardStyle, loadPrintFonts } from '@/lib/themes/render-style';
import type { BoardStyleOptions } from '@/lib/themes/presets';

export interface SampleManifest {
  title: string;
  styles: BoardStyleOptions;
  cards: { id: string; number: number; label: string; illustration: string }[];
}
export async function renderSamples(manifest: SampleManifest, output: string) {
  await installCanvasRuntime();
  await mkdir(output, { recursive: true });
  if (
    manifest.cards.length < 16 ||
    new Set(manifest.cards.map((card) => card.id)).size !== manifest.cards.length
  )
    throw new Error('Marketing samples need at least 16 distinct cards');
  const cards = manifest.cards.map((card) => ({
    ...card,
    illustration: resolve(card.illustration),
  }));
  for (const [i, order] of [
    cards.slice(0, 16),
    [...cards.slice(8, 16), ...cards.slice(0, 8)],
  ].entries()) {
    const board = await renderBoardToCanvas(order, manifest.styles, manifest.title);
    const data = Buffer.from(board.toDataURL('image/png').split(',')[1], 'base64');
    await writeFile(join(output, `sample-board-${i + 1}.png`), data);
    await sharp(data)
      .resize(1000)
      .webp({ quality: 85 })
      .toFile(join(output, `board-${i + 1}.webp`));
  }
  await loadPrintFonts();
  const style = resolveBoardStyle(manifest.styles);
  for (const card of cards) {
    const canvas = createCanvas(604, 904);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = style.backgroundColor;
    ctx.fillRect(0, 0, 604, 904);
    const image = new Image();
    image.src = await readFile(card.illustration);
    await image.decode();
    drawCard(
      ctx as unknown as CanvasRenderingContext2D,
      card,
      image as unknown as HTMLImageElement,
      2,
      2,
      600,
      900,
      style,
      false,
      88
    );
    await writeFile(join(output, `${card.id}-card.png`), canvas.toBuffer('image/png'));
  }
}
if (process.argv[1]?.endsWith('/scripts/themes/render-samples.ts')) {
  const [manifestPath, output] = process.argv.slice(2);
  if (!manifestPath || !output) throw new Error('Pass manifest.json and output directory');
  readFile(manifestPath, 'utf8')
    .then((data) => renderSamples(JSON.parse(data), output))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
