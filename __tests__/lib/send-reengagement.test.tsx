// __tests__/lib/send-reengagement.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock resend before importing the module under test
vi.mock('resend', () => {
  const mockSend = vi.fn();
  return {
    Resend: vi.fn().mockImplementation(() => ({
      emails: { send: mockSend },
    })),
  };
});

vi.mock('@/lib/email/guard', () => ({
  lifecycleEmailsEnabled: vi.fn(),
}));

vi.mock('@/lib/email/unsubscribe', () => ({
  isMarketingUnsubscribed: vi.fn(),
}));

vi.mock('@/emails/reengagement', () => ({
  ReengagementEmail: vi.fn().mockReturnValue(null),
  reengagementSubject: vi.fn().mockReturnValue('🎉 25% off — come back to Lotería Generator'),
}));

import { Resend } from 'resend';
import { lifecycleEmailsEnabled } from '@/lib/email/guard';
import { isMarketingUnsubscribed } from '@/lib/email/unsubscribe';
import { sendReengagementEmail } from '@/lib/email/send-reengagement';

const baseParams = {
  userId: 'user-123',
  to: 'user@example.com',
  name: 'Ana',
  locale: 'en' as const,
  discountCode: 'LOTERIA-ABC123',
  redeemUrl: 'https://example.com/redeem?code=LOTERIA-ABC123',
  unsubscribeUrl: 'https://example.com/unsubscribe?token=tok456&lang=en',
  unsubscribeOneClickUrl: 'https://example.com/api/unsubscribe?token=tok456',
};

function getMockSend() {
  // The Resend constructor is mocked; get the send fn from the last constructed instance
  const ResendMock = vi.mocked(Resend);
  const instance = ResendMock.mock.results[ResendMock.mock.results.length - 1]?.value;
  return instance?.emails.send as ReturnType<typeof vi.fn>;
}

describe('sendReengagementEmail', () => {
  beforeEach(() => {
    vi.mocked(lifecycleEmailsEnabled).mockReset();
    vi.mocked(isMarketingUnsubscribed).mockReset();
    vi.mocked(Resend).mockClear();
    process.env.RESEND_API_KEY = 'test-key';
    process.env.EMAIL_FROM = 'hello@example.com';
  });

  it('returns { id: null, skipped: true } and does not call Resend when guard is disabled', async () => {
    vi.mocked(lifecycleEmailsEnabled).mockReturnValue(false);

    const result = await sendReengagementEmail(baseParams);

    expect(result).toEqual({ id: null, skipped: true });
    expect(Resend).not.toHaveBeenCalled();
    expect(isMarketingUnsubscribed).not.toHaveBeenCalled();
  });

  it('returns { id: null, skipped: true } when user is unsubscribed', async () => {
    vi.mocked(lifecycleEmailsEnabled).mockReturnValue(true);
    vi.mocked(isMarketingUnsubscribed).mockResolvedValue(true);

    const result = await sendReengagementEmail(baseParams);

    expect(result).toEqual({ id: null, skipped: true });
    expect(isMarketingUnsubscribed).toHaveBeenCalledWith(baseParams.userId);
  });

  it('calls resend.emails.send with one-click header and returns { id, skipped: false } when enabled and subscribed', async () => {
    vi.mocked(lifecycleEmailsEnabled).mockReturnValue(true);
    vi.mocked(isMarketingUnsubscribed).mockResolvedValue(false);

    // Re-mock the Resend instance send for this test
    const mockSend = vi.fn().mockResolvedValue({ data: { id: 'msg-xyz' }, error: null });
    vi.mocked(Resend).mockImplementationOnce(
      () => ({ emails: { send: mockSend } }) as unknown as InstanceType<typeof Resend>
    );

    const result = await sendReengagementEmail(baseParams);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.headers['List-Unsubscribe']).toBe(`<${baseParams.unsubscribeOneClickUrl}>`);
    expect(callArgs.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(callArgs.to).toEqual([baseParams.to]);
    expect(result).toEqual({ id: 'msg-xyz', skipped: false });
  });

  it('throws an Error when Resend returns an error', async () => {
    vi.mocked(lifecycleEmailsEnabled).mockReturnValue(true);
    vi.mocked(isMarketingUnsubscribed).mockResolvedValue(false);

    const mockSend = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Invalid API key', name: 'validation_error' },
    });
    vi.mocked(Resend).mockImplementationOnce(
      () => ({ emails: { send: mockSend } }) as unknown as InstanceType<typeof Resend>
    );

    await expect(sendReengagementEmail(baseParams)).rejects.toThrow(
      'Resend send failed: Invalid API key'
    );
  });
});
