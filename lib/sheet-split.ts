// Pure helpers for splitting an uploaded sheet of lotería cards into individual cards.
// No I/O: no sharp, openai, db, or fs imports.

export const SHEET_DETECT_MODEL = 'gpt-6-luna';
export const SHEET_EXTRACT_MODEL = 'gpt-6.1-sol';
export const SHEET_DETECT_THRESHOLD = 0.9;

export const SHEET_CARD_OVERLAY =
  'The input is a scanned lotería card. Illustrate only the picture. Do not reproduce the card border, the card number, or any printed title or caption text.';

export const SHEET_DETECT_INSTRUCTIONS =
  'True if this image shows MULTIPLE distinct lotería-style (or similar illustrated playing) cards laid out together — e.g. a printed sheet, a grid, a full deck, or a photo of several cards on a table. False for a single card, a regular photo, or a scene.';

export const SHEET_EXTRACT_PROMPT = `This image contains multiple lotería cards. List every card in reading order (top-left to bottom-right).
For each card give:
- row, col (1-based grid position)
- title: the card's main printed title exactly as written (Spanish, primary line only; omit the card number and any smaller translated subtitle). null if no title is printed.
- complete: false if the card is cut off by the image edge or covered.
- box: the card's outer edge as fractions of image width/height (0..1), x0,y0 = top-left, x1,y1 = bottom-right. Include the card border and title.`;

export const SHEET_EXTRACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rows', 'cols', 'cards'],
  properties: {
    rows: { type: 'integer' },
    cols: { type: 'integer' },
    cards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['row', 'col', 'title', 'complete', 'box'],
        properties: {
          row: { type: 'integer' },
          col: { type: 'integer' },
          title: { type: ['string', 'null'] },
          complete: { type: 'boolean' },
          box: {
            type: 'object',
            additionalProperties: false,
            required: ['x0', 'y0', 'x1', 'y1'],
            properties: {
              x0: { type: 'number' },
              y0: { type: 'number' },
              x1: { type: 'number' },
              y1: { type: 'number' },
            },
          },
        },
      },
    },
  },
} as const;

export type SheetBox = { x0: number; y0: number; x1: number; y1: number };
export type SheetCard = {
  row: number;
  col: number;
  title: string | null;
  complete: boolean;
  box: SheetBox;
};
export type SheetExtraction = { rows: number; cols: number; cards: SheetCard[] };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function parseSheetExtraction(raw: string): SheetExtraction | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (!isNum(d.rows) || !isNum(d.cols) || !Array.isArray(d.cards)) return null;

  const cards: SheetCard[] = [];
  for (const item of d.cards) {
    if (!item || typeof item !== 'object') return null;
    const c = item as Record<string, unknown>;
    const b = c.box as Record<string, unknown> | null | undefined;
    if (
      !isNum(c.row) ||
      !isNum(c.col) ||
      typeof c.complete !== 'boolean' ||
      (c.title !== null && typeof c.title !== 'string') ||
      !b ||
      !isNum(b.x0) ||
      !isNum(b.y0) ||
      !isNum(b.x1) ||
      !isNum(b.y1)
    ) {
      return null;
    }
    if (!c.complete) continue;
    const box: SheetBox = {
      x0: clamp01(b.x0),
      y0: clamp01(b.y0),
      x1: clamp01(b.x1),
      y1: clamp01(b.y1),
    };
    if (box.x1 - box.x0 < 0.01 || box.y1 - box.y0 < 0.01) continue;
    const title = typeof c.title === 'string' ? c.title.trim() || null : null;
    cards.push({ row: c.row, col: c.col, title, complete: true, box });
  }
  cards.sort((a, b) => a.row - b.row || a.col - b.col);
  return { rows: d.rows, cols: d.cols, cards };
}

export function normalizeTitle(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function computeSheetSlots(a: {
  cardLimit: number;
  currentCardCount: number;
  generationLimit: number;
  imageGenerationsUsed: number;
  isAdmin: boolean;
}): number {
  const cardRoom = a.cardLimit - a.currentCardCount + 1;
  const genRoom = a.isAdmin ? Infinity : a.generationLimit - a.imageGenerationsUsed;
  return Math.max(0, Math.min(cardRoom, genRoom));
}

export function selectSheetCards(
  cards: SheetCard[],
  existingLabels: string[],
  slots: number
): { selected: SheetCard[]; skippedCount: number } {
  const existing = new Set(existingLabels.map(normalizeTitle));
  const remaining: SheetCard[] = [];
  let skippedCount = 0;
  for (const c of cards) {
    if (c.title !== null && existing.has(normalizeTitle(c.title))) skippedCount++;
    else remaining.push(c);
  }
  return { selected: remaining.slice(0, Math.max(0, slots)), skippedCount };
}

export function boxToRegion(
  box: SheetBox,
  width: number,
  height: number
): { left: number; top: number; width: number; height: number } | null {
  const left = Math.min(width, Math.max(0, Math.round(box.x0 * width)));
  const top = Math.min(height, Math.max(0, Math.round(box.y0 * height)));
  const right = Math.min(width, Math.max(0, Math.round(box.x1 * width)));
  const bottom = Math.min(height, Math.max(0, Math.round(box.y1 * height)));
  const w = right - left;
  const h = bottom - top;
  if (w < 4 || h < 4) return null;
  return { left, top, width: w, height: h };
}

export function withSheetOverlay(fromSheet: boolean, adminOverlay?: string | null): string | null {
  if (!fromSheet) return adminOverlay ?? null;
  return adminOverlay ? `${SHEET_CARD_OVERLAY}\n\n${adminOverlay}` : SHEET_CARD_OVERLAY;
}
