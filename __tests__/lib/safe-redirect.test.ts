import { describe, it, expect } from 'vitest';
import { safeRedirectPath, DEFAULT_SAFE_REDIRECT } from '@/lib/safe-redirect';

describe('safeRedirectPath', () => {
  describe('accepts same-origin relative paths', () => {
    it.each([
      '/boards/abc',
      '/boards/abc?x=1',
      '/es/boards/abc',
      '/dashboard',
      '/boards/abc?x=1&y=2#cards',
      '/account',
    ])('returns %s unchanged', (path) => {
      expect(safeRedirectPath(path)).toBe(path);
    });

    it('trims surrounding whitespace', () => {
      expect(safeRedirectPath('  /boards/abc  ')).toBe('/boards/abc');
    });
  });

  describe('rejects absolute URLs', () => {
    it.each([
      'http://evil.example/phish',
      'https://evil.example/phish',
      'HTTPS://evil.example',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'mailto:someone@evil.example',
    ])('falls back for %s', (candidate) => {
      expect(safeRedirectPath(candidate)).toBe(DEFAULT_SAFE_REDIRECT);
    });
  });

  describe('rejects protocol-relative URLs', () => {
    it.each(['//evil.example', '//evil.example/boards/abc', '   //evil.example'])(
      'falls back for %s',
      (candidate) => {
        expect(safeRedirectPath(candidate)).toBe(DEFAULT_SAFE_REDIRECT);
      }
    );
  });

  describe('rejects backslash tricks', () => {
    it.each(['/\\evil.example', '/\\/evil.example', '\\\\evil.example', '/boards\\..\\..'])(
      'falls back for %s',
      (candidate) => {
        expect(safeRedirectPath(candidate)).toBe(DEFAULT_SAFE_REDIRECT);
      }
    );
  });

  describe('rejects anything not starting with a single /', () => {
    it.each(['boards/abc', 'evil.example', '?x=1', '#cards', ''])(
      'falls back for %s',
      (candidate) => {
        expect(safeRedirectPath(candidate)).toBe(DEFAULT_SAFE_REDIRECT);
      }
    );

    it('falls back for whitespace only', () => {
      expect(safeRedirectPath('   ')).toBe(DEFAULT_SAFE_REDIRECT);
    });
  });

  describe('rejects control characters', () => {
    it.each([
      '/boards/\u0000abc',
      '/boards/abc\nSet-Cookie: x=1',
      '/boards/abc\r\nLocation: https://evil.example',
      '/\tboards/abc',
      '/boards/abc\u007F',
    ])('falls back for a path with a control character', (candidate) => {
      expect(safeRedirectPath(candidate)).toBe(DEFAULT_SAFE_REDIRECT);
    });
  });

  describe('rejects missing values', () => {
    it.each([null, undefined])('falls back for %s', (candidate) => {
      expect(safeRedirectPath(candidate)).toBe(DEFAULT_SAFE_REDIRECT);
    });
  });

  it('uses the default fallback of /start', () => {
    expect(DEFAULT_SAFE_REDIRECT).toBe('/start');
    expect(safeRedirectPath('https://evil.example')).toBe('/start');
  });

  it('honours a custom fallback', () => {
    expect(safeRedirectPath('https://evil.example', '/dashboard')).toBe('/dashboard');
    expect(safeRedirectPath(null, '/es/start')).toBe('/es/start');
  });
});
