import { z } from 'zod';

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
});

// PATCH /api/boards/[boardId]
export const updateBoardSchema = z.object({
  name: z.string().max(200).optional(),
  styleOptions: z
    .object({
      backgroundColor: z.string().max(50).optional(),
      badgeColor: z.string().max(50).optional(),
      labelColor: z.string().max(50).optional(),
    })
    .optional(),
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
  illustrationBase64: base64ImageString,
});

// POST /api/boards/[boardId]/cards/defaults
export const addDefaultCardsSchema = z.object({
  defaultCardIds: z.array(z.string().min(1)).min(1).max(54),
});
