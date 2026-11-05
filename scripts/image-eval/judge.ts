/**
 * Judging for an image-eval run, done by the coding agent session itself (no
 * paid API calls). Two steps:
 *
 * 1. prepareJudging() writes <run>/judge/: one composite JPG per case
 *    (ORIGINAL, optional REFERENCE, then IMAGE A and IMAGE B), an
 *    instructions.md with the rubric and case notes, and key.json, which maps
 *    A/B back to baseline/candidate. A/B order is random per case, so the
 *    judge can't tell which side is the baseline without opening key.json.
 * 2. The agent reads instructions.md and every composite, then writes
 *    <run>/judge/verdicts.json. importJudging() validates it against the
 *    schema and writes judgments.json, which report.ts turns into report.pdf.
 *
 * Re-judging (new rubric, new notes) needs no image calls: prepare again,
 * write new verdicts, import.
 */

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { z } from 'zod/v4';
import type { EvalResults } from './compose';

const EVAL_DIR = dirname(fileURLToPath(import.meta.url));

export const JUDGE_MODEL = 'coding agent session';

// Composite cell size. Big enough to judge faces and lettering once the
// agent's image reader downscales the strip.
const CELL_W = 640;
const CELL_H = 960;
const LABEL_H = 56;

const imageJudgment = z.object({
  likeness: z
    .number()
    .int()
    .nullable()
    .describe('1-5: do faces match the people in the photo? null if no faces.'),
  subject_fidelity: z
    .number()
    .int()
    .describe('1-5: right people/objects, counts, poses and key details; nothing added or lost.'),
  case_check: z
    .enum(['pass', 'partial', 'fail', 'n/a'])
    .describe('Does the image get right what the case note says this photo tests?'),
  style: z.number().int().describe('1-5: reads as a classic Lotería card illustration.'),
  background: z.number().int().describe('1-5: follows the background rules.'),
  clean: z
    .number()
    .int()
    .describe('1-5: free of leaked text, borders, card frames, and artifacts.'),
  overall: z.number().int().describe('1-10: how close this is to a card you would ship.'),
  matched: z.array(z.string()).describe('Specific details from the photo this image got right.'),
  missed: z
    .array(z.string())
    .describe('Specific details this image got wrong, dropped, or invented.'),
});

const judgmentSchema = z.object({
  image_a: imageJudgment,
  image_b: imageJudgment,
  winner: z.enum(['A', 'B', 'tie']),
  reason: z.string().describe('One or two sentences: the deciding difference.'),
});

export type ImageJudgment = z.infer<typeof imageJudgment>;
type Judgment = z.infer<typeof judgmentSchema>;

export const SCORE_KEYS = [
  'likeness',
  'subject_fidelity',
  'style',
  'background',
  'clean',
  'overall',
] as const;
type ScoreKey = (typeof SCORE_KEYS)[number];

export type SideResult = {
  column: string;
  /** Mean over passes; null when the criterion didn't apply. */
  scores: Record<ScoreKey, number | null>;
  /** case_check from each pass. */
  caseCheck: ImageJudgment['case_check'][];
  matched: string[];
  missed: string[];
};

export type CaseJudgment = {
  photo: string;
  why: string | null;
  verdict: 'baseline' | 'candidate' | 'tie';
  /** Passes disagreed (so the verdict was forced to tie). Always false with one pass. */
  split: boolean;
  reasons: string[];
  baseline: SideResult;
  candidate: SideResult;
  error?: string;
};

export type JudgeResults = {
  model: string;
  effort: string;
  /** Passes per case. Old API-judged runs used 2 (A/B swapped); missing means 2. */
  passes?: number;
  baseline: string;
  candidate: string;
  startedAt: string;
  finishedAt?: string;
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
  cases: CaseJudgment[];
};

const SYSTEM = `You judge illustrations for a custom Lotería card product. Customers upload a photo; an image model redraws it as a classic Mexican Lotería card illustration (bold black ink outlines, flat saturated color, aged-paper print feel). The number, title, and border are added later, so an illustration must not contain them.

What a good card does:
- Likeness comes first. People must look like themselves: face shape, features, hair, skin tone, age, expression. Customers judge the card by this.
- Keeps the subject faithful: the same people (no one added or removed), objects, poses, and the details that make the photo theirs.
- Background: a setting that carries the story (a wave behind a surfer, a landmark) is kept and restyled in natural colors. An incidental setting is dropped for one of two classic backgrounds: a flat solid color for objects (like the traditional El Barril or La Bota cards), or the Lotería "sky" (blue fading to dusty pink) for people and scenes.
- No leaked text, captions, watermarks, card borders, or frames, unless the case note says certain text must be kept.

You will see the original photo, sometimes a reference illustration, and two candidate illustrations labeled A and B. The order of A and B is random and says nothing about which is newer or better. Judge each on its own merits against the original photo, then pick the better card. Call it a tie only when neither is meaningfully better.

Scoring anchors for the 1-5 criteria: 5 = no meaningful flaws, 4 = small flaws a customer might not notice, 3 = noticeable flaws, 2 = serious flaws, 1 = fails the criterion. Be specific in matched/missed: name the actual detail ("bride's veil missing", "sign text rendered as gibberish"), not general impressions.`;

/** Default case note for a tricky-set photo, built from the admin's override. */
export function noteFromOverlay(overlay: string): string {
  return `When this card was made, the base prompt failed and the admin had to add this instruction: "${overlay}". Check whether each image gets this right on its own, without that instruction.`;
}

async function readCaseNotes(photosDir: string): Promise<Record<string, { why?: string }>> {
  try {
    return JSON.parse(await readFile(join(photosDir, 'cases.json'), 'utf8'));
  } catch {
    return {};
  }
}

function side(column: string, j: ImageJudgment): SideResult {
  return {
    column,
    scores: Object.fromEntries(SCORE_KEYS.map((k) => [k, j[k]])) as Record<ScoreKey, number | null>,
    caseCheck: [j.case_check],
    matched: j.matched,
    missed: j.missed,
  };
}

/** Run `fn` over `items`, at most `limit` at a time, keeping input order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

type Key = {
  baseline: string;
  candidate: string;
  /** Per case: which column is shown as IMAGE A. */
  cases: Record<string, { a: 'baseline' | 'candidate'; why: string | null }>;
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function cell(path: string, label: string): Promise<sharp.OverlayOptions[]> {
  const img = await sharp(path)
    .rotate()
    .resize(CELL_W, CELL_H, { fit: 'contain', background: '#ffffff' })
    .toBuffer();
  const tag = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CELL_W}" height="${LABEL_H}"><rect width="100%" height="100%" fill="#222"/><text x="16" y="38" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="bold" fill="#fff">${esc(label)}</text></svg>`
  );
  return [
    { input: tag, top: 0, left: 0 },
    { input: img, top: LABEL_H, left: 0 },
  ];
}

async function compositeCase(cells: [string, string][], out: string) {
  const parts = await Promise.all(cells.map(([path, label]) => cell(path, label)));
  await sharp({
    create: {
      width: CELL_W * cells.length,
      height: CELL_H + LABEL_H,
      channels: 3,
      background: '#ffffff',
    },
  })
    .composite(parts.flatMap((p, i) => p.map((o) => ({ ...o, left: (o.left ?? 0) + i * CELL_W }))))
    .jpeg({ quality: 88 })
    .toFile(out);
}

function instructions(
  caseList: { stem: string; file: string; why: string | null; hasRef: boolean }[]
) {
  const schema = JSON.stringify(z.toJSONSchema(judgmentSchema), null, 2);
  return `# Judge this image-eval run

You are the judge. Read every composite in this folder and write \`verdicts.json\` here.
Do not open \`key.json\` or the run's PNGs until you are done: their names reveal which side is the baseline.

${SYSTEM}

In each composite the panels are labeled: ORIGINAL PHOTO, then (when present) REFERENCE, then IMAGE A and IMAGE B.
REFERENCE is an illustration of this photo the admin approved, made with extra instructions. It is one acceptable result, not the only one; don't mark an image down just for differing from it.
Zoom in (crop the composite) when faces or lettering are too small to judge.

## Output

\`verdicts.json\` is one object keyed by case id, each value matching this JSON Schema:

\`\`\`json
${schema}
\`\`\`

Example: \`{ "03-la-familia": { "image_a": {…}, "image_b": {…}, "winner": "B", "reason": "…" } }\`

When done, run: \`pnpm eval:images --judge-import <this run folder>\`

## Cases (${caseList.length})

${caseList
  .map(
    (c) =>
      `- **${c.stem}** → \`${c.file}\`${c.hasRef ? ' (has REFERENCE)' : ''}\n  Case note: ${c.why?.replace(/\s+/g, ' ') ?? 'none. Use case_check "n/a".'}`
  )
  .join('\n')}
`;
}

/** Step 1: write <run>/judge/ for the agent to judge. Returns its path. */
export async function prepareJudging(
  runDir: string,
  opts: { baseline?: string; candidate?: string; concurrency?: number } = {}
): Promise<string> {
  const results = JSON.parse(await readFile(join(runDir, 'results.json'), 'utf8')) as EvalResults;
  const baseline = opts.baseline ?? results.models[0];
  const candidate = opts.candidate ?? results.models[1];
  for (const col of [baseline, candidate]) {
    if (!col || !results.models.includes(col)) {
      throw new Error(
        `Column "${col}" isn't in this run. Columns: ${results.models.join(', ')}. ` +
          'A judged run needs two columns (e.g. --prompt-refs old=main,new=<branch>).'
      );
    }
  }

  const photosDir = join(EVAL_DIR, results.photosDir ?? 'photos');
  const notes = await readCaseNotes(photosDir);
  const judgeDir = join(runDir, 'judge');
  await mkdir(judgeDir, { recursive: true });

  // Skip photos dropped from the set since the run (an audit).
  const present = new Set(await readdir(photosDir));
  const outputOf = (stem: string, col: string) =>
    results.calls.find((c) => c.photo === stem && c.model === col)?.output;
  const photos = results.photos.filter(
    (p) => present.has(p.file) && outputOf(p.stem, baseline) && outputOf(p.stem, candidate)
  );

  const key: Key = { baseline, candidate, cases: {} };
  const caseList = await mapLimit(photos, opts.concurrency ?? 4, async (photo) => {
    const why = notes[photo.stem]?.why ?? (photo.overlay ? noteFromOverlay(photo.overlay) : null);
    const a = Math.random() < 0.5 ? 'baseline' : 'candidate';
    key.cases[photo.stem] = { a, why };
    const [first, second] = a === 'baseline' ? [baseline, candidate] : [candidate, baseline];
    const file = `${photo.stem}.jpg`;
    await compositeCase(
      [
        [join(photosDir, photo.file), 'ORIGINAL PHOTO'],
        ...(photo.reference
          ? [[join(photosDir, photo.reference), 'REFERENCE'] as [string, string]]
          : []),
        [join(runDir, outputOf(photo.stem, first)!), 'IMAGE A'],
        [join(runDir, outputOf(photo.stem, second)!), 'IMAGE B'],
      ],
      join(judgeDir, file)
    );
    return { stem: photo.stem, file, why, hasRef: Boolean(photo.reference) };
  });

  await writeFile(join(judgeDir, 'key.json'), JSON.stringify(key, null, 2));
  await writeFile(join(judgeDir, 'instructions.md'), instructions(caseList));
  return judgeDir;
}

/** Step 2: validate <run>/judge/verdicts.json and write judgments.json. */
export async function importJudging(runDir: string): Promise<JudgeResults> {
  const judgeDir = join(runDir, 'judge');
  const key = JSON.parse(await readFile(join(judgeDir, 'key.json'), 'utf8')) as Key;
  const raw = JSON.parse(await readFile(join(judgeDir, 'verdicts.json'), 'utf8')) as Record<
    string,
    unknown
  >;

  const judged: JudgeResults = {
    model: JUDGE_MODEL,
    effort: '—',
    passes: 1,
    baseline: key.baseline,
    candidate: key.candidate,
    startedAt: new Date().toISOString(),
    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
    cases: [],
  };

  const problems: string[] = [];
  for (const [stem, { a, why }] of Object.entries(key.cases)) {
    const parsed = judgmentSchema.safeParse(raw[stem]);
    if (!parsed.success) {
      problems.push(`${stem}: ${raw[stem] === undefined ? 'missing' : parsed.error.message}`);
      continue;
    }
    const j: Judgment = parsed.data;
    const [base, cand] = a === 'baseline' ? [j.image_a, j.image_b] : [j.image_b, j.image_a];
    const winnerSide =
      j.winner === 'tie'
        ? 'tie'
        : j.winner === 'A'
          ? a
          : a === 'baseline'
            ? 'candidate'
            : 'baseline';
    judged.cases.push({
      photo: stem,
      why,
      verdict: winnerSide,
      split: false,
      reasons: [j.reason],
      baseline: side(key.baseline, base),
      candidate: side(key.candidate, cand),
    });
  }
  for (const stem of Object.keys(raw)) {
    if (!(stem in key.cases)) problems.push(`${stem}: not a case in key.json`);
  }
  if (problems.length) {
    throw new Error(
      `verdicts.json has problems; fix them and import again:\n  ${problems.join('\n  ')}`
    );
  }

  judged.finishedAt = new Date().toISOString();
  await writeFile(join(runDir, 'judgments.json'), JSON.stringify(judged, null, 2));
  return judged;
}
