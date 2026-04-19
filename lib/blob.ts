import { put, del, list, get } from '@vercel/blob';

const PRIVATE_BLOB_TOKEN = process.env.PRIVATE_READ_WRITE_TOKEN;

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
    access: 'private',
    contentType,
    addRandomSuffix: false, // Use exact path for predictable URLs
    token: PRIVATE_BLOB_TOKEN,
  });

  return blob.url;
}

/**
 * Get a private blob by URL, streaming its contents server-side
 */
export async function getPrivateBlob(url: string) {
  return get(url, { access: 'private', token: PRIVATE_BLOB_TOKEN });
}

/**
 * Fetch a private blob's bytes as a Buffer.
 */
export async function fetchBlobBuffer(url: string): Promise<Buffer> {
  const { buffer } = await fetchBlob(url);
  return buffer;
}

/**
 * Fetch a private blob with its content type. Use when downstream consumers
 * (e.g. OpenAI's image endpoints) require an accurate MIME label for the bytes.
 */
export async function fetchBlob(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const result = await getPrivateBlob(url);
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(`Failed to fetch blob at ${url}`);
  }
  const reader = result.stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return {
    buffer: Buffer.concat(chunks),
    contentType: result.blob?.contentType || 'image/png',
  };
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
 * List all blobs with a given prefix, handling pagination
 */
async function listAllBlobs(prefix: string) {
  const allBlobs: Awaited<ReturnType<typeof list>>['blobs'] = [];
  let cursor: string | undefined;

  do {
    const result = await list({ prefix, cursor });
    allBlobs.push(...result.blobs);
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);

  return allBlobs;
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
  const blobs = await listAllBlobs(prefix);
  await Promise.all(blobs.map((blob) => del(blob.url)));
}

/**
 * Delete all images for a board
 */
export async function deleteBoardImages(userId: string, boardId: string): Promise<void> {
  const prefix = `users/${userId}/boards/${boardId}/`;
  const blobs = await listAllBlobs(prefix);
  await Promise.all(blobs.map((blob) => del(blob.url)));
}

/**
 * Upload a board preview composite image
 */
export async function uploadBoardPreview(
  userId: string,
  boardId: string,
  file: Buffer
): Promise<string> {
  const path = `users/${userId}/boards/${boardId}/preview.png`;
  return uploadImage(file, path, 'image/png');
}

/**
 * Delete the cached board preview image
 */
export async function deleteBoardPreview(userId: string, boardId: string): Promise<void> {
  const prefix = `users/${userId}/boards/${boardId}/preview.png`;
  const blobs = await listAllBlobs(prefix);
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
