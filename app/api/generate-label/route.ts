import OpenAI from 'openai';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { generateLabelSchema } from '@/lib/validations';
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

    // Rate limit: 20 label generations per minute per user
    const rateLimitResult = rateLimit(`generate-label:${session.user.id}`, {
      limit: 20,
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
    const parsed = generateLabelSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { imageBase64 } = parsed.data;

    // Generate Spanish label for the card using GPT-4o Mini with vision
    const result = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert in Mexican culture and Loteria cards. Generate authentic Loteria-style labels in Spanish.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageBase64,
              },
            },
            {
              type: 'text',
              text: `Based on this image, generate a short Spanish word or phrase that would be perfect as a label for a Mexican Loteria card.

The label should be:
- 1-3 words maximum
- A noun or simple phrase
- Appropriate for a traditional Loteria card game
- In Spanish

Return ONLY the Spanish label, nothing else. Example labels: "El Diablo", "La Luna", "El Corazón"`,
            },
          ],
        },
      ],
      max_tokens: 50,
    });

    const label = result.choices[0].message.content?.trim() || '';

    return Response.json({
      label,
    });
  } catch (error) {
    console.error('Label generation error:', error);
    return Response.json({ error: 'Failed to generate label' }, { status: 500 });
  }
}
