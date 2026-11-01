// Type-only: the image eval loads this file from git refs on its own, so it
// must have no runtime imports.
import type { ImageCategory } from './image-category';

/** Image model for every card illustration: app jobs and example-image scripts. */
export const ILLUSTRATION_MODEL = 'gpt-image-2';

export type BackgroundColor = {
  /** Human-readable name rendered into the prompt instruction. */
  name: string;
  /** Hex value rendered into the prompt instruction. */
  hex: string;
};

/**
 * Solid background color options for card illustrations. We pick one at random
 * per card (see {@link pickBackgroundColor}) and render it into the prompt, so
 * boards get the varied yellow / blue / pink mix of classic Lotería boards
 * instead of the model defaulting to blue every time.
 *
 * The solid color is one of two backgrounds used when the photo's own setting
 * is incidental: a flat field of this color when there are no people or
 * animals (objects, food, products — like El Barril or La Bota), or the fixed
 * {@link SKY_GRADIENT} when there are. Settings that carry the story (a wave, a mountain range) are kept and
 * restyled instead. See the background rules in {@link renderIllustrationPrompt}.
 */
export const BACKGROUND_COLORS: readonly BackgroundColor[] = [
  { name: 'pale lemon yellow', hex: '#F5EDA0' },
  { name: 'sky blue', hex: '#5F94D6' },
  { name: 'dusty rose / mauve pink', hex: '#DAB5C9' },
];

/**
 * The classic Lotería "sky": blue at the top fading to dusty pink at the
 * bottom of the card, with no floor or horizon. Fixed rather than random.
 */
export const SKY_GRADIENT = {
  top: BACKGROUND_COLORS[1], // sky blue
  bottom: { name: 'dusty pink', hex: '#DAB5C9' },
} as const satisfies { top: BackgroundColor; bottom: BackgroundColor };

/** Background used for the static {@link ILLUSTRATION_PROMPT} export (dev scripts). */
const DEFAULT_BACKGROUND = BACKGROUND_COLORS[1]; // sky blue — the historical default

/** Randomly select one background color from {@link BACKGROUND_COLORS}. */
export function pickBackgroundColor(): BackgroundColor {
  return BACKGROUND_COLORS[Math.floor(Math.random() * BACKGROUND_COLORS.length)];
}

const LIKENESS_RULES = `
    - **LIKENESS IS THE SINGLE MOST IMPORTANT REQUIREMENT OF THIS ILLUSTRATION. Any face in the photo must be illustrated EXTREMELY ACCURATELY.** The people depicted will judge this card by whether it looks like them, and they are the harshest possible judges of their own faces.
      - Reproduce each person's features exactly as they appear in the photo: face shape and proportions, eye shape, spacing and color, eyebrow shape and thickness, nose shape, mouth and lip shape, jawline, cheekbones, hairline, hair color, length, texture and part, facial hair, glasses, freckles, moles, dimples, scars, and any other distinguishing marks.
      - Keep the head angle, gaze direction, and facial expression from the photo. Keep each person's apparent age.
      - **Do not "improve" the face.** No idealizing, beautifying, slimming, smoothing, aging, or de-aging. Do not change apparent ethnicity, gender presentation, or body type. Skin tone must match the person in the photo — warmed slightly toward the vintage print palette, but never lightened or darkened.
      - When several people appear, each one keeps their own distinct likeness. Do not blend them toward a common face.
      - Render the face in the same Lotería language as the rest of the card (ink outline, flat blocking, limited tonal steps), but **never at the cost of resemblance**. Where simplification and likeness conflict, likeness wins — spend the extra lines and tonal steps on the face and simplify elsewhere.
      - The person in the photo should recognize themselves instantly. A beautiful card that looks like someone else is a failed card.`;

const TEXT_ONLY_RULES = (intro: string) => `
    - ${intro}
      - Render the main text, word for word and spelled exactly as written, as bold hand-lettered type in the same vintage Lotería print style (ink outlines, slightly irregular letterforms, aged-paper texture), centered and filling the card.
      - **Do not illustrate what the text says.** Add no people, objects, scenes, or symbols that aren't in the image. A quote about being sleepy stays words, not a drawing of a sleepy person.
      - Drop everything around the main text: usernames and handles, watermarks, logos, small footer or header text, app UI, and the original's background.
      - Place the lettering over a flat solid color field (see the background rules below). This rule overrides the "no typography" items in the negative prompt.`;

const solidColorRule = (background: BackgroundColor) =>
  `A single flat field of ${background.name} (${background.hex}) filling the whole card: no gradient, no horizon, no scenery.`;

const SKY_RULE = `The classic Lotería sky: ${SKY_GRADIENT.top.name} (${SKY_GRADIENT.top.hex}) at the top, fading smoothly to ${SKY_GRADIENT.bottom.name} (${SKY_GRADIENT.bottom.hex}) at the bottom of the card. **No floor, ground, stage, rug, or horizon line**: the figures stand directly on the gradient, which runs uninterrupted behind and below them. At most a faint, soft shadow under the feet.`;

const KEPT_SCENE_STYLE = `**Keep it and restyle it in the same Lotería style as the subject**: same bold ink outlines, same flat saturated color blocking, same limited tonal steps. Simplify it into a few iconic shapes — a stylized wave, a ridgeline of peaks, a band of surf — rather than reproducing every photographic detail. It is scenery reduced to an emblem, not a painted landscape.`;

const keptSceneColors = (background: BackgroundColor) =>
  `restyle it in **the colors it has in the source image** (sky stays blue, water blue/green, fields green, snow white, a cream wall stays cream, a wood counter stays wood). ${background.name} (${background.hex}) may appear as an accent but must not recolor the scenery. **The sky gradient and the solid background colors exist only for dropped backgrounds: never paint walls, ceilings, floors, counters, or building fronts in them.** The only sky in a kept scene is the real sky visible outdoors or through a window.`;

/** Background rules when no category is known: the model decides itself. */
const decideBackgroundRules = (background: BackgroundColor) => `
    - **First decide whether the background carries meaning.** Ask: does the setting tell you what is happening in this photo? If the subject were lifted onto a blank field, would the story be lost?
      - **Background IS meaningful** — e.g. the wave and spray behind a wakeboarder, the mountains behind a hiking couple, the snow under a kid on a snowboard, the ocean behind a child on the beach. ${KEPT_SCENE_STYLE}
      - **Background IS meaningful when the image is already a composed scene** — an illustration, cartoon, poster, or designed card where the setting was drawn on purpose: a living room with a TV and wall calendar, a storefront with signs, a street with landmarks, a stage with a marquee. Signs, readable text, landmarks, and props placed in the setting are part of the story. **Keep the whole scene**, including its walls, floor, and ground, and restyle it as above.
      - **Background is NOT meaningful** — e.g. a kitchen behind a hug in a snapshot, a couch behind a toddler, a studio backdrop, a parked car, a plain blank wall. **Drop it entirely** and place the subject over one of the two classic Lotería backgrounds below.
      - When in doubt about a casual photo, drop it. When in doubt about a composed scene, keep it.
      - **Never do half of each.** Either the kept scene fills the whole card edge to edge (walls, floor, and sky included), or it is dropped completely. Do not keep a few pieces of a scene (a window, a calendar, a TV, a sign) floating over the sky gradient or a solid color.
    - **When the background is dropped, who is on the card decides which of the two classic Lotería backgrounds to use:**
      - **No people or animals → solid color.** ${solidColorRule(background)} This covers food and dishes, products, tools, clothing, and collections of objects, **even when they were photographed on a table, counter, or floor — drop that surface too**. Think of how El Barril (the barrel) or La Bota (the boot) sit over a solid color on traditional cards.
      - **People or animals → sky.** ${SKY_RULE}
      - Never put the sky behind an object card, and never put a solid color behind people or animals.
    - For a kept, meaningful background, ${keptSceneColors(background)}`;

/** Background rules for a known category. */
function categoryBackgroundRules(category: ImageCategory, background: BackgroundColor): string {
  switch (category) {
    case 'text':
      return `
    - **Background:** ${solidColorRule(background)} Drop the original's background entirely.`;
    case 'object':
      return `
    - **This card is an object card.** Illustrate the object or objects in the image (food, a dish, a product, a tool, clothing, a group of things, or a logo) as the subject. Add no people or animals.
      - **Keep every main item.** A spread of dishes stays a spread of dishes and a table of games stays a group of games; drop only the surface under them, not the items on it.
      - **A brand logo stays recognizable:** keep its exact shape, colors, and lettering, drawn in the Lotería ink style. Its lettering is part of the object, not "typography" for the negative prompt.
    - **Background:** ${solidColorRule(background)} **Drop the table, counter, floor, or room they were photographed on.** Think of how El Barril (the barrel) or La Bota (the boot) sit over a solid color on traditional cards. Never use a sky or gradient.`;
    case 'subject':
      return `
    - **This card is about the people or animals in the image.** The place behind them does not matter.
    - **Background:** drop the photo's setting entirely (room, wall, yard, restaurant, backdrop) and place the figures on the classic sky. ${SKY_RULE} Keep anything they hold or wear; drop everything else around them.`;
    case 'scene':
      return `
    - **This card keeps its setting.** The place in the image tells the story, so the background is part of the subject: landmarks, scenery, buildings, rooms, storefronts, stages, signs, and props drawn into the setting all stay. ${KEPT_SCENE_STYLE}
      - **The kept scene fills the whole card edge to edge**, including walls, floor, ground, and sky. Do not lift the people or objects out onto a blank field, and do not keep a few pieces of the setting (a window, a calendar, a TV, a sign) floating over a gradient or a solid color.
      - Keep signs and text that carry the story (a storefront or club name, a street sign, a banner or headline the scene is about), spelled as in the image. Drop incidental text: advertising boards, sponsor logos, brand names on clothing or equipment, and watermarks.
    - **Colors of the setting:** ${keptSceneColors(background)}`;
  }
}

function paletteBackgroundLines(
  category: ImageCategory | null,
  background: BackgroundColor
): string {
  const solid = `- Solid background: ${background.name} (${background.hex})`;
  const sky = `- Sky gradient: ${SKY_GRADIENT.top.hex} → ${SKY_GRADIENT.bottom.hex}`;
  const scene = `- Setting: the source image's own colors, warmed slightly toward this palette.`;
  switch (category) {
    case 'text':
    case 'object':
      return solid;
    case 'subject':
      return sky;
    case 'scene':
      return scene;
    case null:
      return `- Solid background (no people or animals, background dropped): ${background.name} (${background.hex})
    - Sky gradient (people or animals, background dropped): ${SKY_GRADIENT.top.hex} → ${SKY_GRADIENT.bottom.hex}
    - Kept scene: the source image's own colors, warmed slightly toward this palette. Neither background above applies.`;
  }
}

const BASE_NEGATIVES =
  'photorealistic, 3D render, CGI, ultra-detailed texture, modern flat vector, crisp geometric logo style, anime, manga, glossy highlights, cinematic lighting, depth of field blur, HDR, heavy noise, neon palette';
const FACE_NEGATIVES =
  'generic face, idealized or beautified face, symmetrical doll-like features, wrong person, altered facial features, changed skin tone, changed apparent age, blended or interchangeable faces';
const FRAMING_NEGATIVES = 'readable watermark, typography, captions, numbers, border, frame';

function negativePrompt(category: ImageCategory | null): string {
  const extra: Record<ImageCategory | 'none', string[]> = {
    none: [
      FACE_NEGATIVES,
      'messy background, cluttered incidental background detail, photographic scenery pasted behind the subject, fake floor or ground band under people on a sky background, fragments of a room or street floating over the sky gradient, walls or building fronts painted in the blue-to-pink sky gradient',
    ],
    text: ['illustrations of what the text says, people, objects, scenery'],
    object: ['people, animals, sky, gradient background, table or floor surface under the object'],
    subject: [
      FACE_NEGATIVES,
      'room, wall, furniture, or scenery behind the figures, fake floor or ground band under people on a sky background',
    ],
    scene: [
      FACE_NEGATIVES,
      'subject lifted onto a blank background, fragments of a room or street floating over a gradient, walls or building fronts painted in the blue-to-pink sky gradient',
    ],
  };
  const heading =
    category === 'text' || category === null
      ? 'Negative prompt (do not include these in the image; for a text-only image, the main text is required and is not "typography" here):'
      : category === 'scene'
        ? 'Negative prompt (do not include these in the image; signs and text that are part of the setting are not "typography" here):'
        : category === 'object'
          ? 'Negative prompt (do not include these in the image; a logo\'s own lettering is not "typography" here):'
          : 'Negative prompt (do not include these in the image):';
  return `## ${heading}
    ${[BASE_NEGATIVES, ...extra[category ?? 'none'], FRAMING_NEGATIVES].join(', ')}`;
}

/**
 * Render the illustration prompt. With a category (from the image classifier,
 * see lib/image-category.ts) the prompt carries only that kind of card's
 * background rules; without one, the model decides the background itself.
 */
export function renderIllustrationPrompt(
  background: BackgroundColor,
  category: ImageCategory | null = null
): string {
  const hasFaces = category !== 'text' && category !== 'object';
  const textRules =
    category === 'text'
      ? TEXT_ONLY_RULES('**This card is a text card: the text itself is the subject.**')
      : category === null
        ? TEXT_ONLY_RULES(
            '**Text-only images are the one exception to illustrating.** If the image is mostly or entirely text — a quote graphic, a text meme, a screenshot of a message or a poem — **the text itself is the subject**:'
          )
        : '';
  return `
    ## Instructions
    - Restyle the provided image into the **classic Mexican Lotería card illustration style**.${textRules}
    - Keep the original subject, pose, and overall silhouette clearly recognizable, but **redraw everything as a vintage hand-painted print**.
    - Use **bold black ink outlines (no outline at the card edges, only around the main subject)** (slightly irregular, hand-drawn), simplified shapes, and **soft airbrush/watercolor gradients** for shading.
    - Reduce tiny details; prioritize clean, iconic readability from a distance${hasFaces ? ' — **except on faces, which are the one place detail must be preserved (see the likeness rule below)**' : ''}.${hasFaces ? LIKENESS_RULES : ''}
    - Add a subtle **aged paper texture** and light **ink grain/halftone speckling**, with a touch of **ink bleed** at edges.${category === null ? decideBackgroundRules(background) : categoryBackgroundRules(category, background)}
    - Color treatment should match classic Lotería: **high contrast, saturated primaries**, minimal neutral tones, and a slightly warm vintage print cast.
    - Lighting should feel illustrative (not photographic): soft highlights, gentle shadows, and limited tonal steps.
    - **Do not look like modern vector art**—it should feel like a mid-century printed card illustration.
    - **Do not add Loteria card elements to the illustrated (e.g. don't add a card number, a label, or a card border)**. We add them on top of the illustration later.

    ## Important:
    - DO NOT APPLY A BORDER. THE IMAGE SHOULD BE JUST THE ILLUSTRATION, NO BORDER, NO FRAME, NO PADDING, NO MATTE OR BACKDROP PANEL AROUND THE ILLUSTRATION. (This is about framing, not scenery — a meaningful background kept per the rule above still fills the whole image.)

    ## Colors
    **Main colors / palette guidance (use these as dominant colors):**
    ${paletteBackgroundLines(category, background)}
    - Off-white / paper: #F3F2F2
    - Near-black ink (outlines): #1E1F25
    - Brick red / vintage crimson (accents): #962C2D and/or #5C282C
    - Dusty pink / mauve (accents${category === null || category === 'subject' ? ', and the bottom of the sky gradient' : ''}): #DAB5C9 / #CAA2AE
    - Deep green (foliage accents): #284D38
      - If browns/tans are needed (wood, leather), keep them warm and slightly muted (burnt umber / tan), not photorealistic.${hasFaces ? " **Skin follows the likeness rule above** — match the person's actual tone, warmed slightly toward this palette, never lightened or darkened to fit it." : ''}

    ${negativePrompt(category)}
    `;
}

/**
 * A static prompt rendered with the default background. Used by dev/example
 * scripts that want a deterministic prompt. Production card generation should
 * call {@link buildIllustrationPrompt} so each card gets a random background.
 */
export const ILLUSTRATION_PROMPT = renderIllustrationPrompt(DEFAULT_BACKGROUND);

export function buildIllustrationPrompt(
  overlay?: string | null,
  background: BackgroundColor = pickBackgroundColor(),
  category: ImageCategory | null = null
): string {
  const base = renderIllustrationPrompt(background, category);
  const trimmed = overlay?.trim();
  if (!trimmed) return base;
  return `${base}

    ## Additional Instructions for this card (follow these even where they conflict with the above)
    If these instructions ask for any part of a setting (a room, wall, street, storefront, sign, or landscape), treat the background as meaningful: keep the full scene filling the card edge to edge, not the classic Lotería background.
    ${trimmed}
    `;
}
