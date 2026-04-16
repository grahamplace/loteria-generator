import OpenAI, { toFile } from 'openai';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db, boards, IMAGE_GENERATION_LIMIT_FREE, IMAGE_GENERATION_LIMIT_PAID } from '@/db';
import { eq, and, sql } from 'drizzle-orm';
import { generateImageSchema } from '@/lib/validations';
import { rateLimit } from '@/lib/rate-limit';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit: 10 image generations per minute per user
    const rateLimitResult = rateLimit(`generate-image:${session.user.id}`, {
      limit: 10,
      windowMs: 60_000,
    });

    if (!rateLimitResult.success) {
      return Response.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)),
          },
        }
      );
    }

    const body = await request.json();
    const parsed = generateImageSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { imageBase64, boardId } = parsed.data;

    // Get board and check ownership
    const board = await db.query.boards.findFirst({
      where: and(eq(boards.id, boardId), eq(boards.userId, session.user.id)),
    });

    if (!board) {
      return Response.json({ error: 'Board not found' }, { status: 404 });
    }

    // Check generation limit
    const limit = board.isUnlocked ? IMAGE_GENERATION_LIMIT_PAID : IMAGE_GENERATION_LIMIT_FREE;
    const remaining = limit - board.imageGenerationsUsed;

    if (remaining <= 0) {
      return Response.json(
        {
          error: 'Generation limit reached',
          message: board.isUnlocked
            ? `You've used all ${IMAGE_GENERATION_LIMIT_PAID} image generations for this board.`
            : `You've used all ${IMAGE_GENERATION_LIMIT_FREE} free image generations. Unlock this board for ${IMAGE_GENERATION_LIMIT_PAID} total generations.`,
          code: 'GENERATION_LIMIT_REACHED',
          limit,
          used: board.imageGenerationsUsed,
        },
        { status: 403 }
      );
    }

    // Extract base64 data (remove data URL prefix if present)
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    // Convert base64 string to Buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Convert Buffer to File using OpenAI's toFile helper
    // This is required because the SDK expects a File object, not a raw Buffer
    const imageFile = await toFile(imageBuffer, 'image.png', {
      type: 'image/png',
    });

    // Generate illustration using OpenAI's GPT Image model (gpt-image-1.5)
    // Use images.edit to provide the input image
    // GPT image models always return base64-encoded images
    const prompt = `
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

    const result = await openai.images.edit({
      model: 'gpt-image-1.5',
      image: imageFile,
      prompt: prompt,
      size: '1024x1536', // Portrait orientation to match traditional Lotería cards
    });

    // GPT image models always return base64-encoded images
    const imageBase64String = result.data?.[0]?.b64_json;

    if (!imageBase64String) {
      return Response.json(
        { error: 'Failed to generate image - no data returned' },
        { status: 500 }
      );
    }

    // Increment generation count
    await db
      .update(boards)
      .set({
        imageGenerationsUsed: sql`${boards.imageGenerationsUsed} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(boards.id, boardId));

    return Response.json({
      illustration: `data:image/png;base64,${imageBase64String}`,
      generationsRemaining: remaining - 1,
    });
  } catch (error) {
    console.error('Image generation error:', error);
    return Response.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
