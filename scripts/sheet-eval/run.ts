/**
 * Sheet split eval: runs detectSheet + extractSheet on local images and writes
 * a box overlay plus the raw extraction for each.
 *
 * Usage:
 *   pnpm exec tsx --env-file=.env.local scripts/sheet-eval/run.ts <image...>
 *
 * Outputs (gitignored): scripts/sheet-eval/runs/<UTC timestamp>/
 *   <name>-overlay.jpg  blue box = complete card, red = incomplete
 *   <name>.json         { file, isSheet, ms, extraction }
 * Prints one JSON line per image: { file, isSheet, ms, count, titles }.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { detectSheet, extractSheet, toSheetDataUrl } from '../../lib/sheet-split-ai';

const __dirname = dirname(fileURLToPath(import.meta.url));
const meta = { userId: 'eval', boardId: 'eval', cardId: 'eval' };

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Usage: tsx --env-file=.env.local scripts/sheet-eval/run.ts <image...>');
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set (run `pnpm secrets:pull`).');
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = join(__dirname, 'runs', stamp);
  await mkdir(outDir, { recursive: true });

  for (const file of files) {
    const name = basename(file, extname(file));
    const t = Date.now();
    const buffer = await readFile(file);
    const dataUrl = await toSheetDataUrl(buffer);
    const isSheet = await detectSheet(dataUrl, meta);
    const extraction = isSheet ? await extractSheet(dataUrl, meta) : null;
    const ms = Date.now() - t;

    if (extraction) {
      const img = sharp(buffer).rotate();
      const { width: W, height: H } = await img.metadata();
      const rects = extraction.cards
        .map((c) => {
          const { x0, y0, x1, y1 } = c.box;
          const color = c.complete ? '#0000ee' : '#ee0000';
          return `<rect x="${x0 * W!}" y="${y0 * H!}" width="${(x1 - x0) * W!}" height="${(y1 - y0) * H!}" fill="none" stroke="${color}" stroke-width="4"/>`;
        })
        .join('');
      await img
        .composite([{ input: Buffer.from(`<svg width="${W}" height="${H}">${rects}</svg>`) }])
        .jpeg()
        .toFile(join(outDir, `${name}-overlay.jpg`));
    }
    await writeFile(
      join(outDir, `${name}.json`),
      JSON.stringify({ file: basename(file), isSheet, ms, extraction }, null, 2)
    );
    console.log(
      JSON.stringify({
        file: basename(file),
        isSheet,
        ms,
        count: extraction?.cards.length ?? 0,
        titles: extraction?.cards.map((c) => c.title) ?? [],
      })
    );
  }
  console.error(`Wrote ${outDir}`);
}

main();
