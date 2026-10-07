/**
 * Builds the "tricky" eval set: every production card where an admin had to
 * add extra prompt instructions (prompt_overlay) to get a good illustration.
 * Downloads each card's original photo and its final illustration (the
 * hand-corrected result, used as a reference column in the sheet).
 *
 * These are customer photos. They go to scripts/image-eval/photos-tricky/,
 * which is gitignored — never commit them.
 *
 * Usage:
 *   PROD_DATABASE_URL=… pnpm eval:pull-tricky
 *
 * Environment:
 *   PROD_DATABASE_URL         production Neon URL (in .env.personal); read-only queries
 *   PRIVATE_READ_WRITE_TOKEN  blob token (from .env.local; prod and dev share the store)
 *
 * Re-running replaces the folder's contents with the current set.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import { fetchBlob } from '../../lib/blob';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const TRICKY_DIR = join(__dirname, 'photos-tricky');

export type TrickyPhoto = {
  /** Original photo, relative to photos-tricky/. */
  file: string;
  /** The corrected production illustration, relative to photos-tricky/. */
  reference: string | null;
  cardId: string;
  label: string;
  /** The admin's extra instructions: what the base prompt got wrong. */
  overlay: string;
};

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

function slug(label: string): string {
  return (
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'card'
  );
}

async function main() {
  const url = process.env.PROD_DATABASE_URL;
  if (!url) {
    console.error('PROD_DATABASE_URL is not set (the production URL lives in .env.personal).');
    process.exit(1);
  }

  const sql = neon(url);
  const [rows] = await sql.transaction(
    [
      sql`
        select id, label, prompt_overlay, original_image_url, illustration_url
        from cards
        where nullif(trim(prompt_overlay), '') is not null
          and original_image_url is not null
        order by created_at
      `,
    ],
    { readOnly: true }
  );

  await rm(TRICKY_DIR, { recursive: true, force: true });
  await mkdir(TRICKY_DIR, { recursive: true });

  const manifest: TrickyPhoto[] = [];
  for (const [i, row] of (rows as Record<string, string | null>[]).entries()) {
    const stem = `${String(i + 1).padStart(2, '0')}-${slug(row.label ?? '')}`;
    try {
      const original = await fetchBlob(row.original_image_url!);
      const file = `${stem}.${EXT[original.contentType] ?? 'png'}`;
      await writeFile(join(TRICKY_DIR, file), original.buffer);

      let reference: string | null = null;
      if (row.illustration_url?.startsWith('https://')) {
        try {
          const ill = await fetchBlob(row.illustration_url);
          reference = `${stem}.reference.${EXT[ill.contentType] ?? 'png'}`;
          await writeFile(join(TRICKY_DIR, reference), ill.buffer);
        } catch (err) {
          console.warn(`  ${stem}: no reference illustration (${(err as Error).message})`);
        }
      }

      manifest.push({
        file,
        reference,
        cardId: row.id!,
        label: row.label ?? '',
        overlay: row.prompt_overlay!.trim(),
      });
      console.log(`  ${file}`);
    } catch (err) {
      console.warn(`  ${stem}: skipped (${(err as Error).message})`);
    }
  }

  await writeFile(join(TRICKY_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n${manifest.length}/${rows.length} cards → ${TRICKY_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
