import { describe, it, expect } from 'vitest';
import { isSupportedUploadMime, UPLOAD_IMAGE_ACCEPT } from '@/lib/image-formats';

describe('isSupportedUploadMime', () => {
  it.each(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/avif'])(
    'accepts %s',
    (mime) => expect(isSupportedUploadMime(mime)).toBe(true)
  );

  it.each(['image/heic', 'image/heif', 'image/tiff', 'image/bmp', 'image/svg+xml', 'text/plain'])(
    'rejects %s',
    (mime) => expect(isSupportedUploadMime(mime)).toBe(false)
  );
});

describe('UPLOAD_IMAGE_ACCEPT', () => {
  it('lists AVIF but not HEIC, which is converted to JPEG before upload', () => {
    expect(UPLOAD_IMAGE_ACCEPT).toContain('image/avif');
    expect(UPLOAD_IMAGE_ACCEPT).not.toContain('heic');
  });
});
