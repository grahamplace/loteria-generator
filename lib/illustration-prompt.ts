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

/** Render the full illustration prompt with a specific solid background option. */
export function renderIllustrationPrompt(background: BackgroundColor): string {
  return `
    ## Instructions
    - Restyle the provided image into the **classic Mexican Lotería card illustration style**.
    - **Text-only images are the one exception to illustrating.** If the image is mostly or entirely text — a quote graphic, a text meme, a screenshot of a message or a poem — **the text itself is the subject**:
      - Render the main text, word for word and spelled exactly as written, as bold hand-lettered type in the same vintage Lotería print style (ink outlines, slightly irregular letterforms, aged-paper texture), centered and filling the card.
      - **Do not illustrate what the text says.** Add no people, objects, scenes, or symbols that aren't in the image. A quote about being sleepy stays words, not a drawing of a sleepy person.
      - Drop everything around the main text: usernames and handles, watermarks, logos, small footer or header text, app UI, and the original's background.
      - Place the lettering over a flat solid color field (see the background rules below). This rule overrides the "no typography" items in the negative prompt.
    - Keep the original subject, pose, and overall silhouette clearly recognizable, but **redraw everything as a vintage hand-painted print**.
    - Use **bold black ink outlines (no outline at the card edges, only around the main subject)** (slightly irregular, hand-drawn), simplified shapes, and **soft airbrush/watercolor gradients** for shading.
    - Reduce tiny details; prioritize clean, iconic readability from a distance — **except on faces, which are the one place detail must be preserved (see the likeness rule below)**.
    - **LIKENESS IS THE SINGLE MOST IMPORTANT REQUIREMENT OF THIS ILLUSTRATION. Any face in the photo must be illustrated EXTREMELY ACCURATELY.** The people depicted will judge this card by whether it looks like them, and they are the harshest possible judges of their own faces.
      - Reproduce each person's features exactly as they appear in the photo: face shape and proportions, eye shape, spacing and color, eyebrow shape and thickness, nose shape, mouth and lip shape, jawline, cheekbones, hairline, hair color, length, texture and part, facial hair, glasses, freckles, moles, dimples, scars, and any other distinguishing marks.
      - Keep the head angle, gaze direction, and facial expression from the photo. Keep each person's apparent age.
      - **Do not "improve" the face.** No idealizing, beautifying, slimming, smoothing, aging, or de-aging. Do not change apparent ethnicity, gender presentation, or body type. Skin tone must match the person in the photo — warmed slightly toward the vintage print palette, but never lightened or darkened.
      - When several people appear, each one keeps their own distinct likeness. Do not blend them toward a common face.
      - Render the face in the same Lotería language as the rest of the card (ink outline, flat blocking, limited tonal steps), but **never at the cost of resemblance**. Where simplification and likeness conflict, likeness wins — spend the extra lines and tonal steps on the face and simplify elsewhere.
      - The person in the photo should recognize themselves instantly. A beautiful card that looks like someone else is a failed card.
    - Add a subtle **aged paper texture** and light **ink grain/halftone speckling**, with a touch of **ink bleed** at edges.
    - **First decide whether the background carries meaning.** Ask: does the setting tell you what is happening in this photo? If the subject were lifted onto a blank field, would the story be lost?
      - **Background IS meaningful** — e.g. the wave and spray behind a wakeboarder, the mountains behind a hiking couple, the snow under a kid on a snowboard, the ocean behind a child on the beach. **Keep it and restyle it in the same Lotería style as the subject**: same bold ink outlines, same flat saturated color blocking, same limited tonal steps. Simplify it into a few iconic shapes — a stylized wave, a ridgeline of peaks, a band of surf — rather than reproducing every photographic detail. It is scenery reduced to an emblem, not a painted landscape.
      - **Background is NOT meaningful** — e.g. a kitchen behind a hug, a couch behind a toddler, a studio backdrop, a parked car, a blank wall. **Drop it entirely** and place the subject over one of the two classic Lotería backgrounds below.
      - When in doubt, drop it. A clean iconic card beats a cluttered one.
    - **When the background is dropped, who is on the card decides which of the two classic Lotería backgrounds to use:**
      - **No people or animals → solid color.** A single flat field of ${background.name} (${background.hex}) filling the whole card: no gradient, no horizon, no scenery. This covers food and dishes, products, tools, clothing, and collections of objects, **even when they were photographed on a table, counter, or floor — drop that surface too**. Think of how El Barril (the barrel) or La Bota (the boot) sit over a solid color on traditional cards.
      - **People or animals → sky.** The classic Lotería sky: ${SKY_GRADIENT.top.name} (${SKY_GRADIENT.top.hex}) at the top, fading smoothly to ${SKY_GRADIENT.bottom.name} (${SKY_GRADIENT.bottom.hex}) at the bottom of the card. **No floor, ground, stage, rug, or horizon line**: the figures stand directly on the gradient, which runs uninterrupted behind and below them. At most a faint, soft shadow under the feet.
      - Never put the sky behind an object card, and never put a solid color behind people or animals.
    - For a kept, meaningful background, restyle it in its natural colors (sky stays blue, water blue/green, fields green, snow white). ${background.name} (${background.hex}) may appear as an accent but must not recolor the scenery.
    - Color treatment should match classic Lotería: **high contrast, saturated primaries**, minimal neutral tones, and a slightly warm vintage print cast.
    - Lighting should feel illustrative (not photographic): soft highlights, gentle shadows, and limited tonal steps.
    - **Do not look like modern vector art**—it should feel like a mid-century printed card illustration.
    - **Do not add Loteria card elements to the illustrated (e.g. don't add a card number, a label, or a card border)**. We add them on top of the illustration later.

    ## Important:
    - DO NOT APPLY A BORDER. THE IMAGE SHOULD BE JUST THE ILLUSTRATION, NO BORDER, NO FRAME, NO PADDING, NO MATTE OR BACKDROP PANEL AROUND THE ILLUSTRATION. (This is about framing, not scenery — a meaningful background kept per the rule above still fills the whole image.)

    ## Colors
    **Main colors / palette guidance (use these as dominant colors):**
    - Solid background (no people or animals): ${background.name} (${background.hex})
    - Sky gradient (people or animals): ${SKY_GRADIENT.top.hex} → ${SKY_GRADIENT.bottom.hex}
    - Off-white / paper: #F3F2F2
    - Near-black ink (outlines): #1E1F25
    - Brick red / vintage crimson (accents): #962C2D and/or #5C282C
    - Dusty pink / mauve gradient (atmosphere, and the bottom of the sky gradient): #DAB5C9 / #CAA2AE
    - Deep green (foliage accents): #284D38
      - If browns/tans are needed (wood, leather), keep them warm and slightly muted (burnt umber / tan), not photorealistic. **Skin follows the likeness rule above** — match the person's actual tone, warmed slightly toward this palette, never lightened or darkened to fit it.

    ## Negative prompt (do not include these in the image; for a text-only image, the main text is required and is not "typography" here):
    photorealistic, 3D render, CGI, ultra-detailed texture, modern flat vector, crisp geometric logo style, anime, manga, glossy highlights, cinematic lighting, depth of field blur, HDR, heavy noise, neon palette, generic face, idealized or beautified face, symmetrical doll-like features, wrong person, altered facial features, changed skin tone, changed apparent age, blended or interchangeable faces, messy background, cluttered incidental background detail, photographic scenery pasted behind the subject, fake floor or ground band under people on a sky background, readable watermark, typography, captions, numbers, border, frame
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
  background: BackgroundColor = pickBackgroundColor()
): string {
  const base = renderIllustrationPrompt(background);
  const trimmed = overlay?.trim();
  if (!trimmed) return base;
  return `${base}

    ## Additional Instructions (admin overrides — follow these even where they conflict with the above)
    ${trimmed}
    `;
}
