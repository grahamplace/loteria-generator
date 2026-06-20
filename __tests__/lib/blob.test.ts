import { describe, it, expect, vi, beforeEach } from 'vitest';

const putMock = vi.hoisted(() => vi.fn());
vi.mock('@vercel/blob', () => ({
  put: (...args: unknown[]) => putMock(...args),
  del: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
}));

import { base64ToBuffer, getContentTypeFromDataUrl, uploadIllustration } from '@/lib/blob';

describe('uploadImage (via uploadIllustration)', () => {
  beforeEach(() => {
    putMock.mockReset();
    putMock.mockResolvedValue({ url: 'https://blob/illustration.png' });
  });

  // Card image paths are deterministic and meant to be replaced in place
  // (regenerate / admin replace). Without allowOverwrite, @vercel/blob v2
  // throws "This blob already exists" on the second upload to the same path.
  it('overwrites the existing blob at the deterministic path', async () => {
    await uploadIllustration('u1', 'b1', 'c1', Buffer.from('png'));
    expect(putMock).toHaveBeenCalledWith(
      'users/u1/boards/b1/cards/c1/illustration.png',
      expect.any(Buffer),
      expect.objectContaining({ addRandomSuffix: false, allowOverwrite: true })
    );
  });
});

describe('blob utilities', () => {
  describe('base64ToBuffer', () => {
    it('should convert base64 data URL to buffer', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
      const buffer = base64ToBuffer(dataUrl);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should handle raw base64 string without prefix', () => {
      const base64 = 'iVBORw0KGgo=';
      const buffer = base64ToBuffer(base64);
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should handle different image types', () => {
      const jpegDataUrl = 'data:image/jpeg;base64,/9j/4AAQSk=';
      const buffer = base64ToBuffer(jpegDataUrl);
      expect(buffer).toBeInstanceOf(Buffer);
    });
  });

  describe('getContentTypeFromDataUrl', () => {
    it('should extract PNG content type', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
      const contentType = getContentTypeFromDataUrl(dataUrl);
      expect(contentType).toBe('image/png');
    });

    it('should extract JPEG content type', () => {
      const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSk=';
      const contentType = getContentTypeFromDataUrl(dataUrl);
      expect(contentType).toBe('image/jpeg');
    });

    it('should extract WebP content type', () => {
      const dataUrl = 'data:image/webp;base64,UklGR=';
      const contentType = getContentTypeFromDataUrl(dataUrl);
      expect(contentType).toBe('image/webp');
    });

    it('should return default PNG for invalid data URL', () => {
      const invalidUrl = 'not-a-data-url';
      const contentType = getContentTypeFromDataUrl(invalidUrl);
      expect(contentType).toBe('image/png');
    });
  });
});
