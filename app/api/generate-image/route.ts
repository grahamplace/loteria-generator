import OpenAI, { toFile } from 'openai';
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
    const result = await openai.images.edit({
      model: 'gpt-image-1.5',
      image: imageFile,
      prompt: `Turn this image into an illustration in the hand-drawn style of a loteria card (mexican bingo). DO NOT include a border around the image. DO NOT include a "loteria number" or a label on the card. ONLY generate a graphic illustration based on the image provided. Make it colorful and vibrant in the traditional Mexican Loteria style.`,
      size: '1024x1024',
    });

    // GPT image models always return base64-encoded images
    const imageBase64String = result.data?.[0]?.b64_json;

    if (!imageBase64String) {
      return Response.json(
        { error: 'Failed to generate image - no data returned' },
        { status: 500 }
      );
    }

    return Response.json({
      illustration: `data:image/png;base64,${imageBase64String}`,
    });
  } catch (error) {
    console.error('Image generation error:', error);
    return Response.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
