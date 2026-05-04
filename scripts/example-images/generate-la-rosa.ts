// One-off: generate just la-rosa.png for the default-cards seed.
// Bypass the directory-scan loop in generate-illustrations.ts so we don't
// re-charge OpenAI for the existing 18 hero illustrations.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI, { toFile } from 'openai';
import { ILLUSTRATION_PROMPT } from '../../lib/illustration-prompt';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(__dirname, 'source-photos/la-rosa.jpg');
const OUTPUT_DIR = join(__dirname, 'illustrations');
const OUTPUT = join(OUTPUT_DIR, 'la-rosa.png');

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY not set');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const buffer = await readFile(SOURCE);
  const file = await toFile(buffer, 'la-rosa.jpg', { type: 'image/jpeg' });
  console.log('Generating la-rosa illustration…');
  const start = Date.now();
  const result = await openai.images.edit({
    model: 'gpt-image-1.5',
    image: file,
    prompt: ILLUSTRATION_PROMPT,
    size: '1024x1536',
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error('no image data');
  await writeFile(OUTPUT, Buffer.from(b64, 'base64'));
  console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s → ${OUTPUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
