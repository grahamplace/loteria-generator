/**
 * LLM-as-judge for an image-eval run: for every photo, Claude compares the
 * baseline column's illustration with the candidate column's against the
 * original photo (and the corrected prod card, when there is one), scores both
 * on a fixed rubric, and picks a winner.
 *
 * Each case is judged twice with the images in swapped A/B positions, because
 * judges lean toward whichever image they see first. The verdict only counts
 * as a win when both passes agree; otherwise it's a tie. The judge is never
 * told which image is the baseline.
 *
 * Writes judgments.json into the run directory. Judging is cheap next to
 * generating, so a run can be re-judged (new rubric, new notes) at any time
 * without regenerating images.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import sharp from 'sharp';
import { z } from 'zod/v4';
import type { EvalResults } from './compose';

const EVAL_DIR = dirname(fileURLToPath(import.meta.url));

export const JUDGE_MODEL = 'claude-opus-5-5';
// Judging likeness and small details rewards deliberate looking.
const JUDGE_EFFORT = 'high';
// Opus 5.5 list price, $ per million tokens; for the cost line in the report.
const PRICE_IN = 4;
const PRICE_OUT = 20;
// Longest edge sent to the judge. Enough to see faces and lettering while
// keeping each image around 1.5k tokens.
const JUDGE_IMAGE_EDGE = 1024;

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
  /** Mean of the two passes; null when the criterion didn't apply. */
  scores: Record<ScoreKey, number | null>;
  /** case_check from each pass (A/B order, then swapped). */
  caseCheck: ImageJudgment['case_check'][];
  matched: string[];
  missed: string[];
};

export type CaseJudgment = {
  photo: string;
  why: string | null;
  /** Both passes agreed on a winner, or the case is a tie. */
  verdict: 'baseline' | 'candidate' | 'tie';
  /** The passes disagreed (so the verdict was forced to tie). */
  split: boolean;
  reasons: string[];
  baseline: SideResult;
  candidate: SideResult;
  error?: string;
};

export type JudgeResults = {
  model: string;
  effort: string;
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

async function imageBlock(path: string): Promise<Anthropic.Beta.BetaImageBlockParam> {
  const data = await sharp(path)
    .rotate()
    .resize(JUDGE_IMAGE_EDGE, JUDGE_IMAGE_EDGE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return {
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data: data.toString('base64') },
  };
}

function mean(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

function side(column: string, first: ImageJudgment, second: ImageJudgment): SideResult {
  return {
    column,
    scores: Object.fromEntries(SCORE_KEYS.map((k) => [k, mean([first[k], second[k]])])) as Record<
      ScoreKey,
      number | null
    >,
    caseCheck: [first.case_check, second.case_check],
    // Notes come from the first pass only; the second pass mostly repeats them.
    matched: first.matched,
    missed: first.missed,
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

export async function judgeRun(
  runDir: string,
  opts: { baseline?: string; candidate?: string; concurrency?: number } = {}
): Promise<JudgeResults> {
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
  const client = new Anthropic();
  const judged: JudgeResults = {
    model: JUDGE_MODEL,
    effort: JUDGE_EFFORT,
    baseline,
    candidate,
    startedAt: new Date().toISOString(),
    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
    cases: [],
  };

  async function ask(content: Anthropic.Beta.BetaContentBlockParam[]): Promise<Judgment> {
    const res = await client.beta.messages.parse({
      model: JUDGE_MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: JUDGE_EFFORT, format: betaZodOutputFormat(judgmentSchema) },
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    });
    judged.usage.inputTokens += res.usage.input_tokens;
    judged.usage.outputTokens += res.usage.output_tokens;
    if (res.stop_reason === 'refusal') throw new Error('Judge declined to evaluate this case');
    if (!res.parsed_output)
      throw new Error(`Judge returned no parseable verdict (${res.stop_reason})`);
    return res.parsed_output;
  }

  // Skip photos dropped from the set since the run (an audit).
  const present = new Set(await readdir(photosDir));
  const cases = results.photos.filter(
    (p) =>
      present.has(p.file) &&
      [baseline, candidate].every((col) =>
        results.calls.some((c) => c.photo === p.stem && c.model === col && c.output)
      )
  );
  console.log(`Judging ${cases.length} cases with ${JUDGE_MODEL} (2 passes each)…`);

  judged.cases = await mapLimit(cases, opts.concurrency ?? 4, async (photo) => {
    const why = notes[photo.stem]?.why ?? (photo.overlay ? noteFromOverlay(photo.overlay) : null);
    const outputOf = (col: string) =>
      join(runDir, results.calls.find((c) => c.photo === photo.stem && c.model === col)!.output!);

    const [original, reference, base, cand] = await Promise.all([
      imageBlock(join(photosDir, photo.file)),
      photo.reference ? imageBlock(join(photosDir, photo.reference)) : null,
      imageBlock(outputOf(baseline)),
      imageBlock(outputOf(candidate)),
    ]);

    const content = (
      a: Anthropic.Beta.BetaImageBlockParam,
      b: Anthropic.Beta.BetaImageBlockParam
    ) => [
      { type: 'text' as const, text: 'ORIGINAL PHOTO:' },
      original,
      ...(reference
        ? [
            {
              type: 'text' as const,
              text: 'REFERENCE: an illustration of this photo the admin approved, made with extra instructions. It is one acceptable result, not the only one; don’t mark an image down just for differing from it.',
            },
            reference,
          ]
        : []),
      { type: 'text' as const, text: 'IMAGE A:' },
      a,
      { type: 'text' as const, text: 'IMAGE B:' },
      b,
      {
        type: 'text' as const,
        text: why
          ? `CASE NOTE (why this photo is in the test set): ${why}`
          : 'CASE NOTE: none. Use case_check "n/a".',
      },
    ];

    try {
      // Pass 1: A = baseline. Pass 2: A = candidate.
      const [p1, p2] = await Promise.all([ask(content(base, cand)), ask(content(cand, base))]);
      const w1 = p1.winner === 'A' ? 'baseline' : p1.winner === 'B' ? 'candidate' : 'tie';
      const w2 = p2.winner === 'A' ? 'candidate' : p2.winner === 'B' ? 'baseline' : 'tie';
      const verdict = w1 === w2 ? w1 : 'tie';
      console.log(`  ${photo.stem}: ${verdict}${w1 !== w2 ? ` (split: ${w1} / ${w2})` : ''}`);
      return {
        photo: photo.stem,
        why,
        verdict,
        split: w1 !== w2,
        reasons: [p1.reason, p2.reason],
        baseline: side(baseline, p1.image_a, p2.image_b),
        candidate: side(candidate, p1.image_b, p2.image_a),
      } satisfies CaseJudgment;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.warn(`  ${photo.stem}: judge failed: ${error}`);
      const empty = (column: string): SideResult => ({
        column,
        scores: Object.fromEntries(SCORE_KEYS.map((k) => [k, null])) as Record<ScoreKey, null>,
        caseCheck: [],
        matched: [],
        missed: [],
      });
      return {
        photo: photo.stem,
        why,
        verdict: 'tie',
        split: false,
        reasons: [],
        baseline: empty(baseline),
        candidate: empty(candidate),
        error,
      } satisfies CaseJudgment;
    }
  });

  judged.finishedAt = new Date().toISOString();
  judged.usage.costUsd =
    (judged.usage.inputTokens * PRICE_IN + judged.usage.outputTokens * PRICE_OUT) / 1_000_000;
  await writeFile(join(runDir, 'judgments.json'), JSON.stringify(judged, null, 2));
  return judged;
}
