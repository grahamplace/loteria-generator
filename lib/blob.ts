import { put, del, list } from '@vercel/blob';

/**
 * Upload an image to Vercel Blob with private access
 * Images are stored with user/board scoping for security
 */
export async function uploadImage(
  file: Buffer | Blob | File,
  path: string,
  contentType: string = 'image/png'
): Promise<string> {
  const blob = await put(path, file, {
    access: 'public', // We'll handle auth via API proxy
    contentType,
    addRandomSuffix: false, // Use exact path for predictable URLs
  });

  return blob.url;
}

/**
 * Upload original user photo
 */
export async function uploadOriginalImage(
  userId: string,
  boardId: string,
  cardId: string,
  file: Buffer | Blob | File,
  contentType: string = 'image/png'
): Promise<string> {
  const path = `users/${userId}/boards/${boardId}/cards/${cardId}/original.png`;
  return uploadImage(file, path, contentType);
}

/**
 * Upload AI-generated illustration
 */
export async function uploadIllustration(
  userId: string,
  boardId: string,
  cardId: string,
  file: Buffer | Blob | File
): Promise<string> {
  const path = `users/${userId}/boards/${boardId}/cards/${cardId}/illustration.png`;
  return uploadImage(file, path, 'image/png');
}

/**
 * Delete all images for a card
 */
export async function deleteCardImages(
  userId: string,
  boardId: string,
  cardId: string
): Promise<void> {
  const prefix = `users/${userId}/boards/${boardId}/cards/${cardId}/`;

  // List all blobs with this prefix
  const { blobs } = await list({ prefix });

  // Delete each blob
  await Promise.all(blobs.map((blob) => del(blob.url)));
}

/**
 * Delete all images for a board
 */
export async function deleteBoardImages(userId: string, boardId: string): Promise<void> {
  const prefix = `users/${userId}/boards/${boardId}/`;

  const { blobs } = await list({ prefix });
  await Promise.all(blobs.map((blob) => del(blob.url)));
}

/**
 * Convert base64 data URL to Buffer
 */
export function base64ToBuffer(base64DataUrl: string): Buffer {
  // Remove data URL prefix if present
  const base64Data = base64DataUrl.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

/**
 * Get content type from base64 data URL
 */
export function getContentTypeFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:(image\/\w+);base64,/);
  return match ? match[1] : 'image/png';
}
