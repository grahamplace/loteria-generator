// __tests__/lib/resend.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

const sendMock = vi.fn();
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({ emails: { send: sendMock } })),
}));

import { sendEmail, isProductionEmailEnv } from '@/lib/email/resend';

const REAL = 'real@customer.com';
const REDIRECT = 'delivered@resend.dev';
const fakeReact = 'BODY' as unknown as ReactElement;

function baseArgs() {
  return { to: REAL, subject: 'Hello', react: fakeReact };
}

describe('sendEmail recipient redirect', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: 'msg_1' }, error: null });
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('EMAIL_FROM', 'Lotería <hola@example.com>');
  });

  it('redirects the recipient to the Resend test inbox outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('VERCEL_ENV', undefined);

    await sendEmail(baseArgs());

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0].to).toBe(REDIRECT);
  });

  it('redirects an array of recipients too (single test address)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    await sendEmail({ ...baseArgs(), to: ['a@x.com', 'b@y.com'] });
    expect(sendMock.mock.calls[0][0].to).toBe(REDIRECT);
  });

  it('sends to the real recipient in Vercel production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');

    await sendEmail(baseArgs());

    expect(sendMock.mock.calls[0][0].to).toBe(REAL);
  });

  it('redirects in Vercel preview even when NODE_ENV is production', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('NODE_ENV', 'production');

    await sendEmail(baseArgs());

    expect(sendMock.mock.calls[0][0].to).toBe(REDIRECT);
  });

  it('sends to the real recipient for a local production build (NODE_ENV=production, no VERCEL_ENV)', async () => {
    vi.stubEnv('VERCEL_ENV', undefined);
    vi.stubEnv('NODE_ENV', 'production');

    await sendEmail(baseArgs());

    expect(sendMock.mock.calls[0][0].to).toBe(REAL);
  });
});

describe('sendEmail behavior', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: 'msg_1' }, error: null });
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('EMAIL_FROM', 'Lotería <hola@example.com>');
    vi.stubEnv('VERCEL_ENV', 'production'); // pass-through so we can assert other fields
  });

  it('defaults `from` to EMAIL_FROM and forwards subject/react/headers', async () => {
    await sendEmail({ ...baseArgs(), headers: { 'List-Unsubscribe': '<x>' } });

    const args = sendMock.mock.calls[0][0];
    expect(args.from).toBe('Lotería <hola@example.com>');
    expect(args.subject).toBe('Hello');
    expect(args.react).toBe(fakeReact);
    expect(args.headers['List-Unsubscribe']).toBe('<x>');
  });

  it('uses an explicit `from` when provided', async () => {
    await sendEmail({ ...baseArgs(), from: 'Other <other@example.com>' });
    expect(sendMock.mock.calls[0][0].from).toBe('Other <other@example.com>');
  });

  it('returns the Resend message id on success', async () => {
    const result = await sendEmail(baseArgs());
    expect(result).toEqual({ id: 'msg_1' });
  });

  it('throws when Resend returns an error', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(sendEmail(baseArgs())).rejects.toThrow('Resend send failed: boom');
  });
});

describe('isProductionEmailEnv', () => {
  beforeEach(() => vi.unstubAllEnvs());

  it('is true only for Vercel production', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(isProductionEmailEnv()).toBe(true);
  });

  it('is false for Vercel preview regardless of NODE_ENV', () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('NODE_ENV', 'production');
    expect(isProductionEmailEnv()).toBe(false);
  });

  it('falls back to NODE_ENV when VERCEL_ENV is unset', () => {
    vi.stubEnv('VERCEL_ENV', undefined);
    vi.stubEnv('NODE_ENV', 'development');
    expect(isProductionEmailEnv()).toBe(false);
  });
});
