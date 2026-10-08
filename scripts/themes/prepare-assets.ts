/** Import approved Etsy examples once; subsequent renders need only committed manifests/assets. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createCanvas, Image } from '@napi-rs/canvas';
import { renderSamples, type SampleManifest } from './render-samples';
import { themePages } from '@/lib/themes/catalog';
import { resolveBoardStyle, loadPrintFonts } from '@/lib/themes/render-style';

type SourceTheme = { folder: string; compare_id: string };
async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8'));
}
async function main() {
  const importing = process.argv.includes('--import-etsy');
  const requested = process.argv.indexOf('--theme');
  const selected = requested >= 0 ? process.argv[requested + 1] : undefined;
  if (selected && !themePages.some((page) => page.id === selected))
    throw new Error('Unknown theme');
  const sources = importing
    ? [
        ...(await readJson<SourceTheme[]>('output/etsy/variants-2026/themes.json')),
        ...(await readJson<SourceTheme[]>('output/etsy/variants-2-2026/themes.json')),
      ]
    : [];
  await mkdir('scripts/themes/samples', { recursive: true });
  await mkdir('public/themes/cards', { recursive: true });
  for (const [index, theme] of themePages.entries()) {
    if (selected && theme.id !== selected) continue;
    const folder = `public/themes/${theme.id}`;
    await mkdir(folder, { recursive: true });
    const manifestPath = `scripts/themes/samples/${theme.id}.json`;
    let manifest: SampleManifest & {
      compareId: string;
      sourcePackage?: string;
      etsyListingId?: string;
    };
    if (importing) {
      const source = index === 0 ? 'output/etsy/halloween-2026' : sources[index - 1].folder;
      const input = await readJson<SampleManifest>(join(source, 'manifest.json'));
      const compareId = index === 0 ? '02-witch-kids' : sources[index - 1].compare_id;
      const records = [];
      for (const card of input.cards) {
        const bytes = await readFile(resolve(card.illustration));
        const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 18);
        const destination = `public/themes/cards/${hash}.webp`;
        await sharp(bytes)
          .resize(768, 1152, { fit: 'inside' })
          .webp({ quality: 90 })
          .toFile(destination);
        records.push({
          id: card.id,
          label: card.label,
          number: card.number,
          illustration: destination,
          source: relative(process.cwd(), resolve(card.illustration)),
        });
      }
      manifest = {
        title: `${theme.en.name} Lotería`,
        styles: { presetId: theme.id, showTitle: true },
        cards: records,
        compareId,
        sourcePackage: source,
      };
      // Keep the exact pairing chosen in the listing's reviewed comparison image.
      const photoPath =
        index === 0
          ? join(source, 'photo-comparison-source.jpg')
          : join(source, 'comparison-photo.jpg');
      await sharp(photoPath)
        .resize(640, 960, { fit: 'cover' })
        .webp({ quality: 85 })
        .toFile(join(folder, 'photo.webp'));
      if (!records.some((card) => card.id === compareId)) {
        if (index === 0) manifest.compareId = records.find((card) => /dog/.test(card.id))!.id;
        else throw new Error(`Missing comparison card for ${theme.id}`);
      }
      const statusPath =
        index <= 10
          ? 'output/etsy/variants-2026/status.json'
          : 'output/etsy/variants-2-2026/status.json';
      const statuses = await readJson<{ id: string }[]>(statusPath);
      manifest.etsyListingId =
        index === 0 ? '4590829386' : statuses[index <= 10 ? index - 1 : index - 11].id;
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    } else {
      manifest = await readJson(manifestPath);
    }
    const renderDir = `.scratch/theme-renders/${theme.id}`;
    await renderSamples(manifest, renderDir);
    for (const n of [1, 2])
      await writeFile(
        join(folder, `board-${n}.webp`),
        await readFile(join(renderDir, `board-${n}.webp`))
      );
    await sharp(join(renderDir, `${manifest.compareId}-card.png`))
      .webp({ quality: 90 })
      .toFile(join(folder, 'card.webp'));
    const style = resolveBoardStyle(manifest.styles);
    await loadPrintFonts(style.font);
    for (const locale of ['en', 'es'] as const) {
      const canvas = createCanvas(1200, 630);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = style.backgroundColor;
      ctx.fillRect(0, 0, 1200, 630);
      ctx.strokeStyle = style.borderColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(24, 24, 1152, 582);
      ctx.fillStyle = style.labelColor;
      ctx.font = '38px Jost';
      ctx.fillText(locale === 'en' ? 'CUSTOM LOTERÍA' : 'LOTERÍA PERSONALIZADA', 65, 145);
      let size = 80;
      const name = locale === 'en' ? theme.en.name : theme['es-MX'].name;
      while (size > 34) {
        ctx.font = `${size}px "${style.font}"`;
        if (ctx.measureText(name).width < 655) break;
        size--;
      }
      ctx.fillText(name, 65, 270);
      ctx.font = '30px Jost';
      ctx.fillText(locale === 'en' ? 'Made from YOUR photos' : 'Hecha con TUS fotos', 65, 350);
      ctx.font = '22px Jost';
      ctx.fillText('LOTERÍA GENERATOR', 65, 550);
      const board = new Image();
      board.src = await readFile(join(folder, 'board-1.webp'));
      await board.decode();
      ctx.drawImage(board, 775, 58, 370, 480);
      await sharp(canvas.toBuffer('image/png'))
        .jpeg({ quality: 88 })
        .toFile(join(folder, `og-${locale}.jpg`));
    }
    console.log(`Rendered ${theme.id}`);
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
