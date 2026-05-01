/**
 * Generates Lotería-styled illustrations + Spanish labels for each source photo
 * in scripts/example-images/source-photos/, using the same OpenAI pipeline as
 * the production card generator.
 *
 * Usage:
 *   pnpm generate:examples           (runs with .env.local loaded via tsx --env-file)
 *   pnpm tsx scripts/example-images/generate-illustrations.ts   (no env loading)
 *
 * Environment:
 *   OPENAI_API_KEY  required
 *
 * Outputs:
 *   scripts/example-images/illustrations/{filename}.png
 *   scripts/example-images/illustrations/manifest.json
 *
 * Idempotent: skips photos whose illustration already exists. Delete a PNG to
 * force regeneration of that one. Delete the whole illustrations/ dir to redo.
 */

import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import OpenAI, { toFile } from 'openai';
import { ILLUSTRATION_PROMPT } from '../../lib/illustration-prompt';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = join(__dirname, 'source-photos');
const OUTPUT_DIR = join(__dirname, 'illustrations');
const MANIFEST_PATH = join(OUTPUT_DIR, 'manifest.json');

if (!process.env.OPENAI_API_KEY) {
  console.error(
    'OPENAI_API_KEY is not set. Run `pnpm secrets:pull` then `pnpm generate:examples`.'
  );
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const LABEL_SYSTEM_PROMPT =
  'You are an expert in Mexican culture and Loteria cards. Generate authentic Loteria-style labels in Spanish.';

const LABEL_USER_PROMPT = `Based on this image, generate a short Spanish word or phrase that would be perfect as a label for a Mexican Loteria card.

The label should be:
- 1-3 words maximum
- A noun or simple phrase
- Appropriate for a traditional Loteria card game
- In Spanish

Return ONLY the Spanish label, nothing else. Example labels: "El Diablo", "La Luna", "El Corazón"`;

type ManifestEntry = {
  source: string;
  illustration: string;
  label: string;
  generatedAt: string;
  durationMs: number;
};

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadManifest(): Promise<Record<string, ManifestEntry>> {
  if (!existsSync(MANIFEST_PATH)) return {};
  const raw = await readFile(MANIFEST_PATH, 'utf8');
  return JSON.parse(raw) as Record<string, ManifestEntry>;
}

async function saveManifest(entries: Record<string, ManifestEntry>): Promise<void> {
  await writeFile(MANIFEST_PATH, JSON.stringify(entries, null, 2) + '\n', 'utf8');
}

async function generateLabel(buffer: Buffer, mime: string): Promise<string> {
  const base64 = buffer.toString('base64');
  const result = await openai.chat.completions.create({
    model: 'gpt-5-nano-2025-08-07',
    messages: [
      { role: 'system', content: LABEL_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
          { type: 'text', text: LABEL_USER_PROMPT },
        ],
      },
    ],
    max_completion_tokens: 500,
    reasoning_effort: 'minimal',
  });
  return result.choices[0]?.message?.content?.trim() ?? '';
}

async function generateIllustration(buffer: Buffer, mime: string, ext: string): Promise<Buffer> {
  const imageFile = await toFile(buffer, `image${ext}`, { type: mime });
  const result = await openai.images.edit({
    model: 'gpt-image-1.5',
    image: imageFile,
    prompt: ILLUSTRATION_PROMPT,
    size: '1024x1536',
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI returned no image data');
  return Buffer.from(b64, 'base64');
}

async function processOne(
  filename: string,
  manifest: Record<string, ManifestEntry>
): Promise<void> {
  const ext = extname(filename).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) {
    console.warn(`  skip ${filename} — unsupported extension`);
    return;
  }

  const stem = basename(filename, ext);
  const outputPath = join(OUTPUT_DIR, `${stem}.png`);

  if (await fileExists(outputPath)) {
    console.log(`  skip ${filename} — output already exists`);
    return;
  }

  const sourcePath = join(SOURCE_DIR, filename);
  const buffer = await readFile(sourcePath);
  const start = Date.now();

  const [illustration, label] = await Promise.all([
    generateIllustration(buffer, mime, ext),
    generateLabel(buffer, mime),
  ]);

  await writeFile(outputPath, illustration);

  const durationMs = Date.now() - start;
  manifest[filename] = {
    source: filename,
    illustration: `${stem}.png`,
    label,
    generatedAt: new Date().toISOString(),
    durationMs,
  };
  await saveManifest(manifest);

  const seconds = (durationMs / 1000).toFixed(1);
  console.log(`  done ${filename} → ${stem}.png  "${label}"  (${seconds}s)`);
}

async function main(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const sources = (await readdir(SOURCE_DIR))
    .filter((f) => extname(f).toLowerCase() in MIME_BY_EXT)
    .sort();

  if (sources.length === 0) {
    console.error(`No source photos found in ${SOURCE_DIR}`);
    process.exit(1);
  }

  console.log(`Found ${sources.length} source photos in ${SOURCE_DIR}`);
  console.log(`Writing illustrations to ${OUTPUT_DIR}`);
  console.log('');

  const manifest = await loadManifest();
  const startedAt = Date.now();
  let succeeded = 0;
  let failed = 0;

  // Sequential to keep things simple and stay under image-edit rate limits.
  for (const filename of sources) {
    try {
      await processOne(filename, manifest);
      succeeded++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  fail ${filename} — ${msg}`);
    }
  }

  const totalSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('');
  console.log(`Done in ${totalSeconds}s — ${succeeded} processed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
