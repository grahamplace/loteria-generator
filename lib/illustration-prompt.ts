export const ILLUSTRATION_PROMPT = `
    ## Instructions
    - Restyle the provided image into the **classic Mexican Lotería card illustration style**.
    - Keep the original subject, pose, and overall silhouette clearly recognizable, but **redraw everything as a vintage hand-painted print**.
    - Use **bold black ink outlines (no outline at the card edges, only around the main subject)** (slightly irregular, hand-drawn), simplified shapes, and **soft airbrush/watercolor gradients** for shading.
    - Reduce tiny details; prioritize clean, iconic readability from a distance.
    - Add a subtle **aged paper texture** and light **ink grain/halftone speckling**, with a touch of **ink bleed** at edges.
    - Background should be **simple and graphic**: either a flat color field or a minimal sky/ground gradient, no complex scenery.
      - For images featuring "plain objects" (e.g. a trumpet, or a bowl of ramen), use a simple background color (see colors section below).
      - For images featuring a person or a more complex scene, use a sky/ground gradient.
    - Color treatment should match classic Lotería: **high contrast, saturated primaries**, minimal neutral tones, and a slightly warm vintage print cast.
    - Lighting should feel illustrative (not photographic): soft highlights, gentle shadows, and limited tonal steps.
    - **Do not look like modern vector art**—it should feel like a mid-century printed card illustration.
    - **No text, no numbers, no border—only the illustration** in Lotería style.

    ## Important:
    - DO NOT APPLY A BORDER. THE IMAGE SHOULD BE JUST THE ILLUSTRATION, NO BORDER, NO FRAME, NO BACKGROUND, NO PADDING, NO TEXT, NO NUMBER.

    ## Colors
    **Main colors / palette guidance (use these as dominant colors):**
    - Off-white / paper: #F3F2F2
    - Sky blue (background option 1): #5F94D6
    - Lemon yellow (background option 2): #F4EC5F
    - Cobalt / primary blue (background option 3): #3176CF
    - Deep muted blue: #2F67A8
    - Near-black ink (outlines): #1E1F25
    - Brick red / vintage crimson (accents): #962C2D and/or #5C282C
    - Dusty pink / mauve gradient (atmosphere/ground accents): #DAB5C9 / #CAA2AE
    - Deep green (foliage accents): #284D38
      - If browns/tans are needed (wood, skin, leather), keep them warm and slightly muted (burnt umber / tan), not photorealistic.

    ## Negative prompt (do not include these in the image):
    photorealistic, 3D render, CGI, ultra-detailed texture, modern flat vector, crisp geometric logo style, anime, manga, glossy highlights, cinematic lighting, depth of field blur, HDR, heavy noise, neon palette, messy background, complex scenery, readable watermark, typography, captions, numbers, border, frame
    `;
