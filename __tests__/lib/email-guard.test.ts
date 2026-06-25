// __tests__/lib/email-guard.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { lifecycleEmailsEnabled } from '@/lib/email/guard';

const ORIG = { ...process.env };

describe('lifecycleEmailsEnabled', () => {
  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.LIFECYCLE_EMAILS_ENABLED;
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'test',
      configurable: true,
      writable: true,
      enumerable: true,
    });
  });
  afterEach(() => {
    process.env = { ...ORIG };
  });

  it('is false without an API key', () => {
    expect(lifecycleEmailsEnabled()).toBe(false);
  });

  it('is false with a key but not enabled and not production', () => {
    process.env.RESEND_API_KEY = 'x';
    expect(lifecycleEmailsEnabled()).toBe(false);
  });

  it('is true with a key + explicit enable flag', () => {
    process.env.RESEND_API_KEY = 'x';
    process.env.LIFECYCLE_EMAILS_ENABLED = 'true';
    expect(lifecycleEmailsEnabled()).toBe(true);
  });

  it('is true with a key in production', () => {
    process.env.RESEND_API_KEY = 'x';
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      configurable: true,
      writable: true,
      enumerable: true,
    });
    expect(lifecycleEmailsEnabled()).toBe(true);
  });
});
