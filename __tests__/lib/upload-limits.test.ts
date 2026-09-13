import { describe, it, expect } from 'vitest';
import {
  partitionBySize,
  describeUploadFailure,
  requestBodyLimitError,
  MAX_UPLOAD_BYTES,
  MAX_REQUEST_BODY_BYTES,
  MAX_REQUEST_BODY_DISPLAY,
} from '@/lib/upload-limits';

const file = (name: string, size: number) => ({ name, size });

describe('partitionBySize', () => {
  it('keeps files at or under the limit and flags those over it', () => {
    const small = file('small.jpg', 500);
    const exact = file('exact.jpg', 100);
    const big = file('big.png', 2000);

    const { valid, oversized } = partitionBySize([small, exact, big], 1000);

    expect(valid).toEqual([small, exact]);
    expect(oversized).toEqual([big]);
  });

  it('treats a file exactly at the limit as valid', () => {
    const { valid, oversized } = partitionBySize([file('edge.jpg', 1000)], 1000);
    expect(valid).toHaveLength(1);
    expect(oversized).toHaveLength(0);
  });

  it('preserves original order within each bucket', () => {
    const a = file('a', 10);
    const b = file('b', 999);
    const c = file('c', 5);
    const d = file('d', 1000);

    const { valid, oversized } = partitionBySize([a, b, c, d], 100);

    expect(valid).toEqual([a, c]);
    expect(oversized).toEqual([b, d]);
  });

  it('returns empty buckets for an empty input', () => {
    expect(partitionBySize([], 100)).toEqual({ valid: [], oversized: [] });
  });

  it('defaults to the platform-safe upload limit', () => {
    const underLimit = file('ok.jpg', MAX_UPLOAD_BYTES);
    const overLimit = file('huge.jpg', MAX_UPLOAD_BYTES + 1);

    const { valid, oversized } = partitionBySize([underLimit, overLimit]);

    expect(valid).toEqual([underLimit]);
    expect(oversized).toEqual([overLimit]);
  });
});

describe('requestBodyLimitError', () => {
  it('returns null for a body at or under the platform limit', () => {
    expect(requestBodyLimitError(1000)).toBeNull();
    expect(requestBodyLimitError(MAX_REQUEST_BODY_BYTES)).toBeNull();
  });

  it('names the actual size and the limit for an oversized body', () => {
    const message = requestBodyLimitError(5_000_000);
    expect(message).toMatch(/too large/i);
    expect(message).toContain('5.0MB');
    expect(message).toContain(MAX_REQUEST_BODY_DISPLAY);
  });
});

describe('describeUploadFailure', () => {
  it('explains a 413 from the platform as a size problem', () => {
    const message = describeUploadFailure(413, null);
    expect(message).toMatch(/too large/i);
    expect(message).toContain(MAX_REQUEST_BODY_DISPLAY);
  });

  it('surfaces the image field error from a validation failure', () => {
    const body = {
      error: 'Invalid request',
      details: { fieldErrors: { originalImageBase64: ['Image exceeds maximum size of 10MB'] } },
    };
    expect(describeUploadFailure(400, body)).toBe('Image exceeds maximum size of 10MB');
  });

  it('prefers the human-readable message over the error code', () => {
    const body = { error: 'Card limit reached', message: 'Maximum of 54 cards allowed' };
    expect(describeUploadFailure(403, body)).toBe('Maximum of 54 cards allowed');
  });

  it('falls back to the error field', () => {
    expect(describeUploadFailure(404, { error: 'Board not found' })).toBe('Board not found');
  });

  it('falls back to the HTTP status when the body has nothing useful', () => {
    expect(describeUploadFailure(502, 'Bad Gateway')).toBe('Upload failed (HTTP 502)');
  });
});
