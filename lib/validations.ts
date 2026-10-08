import { z } from 'zod';
import { isThemeId } from '@/lib/themes/presets';

export const boardStyleSchema = z.object({
  backgroundColor: z.string().max(50).optional(),
  badgeColor: z.string().max(50).optional(),
  labelColor: z.string().max(50).optional(),
  presetId: z.custom<import('@/lib/themes/presets').ThemeId>(isThemeId, 'Unknown theme').optional(),
  showTitle: z.boolean().optional(),
});
export const photoModeSchema = z.enum(['illustrated', 'original']);

// Max base64 payload size: ~10MB decoded (base64 is ~33% larger than raw)
const MAX_BASE64_LENGTH = 14_000_000; // ~10MB decoded

const base64ImageString = z.string().max(MAX_BASE64_LENGTH, 'Image exceeds maximum size of 10MB');

const cropDataSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

// POST /api/boards
export const createBoardSchema = z.object({
  name: z.string().max(200).optional(),
  styleOptions: boardStyleSchema.optional(),
  photoMode: photoModeSchema.optional(),
});

// PATCH /api/boards/[boardId]
export const updateBoardSchema = z.object({
  name: z.string().max(200).optional(),
  styleOptions: boardStyleSchema.optional(),
  photoMode: photoModeSchema.optional(),
});

// POST /api/boards/[boardId]/cards
export const createCardSchema = z.object({
  originalImageBase64: base64ImageString.optional(),
  label: z.string().max(200).optional(),
  // Admin-only: when true, the supplied label is used verbatim and the AI
  // label step is skipped (illustration still runs). Ignored for non-admins.
  skipLabeling: z.boolean().optional(),
  // Admin-only: when true, preserve the uploaded image as the card face and
  // skip AI illustration. Ignored for non-admins.
  skipIllustration: z.boolean().optional(),
  cropData: cropDataSchema.optional(),
});

// PATCH /api/boards/[boardId]/cards
export const updateCardSchema = z.object({
  cardId: z.string().uuid(),
  label: z.string().max(200).optional(),
  riddle: z.string().max(500).nullish(),
  illustrationBase64: base64ImageString.optional(),
  status: z.enum(['pending', 'processing', 'completed', 'error']).optional(),
  errorMessage: z.string().max(1000).optional(),
  cropData: cropDataSchema.nullish(),
});

// PUT /api/admin/cards/[cardId]/illustration (admin-only escape hatch)
export const replaceIllustrationSchema = z.object({
  // Require a base64 image data URL. The mime is intentionally permissive
  // (any `image/<type>`) — sharp is the real arbiter of what can be decoded —
  // but a payload with no data-URL prefix is a client error, so reject it as a
  // 400 here rather than letting it fall through to sharp and surface as a 500.
  illustrationBase64: base64ImageString.regex(
    /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
    'Must be a base64-encoded image data URL'
  ),
});

// POST /api/boards/[boardId]/cards/defaults
export const addDefaultCardsSchema = z.object({
  defaultCardIds: z.array(z.string().min(1)).min(1).max(54),
});

// PUT /api/boards/[boardId]/cards/order
export const reorderCardsSchema = z.object({
  cardIds: z.array(z.string().uuid()).max(200),
});

// PUT /api/admin/cards/[cardId]/label
export const adminCardLabelSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(200),
});

// PUT /api/admin/cards/[cardId]/riddle — an empty riddle clears it.
export const adminCardRiddleSchema = z.object({
  riddle: z.string().trim().max(500, 'Riddle must be 500 characters or fewer'),
});
