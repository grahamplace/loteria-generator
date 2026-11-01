import { safetyIdentifier } from '@/lib/openai-safety';
import { withAITrace } from '@/lib/ai-tracing';
import {
  IMAGE_CATEGORY_CHOICES,
  IMAGE_CATEGORY_INSTRUCTIONS,
  IMAGE_CATEGORY_MODEL,
  pickImageCategory,
  type ImageCategory,
} from '@/lib/image-category';

const CLASSIFY_ATTEMPTS = 2;
export const CLASSIFY_TIMEOUT_MS = 8_000;

type ClassifyMeta = { userId: string; boardId?: string; cardId?: string };

async function classifyOnce(imageDataUrl: string, userId: string): Promise<ImageCategory | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/decisions', {
      method: 'POST',
      signal: AbortSignal.timeout(CLASSIFY_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: IMAGE_CATEGORY_MODEL,
        ...safetyIdentifier(userId),
        input: [{ role: 'user', content: [{ type: 'input_image', image_url: imageDataUrl }] }],
        questions: [
          {
            type: 'choice',
            name: 'category',
            instructions: IMAGE_CATEGORY_INSTRUCTIONS,
            choices: IMAGE_CATEGORY_CHOICES,
          },
        ],
      }),
    });
    if (!res.ok) {
      console.warn('classify-image: attempt failed', { status: res.status });
      return null;
    }
    const json = (await res.json()) as {
      answers?: { probabilities?: { value: unknown; probability: unknown }[] }[];
    };
    return pickImageCategory(json.answers?.[0]?.probabilities ?? []);
  } catch (error) {
    console.warn('classify-image: attempt failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Returns the image's category, or null when the call fails (callers fall back). */
export async function classifyImage(
  imageDataUrl: string,
  meta: ClassifyMeta
): Promise<ImageCategory | null> {
  try {
    return await withAITrace(
      'classify-image',
      { ...meta, model: IMAGE_CATEGORY_MODEL },
      async () => {
        for (let attempt = 0; attempt < CLASSIFY_ATTEMPTS; attempt++) {
          const category = await classifyOnce(imageDataUrl, meta.userId);
          if (category) return category;
        }
        return null;
      }
    );
  } catch {
    return null;
  }
}
