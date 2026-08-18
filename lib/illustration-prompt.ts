export type BackgroundColor = {
  /** Human-readable name rendered into the prompt instruction. */
  name: string;
  /** Hex value rendered into the prompt instruction. */
  hex: string;
};

/**
 * Background color options for card illustrations. We pick one at random per
 * card (see {@link pickBackgroundColor}) and render an explicit instruction into
 * the prompt, so boards get the varied yellow / blue / white / pink mix of
 * classic Lotería boards instead of the model defaulting to blue every time.
 *
 * The color always applies, but how much of the card it covers depends on the
 * photo: cards whose setting carries the story (a wave, a mountain range) keep
 * that scenery restyled on top of this color, while cards with incidental
 * settings (a kitchen, a couch) drop it for a flat field. See the background
 * rules in {@link renderIllustrationPrompt}.
 */
export const BACKGROUND_COLORS: readonly BackgroundColor[] = [
  { name: 'pale lemon yellow', hex: '#F5EDA0' },
  { name: 'sky blue', hex: '#5F94D6' },
  { name: 'dusty rose / mauve pink', hex: '#DAB5C9' },
  { name: 'dusty pale orange', hex: '#F7B17E' },
];

/** Background used for the static {@link ILLUSTRATION_PROMPT} export (dev scripts). */
const DEFAULT_BACKGROUND = BACKGROUND_COLORS[1]; // sky blue — the historical default

/** Randomly select one background color from {@link BACKGROUND_COLORS}. */
export function pickBackgroundColor(): BackgroundColor {
  return BACKGROUND_COLORS[Math.floor(Math.random() * BACKGROUND_COLORS.length)];
}

/** Render the full illustration prompt for a specific background color. */
export function renderIllustrationPrompt(background: BackgroundColor): string {
  return `
    ## Instructions
    - Restyle the provided image into the **classic Mexican Lotería card illustration style**.
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
      - **Background is NOT meaningful** — e.g. a kitchen behind a hug, a couch behind a toddler, a studio backdrop, a parked car, a blank wall. **Drop it entirely** and place the subject over an abstract color field, exactly like a classic Lotería card.
      - When in doubt, drop it. A clean iconic card beats a cluttered one.
    - **This card's selected background color is ${background.name} (${background.hex}). Build the background around this color — do not default to blue.**
      - For images featuring "plain objects" (e.g. a trumpet, or a bowl of ramen), use ${background.name} (${background.hex}) as a flat background color field.
      - For a person or scene with no meaningful setting, use a soft sky/ground gradient tinted toward ${background.name} (${background.hex}).
      - For a kept, meaningful background, still tie it to ${background.name} (${background.hex}) — use it for the sky, water, or open field so the scenery reads as part of the same palette rather than a photograph pasted behind the subject.
    - Color treatment should match classic Lotería: **high contrast, saturated primaries**, minimal neutral tones, and a slightly warm vintage print cast.
    - Lighting should feel illustrative (not photographic): soft highlights, gentle shadows, and limited tonal steps.
    - **Do not look like modern vector art**—it should feel like a mid-century printed card illustration.
    - **Do not add Loteria card elements to the illustrated (e.g. don't add a card number, a label, or a card border)**. We add them on top of the illustration later.

    ## Important:
    - DO NOT APPLY A BORDER. THE IMAGE SHOULD BE JUST THE ILLUSTRATION, NO BORDER, NO FRAME, NO PADDING, NO MATTE OR BACKDROP PANEL AROUND THE ILLUSTRATION. (This is about framing, not scenery — a meaningful background kept per the rule above still fills the whole image.)

    ## Colors
    **Main colors / palette guidance (use these as dominant colors):**
    - Selected background color: ${background.name} (${background.hex})
    - Off-white / paper: #F3F2F2
    - Near-black ink (outlines): #1E1F25
    - Brick red / vintage crimson (accents): #962C2D and/or #5C282C
    - Dusty pink / mauve gradient (atmosphere/ground accents): #DAB5C9 / #CAA2AE
    - Deep green (foliage accents): #284D38
      - If browns/tans are needed (wood, leather), keep them warm and slightly muted (burnt umber / tan), not photorealistic. **Skin follows the likeness rule above** — match the person's actual tone, warmed slightly toward this palette, never lightened or darkened to fit it.

    ## Negative prompt (do not include these in the image):
    photorealistic, 3D render, CGI, ultra-detailed texture, modern flat vector, crisp geometric logo style, anime, manga, glossy highlights, cinematic lighting, depth of field blur, HDR, heavy noise, neon palette, generic face, idealized or beautified face, symmetrical doll-like features, wrong person, altered facial features, changed skin tone, changed apparent age, blended or interchangeable faces, messy background, cluttered incidental background detail, photographic scenery pasted behind the subject, readable watermark, typography, captions, numbers, border, frame
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
