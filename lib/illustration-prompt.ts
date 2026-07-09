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
 */
export const BACKGROUND_COLORS: readonly BackgroundColor[] = [
  { name: 'pale lemon yellow', hex: '#F5EDA0' },
  { name: 'sky blue', hex: '#5F94D6' },
  { name: 'dusty rose / mauve pink', hex: '#DAB5C9' },
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
    - Reduce tiny details; prioritize clean, iconic readability from a distance.
    - Add a subtle **aged paper texture** and light **ink grain/halftone speckling**, with a touch of **ink bleed** at edges.
    - Background should be **simple and graphic**: either a flat color field or a minimal sky/ground gradient, no complex scenery.
      - **This card's selected background color is ${background.name} (${background.hex}). Build the background around this color — do not default to blue.**
      - For images featuring "plain objects" (e.g. a trumpet, or a bowl of ramen), use ${background.name} (${background.hex}) as a flat background color field.
      - For images featuring a person or a more complex scene, use a soft sky/ground gradient tinted toward ${background.name} (${background.hex}).
    - Color treatment should match classic Lotería: **high contrast, saturated primaries**, minimal neutral tones, and a slightly warm vintage print cast.
    - Lighting should feel illustrative (not photographic): soft highlights, gentle shadows, and limited tonal steps.
    - **Do not look like modern vector art**—it should feel like a mid-century printed card illustration.
    - **Do not add Loteria card elements to the illustrated (e.g. don't add a card number, a label, or a card border)**. We add them on top of the illustration later.

    ## Important:
    - DO NOT APPLY A BORDER. THE IMAGE SHOULD BE JUST THE ILLUSTRATION, NO BORDER, NO FRAME, NO BACKGROUND, NO PADDING.

    ## Colors
    **Main colors / palette guidance (use these as dominant colors):**
    - Selected background color: ${background.name} (${background.hex})
    - Off-white / paper: #F3F2F2
    - Near-black ink (outlines): #1E1F25
    - Brick red / vintage crimson (accents): #962C2D and/or #5C282C
    - Dusty pink / mauve gradient (atmosphere/ground accents): #DAB5C9 / #CAA2AE
    - Deep green (foliage accents): #284D38
      - If browns/tans are needed (wood, skin, leather), keep them warm and slightly muted (burnt umber / tan), not photorealistic.

    ## Negative prompt (do not include these in the image):
    photorealistic, 3D render, CGI, ultra-detailed texture, modern flat vector, crisp geometric logo style, anime, manga, glossy highlights, cinematic lighting, depth of field blur, HDR, heavy noise, neon palette, messy background, complex scenery, readable watermark, typography, captions, numbers, border, frame
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
