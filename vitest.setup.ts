/// <reference types="@testing-library/jest-dom" />

import { createElement } from 'react';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  useParams: () => ({}),
  usePathname: () => '',
}));

// Mock environment variables
vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
vi.stubEnv('NEXT_PUBLIC_SKIP_AI_PROCESSING', 'true');

// Mock next/image: vite resolves static image imports to URL strings, not the
// StaticImageData objects Next.js produces at build time, so the real Image
// component throws on `placeholder="blur"` (no `blurDataURL` field). Replace
// with a plain <img> for tests — they only assert on labels and structure.
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({
    src,
    alt,
    ...rest
  }: {
    src: string | { src: string };
    alt: string;
    [key: string]: unknown;
  }) => {
    const resolved = typeof src === 'string' ? src : src?.src;
    return createElement('img', { src: resolved, alt, ...filterImgProps(rest) });
  },
}));

function filterImgProps(props: Record<string, unknown>): Record<string, unknown> {
  const { fill, sizes, placeholder, blurDataURL, priority, ...rest } = props;
  void fill;
  void sizes;
  void placeholder;
  void blurDataURL;
  void priority;
  return rest;
}
