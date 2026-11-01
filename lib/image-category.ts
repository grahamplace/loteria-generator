/**
 * Classifies an uploaded image before illustration, so the illustration call
 * gets a prompt for one kind of image instead of a decision tree it has to
 * apply itself. Pure definitions; the API call lives in image-category-ai.ts.
 */

export const IMAGE_CATEGORY_MODEL = 'gpt-6-luna';

export const IMAGE_CATEGORIES = ['text', 'object', 'subject', 'scene'] as const;
export type ImageCategory = (typeof IMAGE_CATEGORIES)[number];

export function isImageCategory(value: unknown): value is ImageCategory {
  return typeof value === 'string' && (IMAGE_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Pick `scene` at this probability even when another category scores higher.
 * Dropping a background that carried the story is the worse mistake; keeping
 * an incidental one only costs some clutter. Eval: the one close call
 * (scene 0.49 vs subject 0.51) was a scene; the closest true subject was 0.31.
 */
export const SCENE_MIN_PROBABILITY = 0.4;

/** Choose a category from the Decisions API's per-choice probabilities. */
export function pickImageCategory(
  probabilities: { value: unknown; probability: unknown }[]
): ImageCategory | null {
  const scored = probabilities.filter(
    (p): p is { value: ImageCategory; probability: number } =>
      isImageCategory(p.value) && typeof p.probability === 'number'
  );
  if (scored.length === 0) return null;
  const scene = scored.find((p) => p.value === 'scene');
  if (scene && scene.probability >= SCENE_MIN_PROBABILITY) return 'scene';
  return scored.reduce((best, p) => (p.probability > best.probability ? p : best)).value;
}

export const IMAGE_CATEGORY_INSTRUCTIONS =
  'This image will be redrawn as a single Lotería card illustration. Which kind of card should it become? Decide by what the card has to keep from the image.';

export const IMAGE_CATEGORY_CHOICES: { value: ImageCategory; description: string }[] = [
  {
    value: 'text',
    description:
      'The image is mostly or entirely words, and the words are the point: a quote graphic, a text meme, a screenshot of a message, a poem. Not a logo, not a poster with artwork, not a photo that happens to contain a sign.',
  },
  {
    value: 'object',
    description:
      'No person or animal is the subject. Food or a dish, a product, a tool, clothing, a collection of objects on a table, or a brand logo (the logo should stay recognizable). The table, floor, or room behind them does not matter.',
  },
  {
    value: 'subject',
    description:
      'One or more people or animals are the subject, and the place behind them does not matter: a living room, a plain wall, a backyard, a restaurant, a party, a studio backdrop. Lifting them onto a blank background would lose nothing important.',
  },
  {
    value: 'scene',
    description:
      'The setting carries the story and has to be kept. A landmark or a building; scenery such as mountains, a beach, the ocean, snow, or a stadium; a place that explains what is happening (flags at a citizenship ceremony, a cook in her kitchen, a person using a payphone, a news broadcast banner, a decorated Christmas tree that sets the occasion). Also any image that is already a composed illustration, poster, or designed card with signs, text, or props drawn into its setting.',
  },
];
