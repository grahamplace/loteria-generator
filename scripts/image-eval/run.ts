/**
 * Image model eval: runs the real test photos in scripts/image-eval/photos/
 * through the production illustration pipeline on several image models, times
 * every call, and builds a side-by-side comparison sheet (JPG + PDF).
 *
 * Usage:
 *   pnpm eval:images
 *   pnpm eval:images --models gpt-image-2,gpt-image-2.5-flare
 *   pnpm eval:images --photos dog,hockey
 *   pnpm eval:images --compose scripts/image-eval/runs/<run>   (rebuild sheet, no API calls)
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

import { parseArgs } from 'node:util';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, dirname, basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI, { toFile } from 'openai';
import { BACKGROUND_COLORS, renderIllustrationPrompt } from '../../lib/illustration-prompt';
import { normalizeImageForOpenAI } from '../../lib/image-normalize';
import { compose, type EvalResults, type CallResult } from './compose';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PHOTOS_DIR = join(__dirname, 'photos');
const RUNS_DIR = join(__dirname, 'runs');

const DEFAULT_MODELS = ['gpt-image-2', 'gpt-image-2.5-flare', 'gpt-image-2.5-sunburst'];
// Matches the production jobs in lib/inngest/functions/.
const OUTPUT_SIZE = '1024x1536';

const toSeconds = (ms: number) => Math.round(ms / 100) / 10;

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function main() {
  const { values } = parseArgs({
    options: {
      models: { type: 'string' },
      photos: { type: 'string' },
      compose: { type: 'string' },
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

  const photoFiles = (await readdir(PHOTOS_DIR))
    .filter((f) => ['.jpg', '.jpeg', '.png', '.webp'].includes(extname(f).toLowerCase()))
    .filter((f) => !photoFilter || photoFilter.some((p) => f.toLowerCase().includes(p)))
    .sort();
  if (photoFiles.length === 0) {
    console.error('No photos matched. Check --photos against scripts/image-eval/photos/.');
    process.exit(1);
  }

  const runDir = join(RUNS_DIR, timestamp());
  await mkdir(runDir, { recursive: true });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const results: EvalResults = {
    startedAt: new Date().toISOString(),
    models,
    size: OUTPUT_SIZE,
    photos: [],
    calls: [],
  };
  const save = () => writeFile(join(runDir, 'results.json'), JSON.stringify(results, null, 2));

  console.log(`Eval: ${photoFiles.length} photos × ${models.length} models → ${runDir}`);

  for (const [i, file] of photoFiles.entries()) {
    const stem = basename(file, extname(file));
    // Fixed background per photo so every model gets the identical prompt.
    const background = BACKGROUND_COLORS[i % BACKGROUND_COLORS.length];
    const prompt = renderIllustrationPrompt(background);
    const normalized = await normalizeImageForOpenAI(await readFile(join(PHOTOS_DIR, file)));
    results.photos.push({ stem, file, background: background.name });

    // One generation per model per photo: image calls are slow and costly,
    // so no repeats. Models run concurrently on the same photo so they share
    // network conditions; photos go one after another.
    const calls = await Promise.all(
      models.map(async (model): Promise<CallResult> => {
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
          const output = `${stem}__${model}.png`;
          await writeFile(join(runDir, output), Buffer.from(b64, 'base64'));
          console.log(`  ${stem} · ${model}: ${seconds}s`);
          return { photo: stem, model, seconds, output, usage: res.usage ?? null };
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          console.warn(
            `  ${stem} · ${model}: FAILED after ${toSeconds(performance.now() - start)}s: ${error}`
          );
          return { photo: stem, model, seconds: null, error };
        }
      })
    );
    results.calls.push(...calls);
    await save();
  }

  results.finishedAt = new Date().toISOString();
  await save();
  const out = await compose(runDir);
  console.log(`\nSheet: ${out.sheet}\nPDF:   ${out.pdf}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
