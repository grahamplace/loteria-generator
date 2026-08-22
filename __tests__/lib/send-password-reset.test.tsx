// __tests__/lib/send-password-reset.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/email/resend', async () => {
  const actual = await vi.importActual<typeof import('@/lib/email/resend')>('@/lib/email/resend');
  return { ...actual, sendEmail: vi.fn() };
});

import { sendEmail } from '@/lib/email/resend';
import { sendPasswordResetEmail } from '@/lib/email/send-password-reset';
import { SUPPORT_REPLY_TO_EMAIL } from '@/lib/constants';

const EN_URL = 'https://example.com/api/auth/reset-password/tok123?callbackURL=%2Freset-password';
const ES_URL =
  'https://example.com/api/auth/reset-password/tok123?callbackURL=%2Fes%2Freset-password';

const baseParams = { to: 'user@example.com', name: 'Ana', url: EN_URL };

describe('sendPasswordResetEmail', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.mocked(sendEmail).mockReset();
    vi.mocked(sendEmail).mockResolvedValue({ id: 'msg_1' });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('sends to the requested address with the English subject', async () => {
    const result = await sendPasswordResetEmail(baseParams);
    expect(result).toEqual({ id: 'msg_1', skipped: false });
    const args = vi.mocked(sendEmail).mock.calls[0][0];
    expect(args.to).toBe('user@example.com');
    expect(args.subject).toContain('Reset your');
  });

  it('uses the Spanish subject when the callbackURL is under /es', async () => {
    await sendPasswordResetEmail({ ...baseParams, url: ES_URL });
    expect(vi.mocked(sendEmail).mock.calls[0][0].subject).toContain('Restablece');
  });

  it('sets reply-to so a stuck user can reach a human', async () => {
    await sendPasswordResetEmail(baseParams);
    expect(vi.mocked(sendEmail).mock.calls[0][0].replyTo).toBe(SUPPORT_REPLY_TO_EMAIL);
  });

  it('sets no List-Unsubscribe headers — it is transactional', async () => {
    await sendPasswordResetEmail(baseParams);
    const args = vi.mocked(sendEmail).mock.calls[0][0];
    expect(args.headers).toBeUndefined();
  });

  it('skips without throwing when RESEND_API_KEY is unset', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const result = await sendPasswordResetEmail(baseParams);
    expect(result).toEqual({ id: null, skipped: true });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('logs the reset url outside production so local testing can follow it', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    await sendPasswordResetEmail(baseParams);
    expect(info).toHaveBeenCalled();
    expect(info.mock.calls.flat().join(' ')).toContain(EN_URL);
  });

  it('never logs the reset url in production', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    await sendPasswordResetEmail(baseParams);
    expect(info).not.toHaveBeenCalled();
  });
});
