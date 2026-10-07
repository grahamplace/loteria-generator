/**
 * Image model eval: runs the real test photos in scripts/image-eval/photos/
 * through the production illustration pipeline on several image models, times
 * every call, and builds a side-by-side comparison sheet (JPG + PDF).
 *
 * Usage:
 *   pnpm eval:images
 *   pnpm eval:images --models gpt-image-2,gpt-image-2.5-flare
 *   pnpm eval:images --photos dog,hockey
 *   pnpm eval:images --set tricky --models gpt-image-2 \
 *     --prompt-refs old=main,new=my-prompt-branch --concurrency 3
 *   pnpm eval:images --compose scripts/image-eval/runs/<run>   (rebuild sheet, no API calls)
 *
 * Options:
 *   --set tricky        use photos-tricky/ (prod cards that needed admin prompt
 *                       overrides; build it with `pnpm eval:pull-tricky`). The
 *                       sheet adds the corrected prod card and the override text.
 *   --prompt-refs a,b   compare lib/illustration-prompt.ts as of each git ref
 *                       (`label=ref` or just `ref`); one column per model × ref.
 *                       Default: the working tree's prompt.
 *   --set objects       use photos-objects/ (local only): objects vs scenes, for
 *                       the solid-color vs sky background choice.
 *   --concurrency n     photos in flight at once (default 1). Above 1, timings
 *                       share the network with other photos' calls.
 *
 * Environment:
 *   OPENAI_API_KEY  required (loaded from .env.local by the pnpm script)
 *
 * Outputs (gitignored): scripts/image-eval/runs/<timestamp>/
 *   results.json      every call: model, photo, seconds, output file or error
 *   <photo>__<model>.png
 *   comparison.jpg    one tall image: speed summary + one row per photo
 *   comparison.pdf    same content, one page per section
 */

import { parseArgs, promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, dirname, basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI, { toFile } from 'openai';
import * as workingTreePrompt from '../../lib/illustration-prompt';
import { normalizeImageForOpenAI } from '../../lib/image-normalize';
import { compose, type EvalResults, type CallResult } from './compose';
import type { TrickyPhoto } from './pull-tricky';

const __dirname = dirname(fileURLToPath(import.meta.url));
// objects: things that should land on a solid color (boots, ramen) plus
// landmark/scene shots that shouldn't. Local only (gitignored): the photos'
// licenses are unknown.
const PHOTO_SETS = {
  default: 'photos',
  tricky: 'photos-tricky',
  objects: 'photos-objects',
} as const;
const RUNS_DIR = join(__dirname, 'runs');

const DEFAULT_MODELS = ['gpt-image-2', 'gpt-image-2.5-flare', 'gpt-image-2.5-sunburst'];
// Matches the production jobs in lib/inngest/functions/.
const OUTPUT_SIZE = '1024x1536';

const toSeconds = (ms: number) => Math.round(ms / 100) / 10;

type PromptModule = Pick<
  typeof workingTreePrompt,
  'BACKGROUND_COLORS' | 'renderIllustrationPrompt'
>;
type PromptVariant = { label: string | null; module: PromptModule };

/**
 * Load lib/illustration-prompt.ts as of each git ref. The file has no imports,
 * so a copy written into the run directory can be imported on its own.
 */
async function loadPromptVariants(refs: string | undefined, runDir: string) {
  if (!refs) return [{ label: null, module: workingTreePrompt }] as PromptVariant[];
  const variants: PromptVariant[] = [];
  for (const spec of refs.split(',').map((r) => r.trim())) {
    const [label, ref] = spec.includes('=') ? spec.split('=', 2) : [spec, spec];
    const { stdout } = await promisify(execFile)('git', [
      'show',
      `${ref}:lib/illustration-prompt.ts`,
    ]);
    const file = join(runDir, `prompt-${label.replace(/[^\w.-]+/g, '_')}.ts`);
    await writeFile(file, stdout);
    variants.push({ label, module: (await import(file)) as PromptModule });
  }
  return variants;
}

/** Run `fn` over `items`, at most `limit` at a time, keeping input order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    })
  );
  return out;
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function main() {
  const { values } = parseArgs({
    options: {
      models: { type: 'string' },
      photos: { type: 'string' },
      compose: { type: 'string' },
      set: { type: 'string' },
      'prompt-refs': { type: 'string' },
      concurrency: { type: 'string' },
    },
  });

  if (values.compose) {
    const out = await compose(resolve(values.compose));
    console.log(`Sheet: ${out.sheet}\nPDF:   ${out.pdf}`);
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set. Run `pnpm secrets:pull`, then `pnpm eval:images`.');
    process.exit(1);
  }

  const models = values.models ? values.models.split(',').map((m) => m.trim()) : DEFAULT_MODELS;
  const photoFilter = values.photos?.split(',').map((p) => p.trim().toLowerCase());

  const set = (values.set ?? 'default') as keyof typeof PHOTO_SETS;
  if (!(set in PHOTO_SETS)) {
    console.error(`Unknown --set ${values.set}. Options: ${Object.keys(PHOTO_SETS).join(', ')}`);
    process.exit(1);
  }
  const photosDirName = PHOTO_SETS[set];
  const photosDir = join(__dirname, photosDirName);

  // The tricky set carries the override text and corrected prod card per photo.
  const tricky = new Map<string, TrickyPhoto>();
  if (set === 'tricky') {
    const manifest = JSON.parse(
      await readFile(join(photosDir, 'manifest.json'), 'utf8').catch(() => {
        console.error('No photos-tricky/manifest.json. Run `pnpm eval:pull-tricky` first.');
        process.exit(1);
      })
    ) as TrickyPhoto[];
    for (const p of manifest) tricky.set(p.file, p);
  }

  const photoFiles = (set === 'tricky' ? [...tricky.keys()] : await readdir(photosDir))
    .filter((f) => ['.jpg', '.jpeg', '.png', '.webp'].includes(extname(f).toLowerCase()))
    .filter((f) => !photoFilter || photoFilter.some((p) => f.toLowerCase().includes(p)))
    .sort();
  if (photoFiles.length === 0) {
    console.error(
      `No photos matched. Check --photos against scripts/image-eval/${photosDirName}/.`
    );
    process.exit(1);
  }

  const runDir = join(RUNS_DIR, timestamp());
  await mkdir(runDir, { recursive: true });

  const variants = await loadPromptVariants(values['prompt-refs'], runDir);
  const columns = models.flatMap((model) =>
    variants.map((variant) => ({
      id: variant.label ? `${model} · ${variant.label}` : model,
      model,
      variant,
    }))
  );
  const concurrency = Math.max(1, Number(values.concurrency ?? 1) || 1);

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const results: EvalResults = {
    startedAt: new Date().toISOString(),
    models: columns.map((c) => c.id),
    size: OUTPUT_SIZE,
    photosDir: photosDirName,
    promptRefs: values['prompt-refs'] ?? null,
    photos: [],
    calls: [],
  };
  const save = () => writeFile(join(runDir, 'results.json'), JSON.stringify(results, null, 2));

  console.log(
    `Eval: ${photoFiles.length} photos × ${columns.length} columns (${concurrency} at a time) → ${runDir}`
  );

  await mapLimit(photoFiles, concurrency, async (file, i) => {
    const stem = basename(file, extname(file));
    const meta = tricky.get(file);
    const normalized = await normalizeImageForOpenAI(await readFile(join(photosDir, file)));
    const pool = variants[0].module.BACKGROUND_COLORS;
    // Fixed background per photo so every column gets a comparable prompt.
    const background = pool[i % pool.length];
    results.photos.push({
      stem,
      file,
      background: background.name,
      ...(meta && { overlay: meta.overlay, reference: meta.reference }),
    });

    // One generation per column per photo: image calls are slow and costly,
    // so no repeats. A photo's columns run concurrently so they share network
    // conditions.
    const calls = await Promise.all(
      columns.map(async ({ id, model, variant }): Promise<CallResult> => {
        const prompt = variant.module.renderIllustrationPrompt(background);
        const start = performance.now();
        try {
          const image = await toFile(normalized, 'image.png', { type: 'image/png' });
          const res = await openai.images.edit({
            model,
            image,
            prompt,
            size: OUTPUT_SIZE,
          });
          const seconds = toSeconds(performance.now() - start);
          const b64 = res.data?.[0]?.b64_json;
          if (!b64) throw new Error('No image data in response');
          const output = `${stem}__${id.replace(/[^\w.-]+/g, '_')}.png`;
          await writeFile(join(runDir, output), Buffer.from(b64, 'base64'));
          console.log(`  ${stem} · ${id}: ${seconds}s`);
          return { photo: stem, model: id, seconds, output, usage: res.usage ?? null };
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          console.warn(
            `  ${stem} · ${id}: FAILED after ${toSeconds(performance.now() - start)}s: ${error}`
          );
          return { photo: stem, model: id, seconds: null, error };
        }
      })
    );
    results.calls.push(...calls);
    await save();
  });

  // Concurrent photos finish out of order; keep the sheet in file order.
  results.photos.sort((a, b) => a.file.localeCompare(b.file));
  results.finishedAt = new Date().toISOString();
  await save();
  const out = await compose(runDir);
  console.log(`\nSheet: ${out.sheet}\nPDF:   ${out.pdf}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
