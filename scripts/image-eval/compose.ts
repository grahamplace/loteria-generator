/**
 * Builds the comparison sheet for an image-eval run from its results.json:
 * a speed summary followed by one row per photo (original + each column's
 * output, captioned with call time). For the tricky set, each row also shows
 * the corrected production card and the admin's override text. Writes comparison.jpg (everything in one
 * tall image) and comparison.pdf (one page per section).
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { jsPDF } from 'jspdf';

export interface CallResult {
  photo: string;
  model: string;
  /** Wall-clock seconds for the single images.edit call; null if it failed. */
  seconds: number | null;
  output?: string;
  error?: string;
  usage?: unknown;
}

export interface EvalResults {
  startedAt: string;
  finishedAt?: string;
  /** Column ids: a model name, or `model · prompt label` with --prompt-refs. */
  models: string[];
  size: string;
  /** Folder under scripts/image-eval/ the photos came from. Default: photos. */
  photosDir?: string;
  promptRefs?: string | null;
  photos: {
    stem: string;
    file: string;
    background: string;
    /** Tricky set: the admin's extra instructions for this card. */
    overlay?: string;
    /** Tricky set: the corrected production illustration, in photosDir. */
    reference?: string | null;
  }[];
  calls: CallResult[];
}

const CELL_W = 480;
const CELL_H = 720; // 2:3, the card aspect ratio
const GAP = 12;
const CAPTION_H = 64;
const ROW_TITLE_H = 56;
const PAD = 24;
const FONT = 'Helvetica, Arial, sans-serif';
const BG = '#f5f0e1';
const INK = '#2b1d14';
const MUTED = '#7a6a5a';

const EVAL_DIR = dirname(fileURLToPath(import.meta.url));
const OVERLAY_LINE_H = 26;
const OVERLAY_MAX_LINES = 3;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const secs = (seconds: number) => `${seconds.toFixed(1)}s`;

function stats(values: number[]) {
  if (values.length === 0) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return { mean, min: Math.min(...values), max: Math.max(...values) };
}

function svg(width: number, height: number, body: string): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`
  );
}

function hasReference(results: EvalResults): boolean {
  return results.photos.some((p) => p.reference);
}

function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const w of text.split(/\s+/)) {
    if (line && (line + ' ' + w).length > maxChars) {
      lines.push(line);
      line = w;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, maxChars - 1)}…`;
  }
  return lines;
}

function sheetWidth(results: EvalResults): number {
  const cols = results.models.length + 1 + (hasReference(results) ? 1 : 0);
  return PAD * 2 + cols * CELL_W + (cols - 1) * GAP;
}

async function renderSummary(results: EvalResults): Promise<Buffer> {
  const width = sheetWidth(results);
  const lineH = 40;
  const colW = (width - PAD * 2) / 6;
  const lines: string[] = [];
  let y = PAD + 40;

  lines.push(
    `<text x="${PAD}" y="${y}" font-family="${FONT}" font-size="36" font-weight="700" fill="${INK}">Image model eval</text>`
  );
  y += 36;
  lines.push(
    `<text x="${PAD}" y="${y}" font-family="${FONT}" font-size="20" fill="${MUTED}">${esc(
      `${results.startedAt.slice(0, 16).replace('T', ' ')} UTC · ${results.photos.length} photos${results.photosDir && results.photosDir !== 'photos' ? ` (${results.photosDir})` : ''} · 1 generation per column per photo · ${results.size} · ${results.promptRefs ? `prompts: ${results.promptRefs}` : 'working-tree prompt'}`
    )}</text>`
  );
  y += 56;

  const header = ['Column', 'Photos', 'Errors', 'Average', 'Fastest', 'Slowest'];
  header.forEach((h, i) => {
    lines.push(
      `<text x="${PAD + i * colW + (i === 0 ? 0 : colW * 0.4)}" y="${y}" font-family="${FONT}" font-size="22" font-weight="700" fill="${INK}">${h}</text>`
    );
  });
  y += 12;
  lines.push(
    `<line x1="${PAD}" x2="${width - PAD}" y1="${y}" y2="${y}" stroke="${MUTED}" stroke-width="1"/>`
  );
  y += lineH - 8;

  for (const model of results.models) {
    const calls = results.calls.filter((c) => c.model === model);
    const times = calls.filter((c) => c.seconds !== null).map((c) => c.seconds as number);
    const s = stats(times);
    const cells = [
      model,
      String(calls.length),
      String(calls.length - times.length),
      s ? secs(s.mean) : '—',
      s ? secs(s.min) : '—',
      s ? secs(s.max) : '—',
    ];
    cells.forEach((c, i) => {
      lines.push(
        `<text x="${PAD + i * colW + (i === 0 ? 0 : colW * 0.4)}" y="${y}" font-family="${FONT}" font-size="22" fill="${INK}">${esc(c)}</text>`
      );
    });
    y += lineH;
  }

  y += 24;
  lines.push(
    `<text x="${PAD}" y="${y}" font-family="${FONT}" font-size="18" fill="${MUTED}">Times are wall-clock seconds for one images.edit call per photo. Columns ran concurrently on each photo.</text>`
  );
  y += PAD;

  return sharp({ create: { width, height: y, channels: 3, background: BG } })
    .composite([{ input: svg(width, y, lines.join('')), top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function fitCell(input: Buffer | string): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize(CELL_W, CELL_H, { fit: 'contain', background: '#ffffff' })
    .toBuffer();
}

function placeholderCell(text: string): Buffer {
  const words = text.split(/\s+/);
  const wrapped: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).length > 38) {
      wrapped.push(line);
      line = w;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) wrapped.push(line);
  const tspans = wrapped
    .slice(0, 12)
    .map((l, i) => `<tspan x="24" dy="${i === 0 ? 0 : 28}">${esc(l)}</tspan>`)
    .join('');
  return svg(
    CELL_W,
    CELL_H,
    `<rect width="100%" height="100%" fill="#e8ded0"/><text x="24" y="${CELL_H / 2 - 60}" font-family="${FONT}" font-size="20" fill="#9b2c1f">${tspans}</text>`
  );
}

async function renderRow(
  results: EvalResults,
  runDir: string,
  photo: EvalResults['photos'][number]
): Promise<Buffer> {
  const width = sheetWidth(results);
  const photosDir = join(EVAL_DIR, results.photosDir ?? 'photos');
  // ~11px per character at 20px Helvetica.
  const overlayLines = photo.overlay
    ? wrap(`Override: ${photo.overlay}`, Math.floor((width - PAD * 2) / 11), OVERLAY_MAX_LINES)
    : [];
  const overlayH = overlayLines.length ? overlayLines.length * OVERLAY_LINE_H + 12 : 0;
  const top = PAD + ROW_TITLE_H + overlayH + CAPTION_H;
  const height = top + CELL_H + PAD;
  const composites: sharp.OverlayOptions[] = [];
  const text: string[] = [
    `<text x="${PAD}" y="${PAD + 36}" font-family="${FONT}" font-size="30" font-weight="700" fill="${INK}">${esc(photo.stem)}</text>`,
    `<text x="${width - PAD}" y="${PAD + 36}" text-anchor="end" font-family="${FONT}" font-size="20" fill="${MUTED}">${esc(`background: ${photo.background}`)}</text>`,
    ...overlayLines.map(
      (l, i) =>
        `<text x="${PAD}" y="${PAD + ROW_TITLE_H + 8 + i * OVERLAY_LINE_H}" font-family="${FONT}" font-size="20" fill="#9b2c1f">${esc(l)}</text>`
    ),
  ];

  const columns: { title: string; detail: string; cell: Promise<Buffer> }[] = [
    { title: 'Original photo', detail: '', cell: fitCell(join(photosDir, photo.file)) },
  ];
  if (hasReference(results)) {
    columns.push({
      title: 'Prod (with override)',
      detail: 'reference',
      cell: photo.reference
        ? fitCell(join(photosDir, photo.reference))
        : Promise.resolve(placeholderCell('No prod illustration')),
    });
  }

  for (const model of results.models) {
    const call = results.calls.find((c) => c.photo === photo.stem && c.model === model);
    const detail = call?.seconds != null ? secs(call.seconds) : 'failed';
    columns.push({
      title: model,
      detail,
      cell: call?.output
        ? fitCell(join(runDir, call.output))
        : Promise.resolve(placeholderCell(call?.error ?? 'Not run')),
    });
  }

  const cells = await Promise.all(columns.map((c) => c.cell));
  columns.forEach((col, i) => {
    const left = PAD + i * (CELL_W + GAP);
    composites.push({ input: cells[i], top, left });
    text.push(
      `<text x="${left}" y="${top - 30}" font-family="${FONT}" font-size="22" font-weight="700" fill="${INK}">${esc(col.title)}</text>`,
      `<text x="${left}" y="${top - 6}" font-family="${FONT}" font-size="20" fill="${MUTED}">${esc(col.detail)}</text>`
    );
  });
  composites.push({ input: svg(width, height, text.join('')), top: 0, left: 0 });

  return sharp({ create: { width, height, channels: 3, background: BG } })
    .composite(composites)
    .jpeg({ quality: 88 })
    .toBuffer();
}

export async function compose(runDir: string): Promise<{ sheet: string; pdf: string }> {
  const results = JSON.parse(await readFile(join(runDir, 'results.json'), 'utf8')) as EvalResults;
  // Photos deleted from the set after the run (an audit) drop out of the sheet.
  const photosDir = join(EVAL_DIR, results.photosDir ?? 'photos');
  const present = new Set(await readdir(photosDir));
  results.photos = results.photos.filter((p) => present.has(p.file));

  const sections = [
    await renderSummary(results),
    ...(await Promise.all(results.photos.map((p) => renderRow(results, runDir, p)))),
  ];
  const metas = await Promise.all(sections.map((s) => sharp(s).metadata()));

  const width = metas[0].width!;
  const totalH = metas.reduce((h, m) => h + m.height!, 0);
  let y = 0;
  const sheet = join(runDir, 'comparison.jpg');
  await sharp({ create: { width, height: totalH, channels: 3, background: BG } })
    .composite(
      sections.map((input, i) => {
        const top = y;
        y += metas[i].height!;
        return { input, top, left: 0 };
      })
    )
    .jpeg({ quality: 88 })
    .toFile(sheet);

  // 1px = 0.75pt keeps each page the same size as its section image.
  const toPt = (px: number) => px * 0.75;
  const doc = new jsPDF({
    unit: 'pt',
    format: [toPt(metas[0].width!), toPt(metas[0].height!)],
    orientation: metas[0].width! > metas[0].height! ? 'landscape' : 'portrait',
    compress: true,
  });
  sections.forEach((s, i) => {
    const w = toPt(metas[i].width!);
    const h = toPt(metas[i].height!);
    if (i > 0) doc.addPage([w, h], w > h ? 'landscape' : 'portrait');
    doc.addImage(s.toString('base64'), 'JPEG', 0, 0, w, h);
  });
  const pdf = join(runDir, 'comparison.pdf');
  await writeFile(pdf, Buffer.from(doc.output('arraybuffer')));

  return { sheet, pdf };
}
