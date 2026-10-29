// __tests__/lib/send-signup-nudge.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/email/guard', () => ({
  lifecycleEmailsEnabled: vi.fn(),
}));

vi.mock('@/lib/email/unsubscribe', () => ({
  isMarketingUnsubscribed: vi.fn(),
}));

vi.mock('@/lib/email/resend', () => ({
  sendEmail: vi.fn(),
}));

import { lifecycleEmailsEnabled } from '@/lib/email/guard';
import { isMarketingUnsubscribed } from '@/lib/email/unsubscribe';
import { sendEmail } from '@/lib/email/resend';
import { sendSignupNudgeEmail } from '@/lib/email/send-signup-nudge';

const baseParams = {
  userId: 'user-123',
  to: 'user@example.com',
  name: 'Ana',
  locale: 'en' as const,
  discountCode: 'LOTERIA-ABC123',
  redeemUrl: 'https://example.com/redeem?code=LOTERIA-ABC123',
  unsubscribeUrl: 'https://example.com/unsubscribe?token=tok456&lang=en',
  unsubscribeOneClickUrl: 'https://example.com/api/unsubscribe?token=tok456',
  appUrl: 'https://example.com',
};

describe('sendSignupNudgeEmail', () => {
  beforeEach(() => {
    vi.mocked(lifecycleEmailsEnabled).mockReturnValue(true);
    vi.mocked(isMarketingUnsubscribed).mockResolvedValue(false);
    vi.mocked(sendEmail).mockReset();
    vi.mocked(sendEmail).mockResolvedValue({ id: 'msg_1' });
  });

  it('sends one-click unsubscribe headers', async () => {
    await sendSignupNudgeEmail(baseParams);
    const args = vi.mocked(sendEmail).mock.calls[0][0];
    expect(args.headers?.['List-Unsubscribe']).toBe(`<${baseParams.unsubscribeOneClickUrl}>`);
    expect(args.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('skips without sending when lifecycle email is disabled', async () => {
    vi.mocked(lifecycleEmailsEnabled).mockReturnValue(false);
    await expect(sendSignupNudgeEmail(baseParams)).resolves.toEqual({
      id: null,
      skipped: true,
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips an unsubscribed user', async () => {
    vi.mocked(isMarketingUnsubscribed).mockResolvedValue(true);
    await expect(sendSignupNudgeEmail(baseParams)).resolves.toEqual({
      id: null,
      skipped: true,
    });
    expect(isMarketingUnsubscribed).toHaveBeenCalledWith('user-123');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns the Resend message id on success', async () => {
    await expect(sendSignupNudgeEmail(baseParams)).resolves.toEqual({
      id: 'msg_1',
      skipped: false,
    });
  });
});
