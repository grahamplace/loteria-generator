// Generates the default ("classic") Lotería card illustrations from
// scripts/example-images/source-photos/<stem>.jpg using the production
// gpt-image-1.5 pipeline. Outputs to scripts/example-images/illustrations/
// <stem>.png. Idempotent — skips stems whose output already exists.
//
// After running this, convert each PNG → webp at 600x900 and place at
// public/default-cards/<stem>.webp. Then add the entry to lib/default-cards.ts.
//
// Usage: pnpm tsx --env-file=.env.local scripts/example-images/generate-default-cards.ts
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI, { toFile } from 'openai';
import { ILLUSTRATION_PROMPT } from '../../lib/illustration-prompt';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = join(__dirname, 'source-photos');
const OUTPUT_DIR = join(__dirname, 'illustrations');

const STEMS = [
  'el-corazon',
  'el-sol',
  'la-luna',
  'la-estrella',
  'el-gallo',
  'el-mundo',
  'la-sandia',
  'el-pescado',
];

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY not set');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function processOne(stem: string) {
  const source = join(SOURCE_DIR, `${stem}.jpg`);
  const output = join(OUTPUT_DIR, `${stem}.png`);
  if (await fileExists(output)) {
    console.log(`  skip ${stem} — output already exists`);
    return;
  }
  if (!(await fileExists(source))) {
    console.warn(`  skip ${stem} — source ${source} missing`);
    return;
  }
  const buffer = await readFile(source);
  const file = await toFile(buffer, `${stem}.jpg`, { type: 'image/jpeg' });
  const start = Date.now();
  const result = await openai.images.edit({
    model: 'gpt-image-1.5',
    image: file,
    prompt: ILLUSTRATION_PROMPT,
    size: '1024x1536',
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error(`${stem}: no image data`);
  await writeFile(output, Buffer.from(b64, 'base64'));
  console.log(`  done ${stem} → ${stem}.png (${((Date.now() - start) / 1000).toFixed(1)}s)`);
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log(`Generating ${STEMS.length} default-card illustrations…`);
  for (const stem of STEMS) {
    try {
      await processOne(stem);
    } catch (err) {
      console.error(`  fail ${stem} —`, err instanceof Error ? err.message : err);
    }
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
