import OpenAI, { toFile } from 'openai';
import { eq, sql } from 'drizzle-orm';
import { db, boards, cards } from '@/db';
import { uploadIllustration, fetchBlob } from '@/lib/blob';

export const OPENAI_IMAGE_MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
import { inngest } from '../client';
import { cardGenerateRequested } from '../events';
import { cardChannel } from '../channels';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

const LABEL_SYSTEM_PROMPT =
  'You are an expert in Mexican culture and Loteria cards. Generate authentic Loteria-style labels in Spanish.';

const LABEL_USER_PROMPT = `Based on this image, generate a short Spanish word or phrase that would be perfect as a label for a Mexican Loteria card.

The label should be:
- 1-3 words maximum
- A noun or simple phrase
- Appropriate for a traditional Loteria card game
- In Spanish

Return ONLY the Spanish label, nothing else. Example labels: "El Diablo", "La Luna", "El Corazón"`;

export const generateCardArtwork = inngest.createFunction(
  {
    id: 'generate-card-artwork',
    triggers: [cardGenerateRequested],
    concurrency: { key: 'event.data.userId', limit: 3 },
    throttle: { key: 'event.data.userId', limit: 10, period: '1m' },
    retries: 2,
    optimizeParallelism: true,
    onFailure: async ({ event, error, step }) => {
      const { cardId } = event.data.event.data as { cardId: string };
      const message = error.message || 'Failed to generate card artwork';

      await step.run('persist-error', async () => {
        await db
          .update(cards)
          .set({ status: 'error', errorMessage: message, updatedAt: new Date() })
          .where(eq(cards.id, cardId));
      });

      const ch = cardChannel({ cardId });
      await step.realtime.publish('error', ch.error, { message });
    },
  },
  async ({ event, step }) => {
    const { cardId, boardId, userId, originalImageUrl } = event.data;
    const ch = cardChannel({ cardId });

    // Each branch refetches the original image inside its own step so the raw
    // bytes never cross a step boundary. Inngest caps step output at ~4MB, and
    // a large base64 PNG would exceed that.
    const labelPromise = (async () => {
      const label = await step.run('generate-label', async () => {
        const { buffer, contentType } = await fetchBlob(originalImageUrl);
        const mime = OPENAI_IMAGE_MIME_TO_EXT[contentType] ? contentType : 'image/png';
        const base64 = buffer.toString('base64');
        const result = await openai.chat.completions.create({
          model: 'gpt-5-nano-2025-08-07',
          messages: [
            { role: 'system', content: LABEL_SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: `data:${mime};base64,${base64}` },
                },
                { type: 'text', text: LABEL_USER_PROMPT },
              ],
            },
          ],
          max_completion_tokens: 500,
          reasoning_effort: 'minimal',
        });
        return result.choices[0].message.content?.trim() || '';
      });
      await step.realtime.publish('publish-label', ch.label, { label });
      return label;
    })();

    const illustrationPromise = (async () => {
      const illustrationUrl = await step.run('generate-and-upload-illustration', async () => {
        const { buffer, contentType } = await fetchBlob(originalImageUrl);
        const ext = OPENAI_IMAGE_MIME_TO_EXT[contentType];
        if (!ext) {
          throw new Error(
            `Unsupported image format "${contentType}". Please upload PNG, JPEG, WebP, or GIF.`
          );
        }
        const imageFile = await toFile(buffer, `image.${ext}`, { type: contentType });
        const result = await openai.images.edit({
          model: process.env.NODE_ENV === 'production' ? 'gpt-image-1.5' : 'gpt-image-1-mini',
          image: imageFile,
          prompt: ILLUSTRATION_PROMPT,
          size: '1024x1536',
        });
        const b64 = result.data?.[0]?.b64_json;
        if (!b64) throw new Error('Failed to generate illustration');
        const illustrationBuffer = Buffer.from(b64, 'base64');
        return uploadIllustration(userId, boardId, cardId, illustrationBuffer);
      });
      await step.realtime.publish('publish-illustration', ch.illustration, { illustrationUrl });
      return illustrationUrl;
    })();

    const [label, illustrationUrl] = await Promise.all([labelPromise, illustrationPromise]);

    // neon-http has no transaction support; these two updates are run as
    // separate statements within the same step. Step-level retries are safe
    // because both updates are idempotent within this job (the card ends in
    // the same state), and Inngest won't fire retries for a step that already
    // succeeded.
    await step.run('persist-card', async () => {
      await db
        .update(cards)
        .set({
          label,
          illustrationUrl,
          status: 'completed',
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(cards.id, cardId));
    });

    await step.run('increment-generation-counter', async () => {
      await db
        .update(boards)
        .set({
          imageGenerationsUsed: sql`${boards.imageGenerationsUsed} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(boards.id, boardId));
    });

    await step.realtime.publish('completed', ch.completed, { label, illustrationUrl });

    return { cardId, label, illustrationUrl };
  }
);
