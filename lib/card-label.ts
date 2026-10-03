import { z } from 'zod';
import type { ResponseFormatJSONSchema } from 'openai/resources/shared';

// Classic Lotería names top out around 12 characters and 2 words ("La
// Escalera"); these limits leave headroom while rejecting the model's
// occasional leaked reasoning ("el.. wait, no I need a label in spanish").
export const MAX_AI_LABEL_LENGTH = 30;
export const MAX_AI_LABEL_WORDS = 4;

const aiLabelSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_AI_LABEL_LENGTH)
  // Letters (incl. accents), digits, and single-line spaces, hyphens, apostrophes.
  .regex(/^[\p{L}\p{N}][\p{L}\p{M}\p{N}' -]*$/u)
  .refine((label) => label.split(/\s+/).length <= MAX_AI_LABEL_WORDS);

const aiLabelResponseSchema = z.object({ label: aiLabelSchema });

/**
 * Structured-output schema for the label model. Length limits aren't
 * expressed here (strict mode doesn't support maxLength); they're enforced by
 * parseLabelResponse.
 */
export const LABEL_RESPONSE_FORMAT: ResponseFormatJSONSchema = {
  type: 'json_schema',
  json_schema: {
    name: 'loteria_label',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description: 'The Spanish Lotería card label, 1-3 words, e.g. "La Luna"',
        },
      },
      required: ['label'],
      additionalProperties: false,
    },
  },
};

/** Returns the validated label, or null if the model output doesn't conform. */
export function parseLabelResponse(content: string | null | undefined): string | null {
  if (!content) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }
  const result = aiLabelResponseSchema.safeParse(parsed);
  return result.success ? result.data.label : null;
}
