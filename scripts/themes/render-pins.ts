/**
 * Render 2:3 Pinterest pins for every published theme from its committed
 * sample assets, plus a bulk-upload CSV that schedules them.
 *
 *   pnpm tsx scripts/themes/render-pins.ts [--start 2026-10-27]
 *
 * Images land in public/pins/ so the CSV's Media URLs resolve once deployed.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { createCanvas, Image, type SKRSContext2D } from '@napi-rs/canvas';
import { themePages, themePath, type ThemePage } from '@/lib/themes/catalog';
import { resolveBoardStyle, loadPrintFonts } from '@/lib/themes/render-style';
import { installCanvasRuntime } from './canvas-runtime';

const W = 1000;
const H = 1500;
const OUT = 'public/pins';
// Pins outlive any preview deploy, so always point at the production domain.
const SITE_URL = 'https://loteriagenerator.com';

/** Groups themes into keyword-named boards; Pinterest creates missing boards on import. */
const BOARDS: Record<string, string[]> = {
  'Wedding Lotería Ideas': [
    'wedding',
    'destination-wedding',
    'bridal-shower',
    'bachelorette',
    'anniversary',
  ],
  'Holiday Lotería Games': [
    'halloween',
    'christmas',
    'new-years',
    'friendsgiving',
    'hanukkah',
    'easter',
    'cinco-de-mayo',
  ],
  'Lotería Party Ideas': [
    'birthday',
    'milestone-birthday',
    'quinceanera',
    'baby-shower',
    'graduation',
  ],
  'Family Lotería Game Night': ['family-reunion', 'classroom', 'soccer-team', 'original-photos'],
};

function boardFor(id: string) {
  const board = Object.entries(BOARDS).find(([, ids]) => ids.includes(id));
  if (!board) throw new Error(`No Pinterest board for theme: ${id}`);
  return board[0];
}

async function load(path: string) {
  const image = new Image();
  image.src = await readFile(join('public', path));
  await image.decode();
  return image;
}

function centered(ctx: SKRSContext2D, text: string, y: number, font: string, maxWidth = 840) {
  let size = Number(/(\d+)px/.exec(font)![1]);
  const family = font.replace(/^\d+px\s*/, '');
  while (size > 20) {
    ctx.font = `${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size--;
  }
  ctx.fillText(text, W / 2, y);
}

function shadowed(ctx: SKRSContext2D, draw: () => void) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  draw();
  ctx.restore();
}

async function renderPin(page: ThemePage, variant: 'photo' | 'board') {
  const style = resolveBoardStyle({ presetId: page.presets[0] });
  await loadPrintFonts(style.font);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = style.backgroundColor;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = style.borderColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(28, 28, W - 56, H - 56);
  ctx.fillStyle = style.labelColor;
  ctx.textAlign = 'center';
  centered(ctx, 'CUSTOM LOTERÍA', 140, '40px Jost');
  centered(ctx, page.en.name, 265, `104px "${style.font}"`);
  centered(ctx, 'Made from YOUR photos', 340, '40px Jost');

  if (variant === 'photo') {
    const [photo, card] = await Promise.all([
      load(page.sample.assets.photo),
      load(page.sample.assets.card),
    ]);
    // photo.webp is 640×960 and card.webp 604×904: both ~2:3.
    shadowed(ctx, () => ctx.drawImage(photo, 70, 420, 380, 570));
    shadowed(ctx, () => ctx.drawImage(card, 550, 420, 380, 569));
    ctx.font = '34px Jost';
    ctx.fillText('Your photo', 260, 1050);
    ctx.fillText('Your card', 740, 1050);
    ctx.font = '36px Jost';
    ctx.fillText('Printable boards & calling cards', W / 2, 1200);
    ctx.fillText('Try it free in your browser', W / 2, 1260);
  } else {
    const board = await load(page.sample.assets.board);
    // board-1.webp is 1000×1294.
    shadowed(ctx, () => ctx.drawImage(board, 165, 400, 670, 867));
    ctx.font = '36px Jost';
    ctx.fillText('Print at home · play tonight', W / 2, 1340);
  }
  ctx.font = '30px Jost';
  ctx.fillText('LOTERIAGENERATOR.COM', W / 2, 1430);

  const file = `${page.id}-${variant}.jpg`;
  await sharp(canvas.toBuffer('image/png')).jpeg({ quality: 85 }).toFile(join(OUT, file));
  return file;
}

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function pinCopy(page: ThemePage, variant: 'photo' | 'board') {
  const name = page.en.name;
  const custom = page.id === 'original-photos';
  const title =
    variant === 'photo'
      ? custom
        ? 'Custom Lotería Cards Made From Your Own Photos'
        : `Custom ${name} Lotería Cards From Your Photos`
      : custom
        ? 'Printable Photo Lotería Board for Family Game Night'
        : `Printable ${name} Lotería Board | Personalized Game`;
  const ideas = page.en.ideas.slice(0, 3).join(', ').toLowerCase();
  const intro = page.en.intro.split('. ').slice(0, 2).join('. ').replace(/\.?$/, '.');
  const description = `${intro} Card ideas: ${ideas}. Upload your photos, get printable Lotería boards and calling cards, and play the same day. Free sample PDF.`;
  const keywords = [
    'custom loteria',
    'personalized loteria cards',
    'printable loteria',
    `${name.toLowerCase()} loteria`,
    `${name.toLowerCase()} party game`,
    'loteria game night',
  ].join(', ');
  return { title, description: description.slice(0, 500), keywords };
}

async function main() {
  const startArg = process.argv.indexOf('--start');
  const start = new Date(
    `${startArg >= 0 ? process.argv[startArg + 1] : new Date().toISOString().slice(0, 10)}T00:00:00Z`
  );
  await installCanvasRuntime();
  await mkdir(OUT, { recursive: true });
  const rows = [
    [
      'Title',
      'Media URL',
      'Pinterest board',
      'Thumbnail',
      'Description',
      'Link',
      'Publish date',
      'Keywords',
    ],
  ];
  // Photo pins first (one theme a day), then board pins: two pins a day at
  // 15:00 and 23:00 UTC (US morning and evening) instead of one burst.
  const variants = ['photo', 'board'] as const;
  let slot = 0;
  for (const variant of variants) {
    for (const page of themePages) {
      const file = await renderPin(page, variant);
      const { title, description, keywords } = pinCopy(page, variant);
      const day = Math.floor(slot / 2);
      const when = new Date(start);
      when.setUTCDate(when.getUTCDate() + 1 + day);
      when.setUTCHours(slot % 2 ? 23 : 15);
      const link = `${SITE_URL}${themePath(page.id)}?utm_source=pinterest&utm_medium=social&utm_campaign=theme_pins&utm_content=${page.id}-${variant}`;
      rows.push([
        title,
        `${SITE_URL}/pins/${file}`,
        boardFor(page.id),
        '',
        description,
        link,
        when.toISOString().slice(0, 19),
        keywords,
      ]);
      slot++;
      console.log(`Rendered ${file}`);
    }
  }
  await mkdir('.scratch/pinterest', { recursive: true });
  await writeFile(
    '.scratch/pinterest/pins.csv',
    rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n'
  );
  console.log(`Wrote ${rows.length - 1} pins to .scratch/pinterest/pins.csv`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
