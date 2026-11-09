import OpenAI from 'openai';
import { safetyIdentifier } from '@/lib/openai-safety';
import sharp from 'sharp';
import { withAITrace } from '@/lib/ai-tracing';
import {
  SHEET_DETECT_INSTRUCTIONS,
  SHEET_DETECT_MODEL,
  SHEET_DETECT_THRESHOLD,
  SHEET_EXTRACT_MODEL,
  SHEET_EXTRACT_PROMPT,
  SHEET_EXTRACT_SCHEMA,
  parseSheetExtraction,
  type SheetExtraction,
} from '@/lib/sheet-split';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DETECT_ATTEMPTS = 2;
export const SHEET_DETECT_TIMEOUT_MS = 8_000;
export const SHEET_EXTRACT_TIMEOUT_MS = 90_000;

type SheetMeta = { userId: string; boardId: string; cardId: string };

export async function toSheetDataUrl(buffer: Buffer): Promise<string> {
  const jpeg = await sharp(buffer)
    .rotate()
    .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

async function decideOnce(imageDataUrl: string, userId: string): Promise<number | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/decisions', {
      method: 'POST',
      signal: AbortSignal.timeout(SHEET_DETECT_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: SHEET_DETECT_MODEL,
        ...safetyIdentifier(userId),
        input: [{ role: 'user', content: [{ type: 'input_image', image_url: imageDataUrl }] }],
        questions: [
          {
            type: 'predicate',
            name: 'is_card_sheet',
            instructions: SHEET_DETECT_INSTRUCTIONS,
          },
        ],
      }),
    });
    if (!res.ok) {
      console.warn('detect-sheet: attempt failed', { status: res.status });
      return null;
    }
    const json = (await res.json()) as { answers?: { probability?: unknown }[] };
    const p = json.answers?.[0]?.probability;
    return typeof p === 'number' ? p : null;
  } catch (error) {
    console.warn('detect-sheet: attempt failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Probability (0..1) that the image is a sheet of cards, or null when every
 * attempt failed. Traced with the score so misses can be diagnosed later.
 */
export async function scoreSheet(imageDataUrl: string, meta: SheetMeta): Promise<number | null> {
  try {
    return await withAITrace(
      'detect-sheet',
      { ...meta, model: SHEET_DETECT_MODEL },
      async () => {
        for (let attempt = 0; attempt < DETECT_ATTEMPTS; attempt++) {
          const p = await decideOnce(imageDataUrl, meta.userId);
          if (p !== null) return p;
        }
        return null;
      },
      (p) => ({ sheet_probability: p, is_sheet: p !== null && p >= SHEET_DETECT_THRESHOLD })
    );
  } catch {
    return null;
  }
}

export async function detectSheet(imageDataUrl: string, meta: SheetMeta): Promise<boolean> {
  const p = await scoreSheet(imageDataUrl, meta);
  return p !== null && p >= SHEET_DETECT_THRESHOLD;
}

export async function extractSheet(
  imageDataUrl: string,
  meta: SheetMeta
): Promise<SheetExtraction | null> {
  try {
    return await withAITrace('extract-sheet', { ...meta, model: SHEET_EXTRACT_MODEL }, async () => {
      const res = await openai.responses.create(
        {
          model: SHEET_EXTRACT_MODEL,
          ...safetyIdentifier(meta.userId),
          input: [
            {
              role: 'user',
              content: [
                { type: 'input_image', image_url: imageDataUrl, detail: 'high' },
                { type: 'input_text', text: SHEET_EXTRACT_PROMPT },
              ],
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'sheet_cards',
              schema: SHEET_EXTRACT_SCHEMA as unknown as Record<string, unknown>,
              strict: true,
            },
          },
        },
        // No SDK retries: 3 × 90s could outlast the platform's request limit.
        { timeout: SHEET_EXTRACT_TIMEOUT_MS, maxRetries: 0 }
      );
      return parseSheetExtraction(res.output_text);
    });
  } catch (error) {
    console.warn('extract-sheet: failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
