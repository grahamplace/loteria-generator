/**
 * Builds report.pdf for a judged image-eval run: a summary page (verdict
 * counts, mean score per criterion, regressions) followed by one page per case
 * with the images side by side, the case note, and the judge's scores and notes.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { jsPDF } from 'jspdf';
import type { EvalResults } from './compose';
import { SCORE_KEYS, type CaseJudgment, type JudgeResults, type SideResult } from './judge';

const EVAL_DIR = dirname(fileURLToPath(import.meta.url));

// A3 landscape, in points.
const PAGE_W = 1191;
const PAGE_H = 842;
const M = 36;
const INK: [number, number, number] = [43, 29, 20];
const MUTED: [number, number, number] = [122, 106, 90];
const RED: [number, number, number] = [155, 44, 31];
const GREEN: [number, number, number] = [40, 77, 56];

const LABELS: Record<(typeof SCORE_KEYS)[number], string> = {
  likeness: 'Likeness (1–5)',
  subject_fidelity: 'Subject fidelity (1–5)',
  style: 'Lotería style (1–5)',
  background: 'Background (1–5)',
  clean: 'Clean: no text/frames (1–5)',
  overall: 'Overall (1–10)',
};

const fmt = (n: number | null) => (n === null ? '—' : n.toFixed(1));

function meanOf(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

/** Share of a side's case checks (both passes) that passed. */
function passRate(cases: CaseJudgment[], pick: (c: CaseJudgment) => SideResult): string {
  const checks = cases.flatMap((c) => pick(c).caseCheck).filter((v) => v !== 'n/a');
  if (!checks.length) return '—';
  const pass = checks.filter((v) => v === 'pass').length;
  const partial = checks.filter((v) => v === 'partial').length;
  return `${Math.round((pass / checks.length) * 100)}% pass, ${Math.round((partial / checks.length) * 100)}% partial`;
}

async function thumb(path: string, widthPt: number): Promise<string> {
  // 2px per pt keeps thumbnails sharp without bloating the PDF.
  const buf = await sharp(path)
    .rotate()
    .resize(Math.round(widthPt * 2), Math.round(widthPt * 3), {
      fit: 'contain',
      background: '#ffffff',
    })
    .jpeg({ quality: 80 })
    .toBuffer();
  return buf.toString('base64');
}

function text(
  doc: jsPDF,
  s: string,
  x: number,
  y: number,
  opts: {
    size?: number;
    bold?: boolean;
    color?: [number, number, number];
    width?: number;
    align?: 'left' | 'right';
  } = {}
): number {
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  doc.setFontSize(opts.size ?? 11);
  doc.setTextColor(...(opts.color ?? INK));
  const lines: string[] = opts.width ? doc.splitTextToSize(s, opts.width) : [s];
  doc.text(lines, x, y, { align: opts.align ?? 'left' });
  return y + lines.length * (opts.size ?? 11) * 1.25;
}

function summaryPage(doc: jsPDF, results: EvalResults, judged: JudgeResults) {
  const ok = judged.cases.filter((c) => !c.error);
  const count = (v: CaseJudgment['verdict']) => ok.filter((c) => c.verdict === v).length;
  const splits = ok.filter((c) => c.split).length;

  let y = M + 20;
  y = text(doc, 'Image eval: judged report', M, y, { size: 26, bold: true });
  y = text(
    doc,
    `${results.startedAt.slice(0, 16).replace('T', ' ')} UTC · ${results.photosDir ?? 'photos'} · ${results.promptRefs ? `prompts ${results.promptRefs}` : 'working-tree prompt'} · judge ${judged.model} (effort ${judged.effort}, 2 passes per case with A/B swapped)`,
    M,
    y + 4,
    { size: 11, color: MUTED, width: PAGE_W - M * 2 }
  );

  y += 24;
  y = text(doc, `Baseline: ${judged.baseline}     Candidate: ${judged.candidate}`, M, y, {
    size: 14,
    bold: true,
  });

  y += 16;
  const boxes: [string, number, [number, number, number]][] = [
    ['Candidate better', count('candidate'), GREEN],
    ['Baseline better', count('baseline'), RED],
    ['Tie', count('tie'), MUTED],
  ];
  boxes.forEach(([label, n, color], i) => {
    const x = M + i * 200;
    text(doc, String(n), x, y + 36, { size: 40, bold: true, color });
    text(doc, label, x, y + 58, { size: 12, color: MUTED });
  });
  y += 80;
  y = text(
    doc,
    `${ok.length} cases judged${judged.cases.length - ok.length ? `, ${judged.cases.length - ok.length} failed` : ''}. A win needs both passes to agree; ${splits} case${splits === 1 ? '' : 's'} split and counted as ties. Judge cost: $${judged.usage.costUsd.toFixed(2)} (${judged.usage.inputTokens.toLocaleString()} in / ${judged.usage.outputTokens.toLocaleString()} out tokens).`,
    M,
    y,
    { size: 11, color: MUTED, width: PAGE_W - M * 2 }
  );

  // Mean score per criterion.
  y += 20;
  const cols = [M, M + 300, M + 450, M + 600];
  text(doc, 'Criterion', cols[0], y, { bold: true });
  text(doc, 'Baseline', cols[1], y, { bold: true });
  text(doc, 'Candidate', cols[2], y, { bold: true });
  text(doc, 'Change', cols[3], y, { bold: true });
  doc.setDrawColor(...MUTED);
  doc.line(M, y + 6, M + 720, y + 6);
  y += 24;
  for (const key of SCORE_KEYS) {
    const b = meanOf(ok.map((c) => c.baseline.scores[key]));
    const c = meanOf(ok.map((c) => c.candidate.scores[key]));
    const d = b !== null && c !== null ? c - b : null;
    text(doc, LABELS[key], cols[0], y);
    text(doc, fmt(b), cols[1], y);
    text(doc, fmt(c), cols[2], y);
    text(doc, d === null ? '—' : `${d >= 0 ? '+' : ''}${d.toFixed(2)}`, cols[3], y, {
      bold: true,
      color: d === null || Math.abs(d) < 0.05 ? MUTED : d > 0 ? GREEN : RED,
    });
    y += 20;
  }
  text(doc, 'Case check (the case note)', cols[0], y);
  text(
    doc,
    passRate(ok, (c) => c.baseline),
    cols[1],
    y,
    { size: 9 }
  );
  text(
    doc,
    passRate(ok, (c) => c.candidate),
    cols[2],
    y,
    { size: 9 }
  );
  y += 32;

  const list = (title: string, items: CaseJudgment[], color: [number, number, number]) => {
    if (!items.length) return;
    y = text(doc, title, M, y, { size: 13, bold: true, color });
    for (const c of items) {
      y = text(doc, `${c.photo}: ${c.reasons[0] ?? ''}`, M + 12, y, {
        size: 10,
        width: PAGE_W - M * 2 - 12,
      });
      if (y > PAGE_H - M) return;
    }
    y += 10;
  };
  list(
    'Regressions (baseline better)',
    ok.filter((c) => c.verdict === 'baseline'),
    RED
  );
  list(
    'Improvements (candidate better)',
    ok.filter((c) => c.verdict === 'candidate'),
    GREEN
  );

  text(
    doc,
    'The judge is a first pass, weakest on face likeness: check its calls against your own eye before trusting the totals.',
    M,
    PAGE_H - M,
    { size: 10, color: MUTED }
  );
}

async function casePage(
  doc: jsPDF,
  results: EvalResults,
  runDir: string,
  judged: JudgeResults,
  c: CaseJudgment
) {
  const photo = results.photos.find((p) => p.stem === c.photo)!;
  const photosDir = join(EVAL_DIR, results.photosDir ?? 'photos');
  const output = (col: string) =>
    results.calls.find((x) => x.photo === c.photo && x.model === col)?.output;

  const verdictText =
    c.verdict === 'candidate'
      ? 'Candidate better'
      : c.verdict === 'baseline'
        ? 'Baseline better'
        : c.split
          ? 'Tie (passes split)'
          : 'Tie';
  const verdictColor = c.verdict === 'candidate' ? GREEN : c.verdict === 'baseline' ? RED : MUTED;

  let y = M + 16;
  text(doc, c.photo, M, y, { size: 18, bold: true });
  text(doc, verdictText, PAGE_W - M, y, {
    size: 16,
    bold: true,
    color: verdictColor,
    align: 'right',
  });
  y += 8;
  if (c.why) {
    y = text(doc, `Case note: ${c.why}`, M, y + 12, {
      size: 10,
      color: RED,
      width: PAGE_W - M * 2,
    });
  }
  if (c.error) y = text(doc, `Judge failed: ${c.error}`, M, y + 6, { size: 10, color: RED });

  // Images: original, reference (if any), baseline, candidate.
  const cells: [string, string | undefined | null][] = [
    ['Original photo', join(photosDir, photo.file)],
    ...(photo.reference
      ? ([['Prod (with override)', join(photosDir, photo.reference)]] as [string, string][])
      : []),
    [
      `Baseline · ${judged.baseline}`,
      output(judged.baseline) && join(runDir, output(judged.baseline)!),
    ],
    [
      `Candidate · ${judged.candidate}`,
      output(judged.candidate) && join(runDir, output(judged.candidate)!),
    ],
  ];
  const imgW = 196;
  const imgH = imgW * 1.5;
  const top = y + 22;
  for (const [i, [label, path]] of cells.entries()) {
    const x = M + i * (imgW + 12);
    text(doc, label, x, top - 6, { size: 9, bold: true, width: imgW });
    if (path) doc.addImage(await thumb(path, imgW), 'JPEG', x, top, imgW, imgH);
  }

  // Score table to the right of the images.
  const tx = M + cells.length * (imgW + 12) + 12;
  let ty = top + 4;
  const tcols = [tx, tx + 170, tx + 240];
  text(doc, 'Criterion', tcols[0], ty, { size: 10, bold: true });
  text(doc, 'Base', tcols[1], ty, { size: 10, bold: true });
  text(doc, 'Cand', tcols[2], ty, { size: 10, bold: true });
  ty += 16;
  for (const key of SCORE_KEYS) {
    const b = c.baseline.scores[key];
    const d = c.candidate.scores[key];
    text(doc, LABELS[key], tcols[0], ty, { size: 10 });
    text(doc, fmt(b), tcols[1], ty, { size: 10 });
    text(doc, fmt(d), tcols[2], ty, {
      size: 10,
      bold: true,
      color: b === null || d === null || b === d ? INK : d > b ? GREEN : RED,
    });
    ty += 15;
  }
  text(doc, 'Case check', tcols[0], ty, { size: 10 });
  text(doc, c.baseline.caseCheck.join('/') || '—', tcols[1], ty, { size: 9 });
  text(doc, c.candidate.caseCheck.join('/') || '—', tcols[2], ty, { size: 9 });
  ty += 22;
  const reasonW = PAGE_W - M - tx;
  c.reasons.forEach((r, i) => {
    ty = text(doc, `Pass ${i + 1}: ${r}`, tx, ty, { size: 9, color: MUTED, width: reasonW });
    ty += 4;
  });

  // Notes under the images: what each side matched and missed.
  const ny = top + imgH + 28;
  const noteW = (PAGE_W - M * 2 - 24) / 2;
  const notes = (s: SideResult, title: string, x: number) => {
    let yy = text(doc, title, x, ny, { size: 11, bold: true });
    yy += 2;
    for (const m of s.missed) {
      yy = text(doc, `– ${m}`, x, yy, { size: 9, color: RED, width: noteW });
      if (yy > PAGE_H - M) return;
    }
    for (const m of s.matched) {
      yy = text(doc, `+ ${m}`, x, yy, { size: 9, color: GREEN, width: noteW });
      if (yy > PAGE_H - M) return;
    }
  };
  notes(c.baseline, 'Baseline: – missed, + matched', M);
  notes(c.candidate, 'Candidate: – missed, + matched', M + noteW + 24);
}

export async function buildReport(runDir: string): Promise<string> {
  const results = JSON.parse(await readFile(join(runDir, 'results.json'), 'utf8')) as EvalResults;
  const judged = JSON.parse(await readFile(join(runDir, 'judgments.json'), 'utf8')) as JudgeResults;

  // Photos deleted from the set after the run (an audit) drop out of the report.
  const present = new Set(await readdir(join(EVAL_DIR, results.photosDir ?? 'photos')));
  judged.cases = judged.cases.filter((c) =>
    present.has(results.photos.find((p) => p.stem === c.photo)?.file ?? '')
  );

  const doc = new jsPDF({ unit: 'pt', format: [PAGE_W, PAGE_H], orientation: 'landscape' });
  summaryPage(doc, results, judged);
  // Regressions first, then ties, then improvements: the pages to look at.
  const order = { baseline: 0, tie: 1, candidate: 2 } as const;
  const cases = [...judged.cases].sort(
    (a, b) => order[a.verdict] - order[b.verdict] || a.photo.localeCompare(b.photo)
  );
  for (const c of cases) {
    doc.addPage([PAGE_W, PAGE_H], 'landscape');
    await casePage(doc, results, runDir, judged, c);
  }

  const out = join(runDir, 'report.pdf');
  await writeFile(out, Buffer.from(doc.output('arraybuffer')));
  return out;
}
