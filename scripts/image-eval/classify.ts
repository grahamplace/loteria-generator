/**
 * Image category eval: runs classifyImage on every labeled eval photo and
 * reports accuracy against the `category` in each set's cases.json. No image
 * generation calls, so it is fast and cheap.
 *
 * Usage:
 *   pnpm eval:classify                     # every set that exists locally
 *   pnpm eval:classify --set tricky,scenes
 */

import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { classifyImage } from '../../lib/image-category-ai';
import { isImageCategory, type ImageCategory } from '../../lib/image-category';
import { toSheetDataUrl } from '../../lib/sheet-split-ai';

const __dirname = dirname(fileURLToPath(import.meta.url));
const meta = { userId: 'eval', boardId: 'eval', cardId: 'eval' };
const SETS: Record<string, string> = {
  default: 'photos',
  tricky: 'photos-tricky',
  objects: 'photos-objects',
  scenes: 'photos-scenes',
};
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const CONCURRENCY = 6;

type Case = { set: string; stem: string; file: string; expected: ImageCategory };

async function loadCases(set: string): Promise<Case[]> {
  const dir = join(__dirname, SETS[set]);
  const files = await readdir(dir).catch(() => null);
  if (!files) return [];
  const notes = JSON.parse(await readFile(join(dir, 'cases.json'), 'utf8')) as Record<
    string,
    { category?: unknown }
  >;
  return files
    .filter((f) => IMAGE_EXTS.has(extname(f).toLowerCase()) && !f.includes('.reference.'))
    .flatMap((f) => {
      const stem = f.slice(0, -extname(f).length);
      const expected = notes[stem]?.category;
      return isImageCategory(expected) ? [{ set, stem, file: join(dir, f), expected }] : [];
    });
}

async function main() {
  const { values } = parseArgs({ options: { set: { type: 'string' } } });
  const sets = values.set ? values.set.split(',') : Object.keys(SETS);
  const unknown = sets.filter((s) => !(s in SETS));
  if (unknown.length) {
    console.error(`Unknown --set ${unknown.join(', ')}. Options: ${Object.keys(SETS).join(', ')}`);
    process.exit(1);
  }

  const cases = (await Promise.all(sets.map(loadCases))).flat();
  const results: (Case & { actual: ImageCategory | null; ms: number })[] = [];
  for (let i = 0; i < cases.length; i += CONCURRENCY) {
    results.push(
      ...(await Promise.all(
        cases.slice(i, i + CONCURRENCY).map(async (c) => {
          const t = Date.now();
          const actual = await classifyImage(await toSheetDataUrl(await readFile(c.file)), meta);
          return { ...c, actual, ms: Date.now() - t };
        })
      ))
    );
  }

  for (const r of results) {
    const mark = r.actual === r.expected ? 'ok  ' : 'MISS';
    console.log(`${mark} ${r.set}/${r.stem}: expected ${r.expected}, got ${r.actual} (${r.ms}ms)`);
  }
  const correct = results.filter((r) => r.actual === r.expected).length;
  const avgMs = Math.round(results.reduce((sum, r) => sum + r.ms, 0) / results.length);
  console.log(`\nAccuracy: ${correct}/${results.length} · avg ${avgMs}ms`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
