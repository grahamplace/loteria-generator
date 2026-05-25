import { z } from 'zod';

// Max base64 payload size: ~10MB decoded (base64 is ~33% larger than raw)
const MAX_BASE64_LENGTH = 14_000_000; // ~10MB decoded

const base64ImageString = z.string().max(MAX_BASE64_LENGTH, 'Image exceeds maximum size of 10MB');

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
});

// PATCH /api/boards/[boardId]/cards
export const updateCardSchema = z.object({
  cardId: z.string().uuid(),
  label: z.string().max(200).optional(),
  riddle: z.string().max(500).nullish(),
  illustrationBase64: base64ImageString.optional(),
  status: z.enum(['pending', 'processing', 'completed', 'error']).optional(),
  errorMessage: z.string().max(1000).optional(),
});

// POST /api/boards/[boardId]/cards/defaults
export const addDefaultCardsSchema = z.object({
  defaultCardIds: z.array(z.string().min(1)).min(1).max(54),
});
