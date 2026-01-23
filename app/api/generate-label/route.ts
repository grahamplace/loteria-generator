import OpenAI from 'openai';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

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

    const { imageBase64 } = await request.json();

    if (!imageBase64) {
      return Response.json({ error: 'No image provided' }, { status: 400 });
    }

    // Generate Spanish label for the card using GPT-4o Mini
    const result = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert in Mexican culture and Loteria cards. Generate authentic Loteria-style labels in Spanish.',
        },
        {
          role: 'user',
          content: `Based on this image, generate a short Spanish word or phrase that would be perfect as a label for a Mexican Loteria card. 
      
The label should be:
- 1-3 words maximum
- A noun or simple phrase
- Appropriate for a traditional Loteria card game
- In Spanish

Return ONLY the Spanish label, nothing else. Example labels: "El Diablo", "La Luna", "El Corazón"`,
        },
      ],
      max_completion_tokens: 50,
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
