// __tests__/lib/send-campaign.test.tsx
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

const fakeSubject = vi.fn(() => 'SUBJECT');
const fakeRender = vi.fn(() => 'RENDERED');

vi.mock('@/lib/email/campaigns/registry', () => ({
  getCampaignTemplate: vi.fn((key: string) => {
    if (key === 'fake-template') {
      return { key: 'fake-template', label: 'Fake', subject: fakeSubject, render: fakeRender };
    }
    return undefined;
  }),
}));

import { Resend } from 'resend';
import { lifecycleEmailsEnabled } from '@/lib/email/guard';
import { isMarketingUnsubscribed } from '@/lib/email/unsubscribe';
import { getCampaignTemplate } from '@/lib/email/campaigns/registry';
import { sendCampaignEmail } from '@/lib/email/send-campaign';

const baseParams = {
  templateKey: 'fake-template',
  userId: 'user-123',
  to: 'user@example.com',
  name: 'Ana',
  locale: 'en' as const,
  appUrl: 'https://example.com',
  unsubscribeUrl: 'https://example.com/unsubscribe?token=tok456&lang=en',
  unsubscribeOneClickUrl: 'https://example.com/api/unsubscribe?token=tok456',
  discountCode: 'FAKE-CODE',
  redeemUrl: 'https://example.com/redeem?code=FAKE-CODE',
};

function getMockSend() {
  const ResendMock = vi.mocked(Resend);
  const instance = ResendMock.mock.results[ResendMock.mock.results.length - 1]?.value;
  return instance?.emails.send as ReturnType<typeof vi.fn>;
}

describe('sendCampaignEmail', () => {
  beforeEach(() => {
    vi.mocked(lifecycleEmailsEnabled).mockReset();
    vi.mocked(isMarketingUnsubscribed).mockReset();
    vi.mocked(Resend).mockClear();
    fakeSubject.mockClear();
    fakeRender.mockClear();
    process.env.RESEND_API_KEY = 'test-key';
    process.env.EMAIL_FROM = 'hello@example.com';
  });

  it('throws and does not call Resend when templateKey is unknown', async () => {
    await expect(sendCampaignEmail({ ...baseParams, templateKey: 'unknown-key' })).rejects.toThrow(
      'Unknown campaign template: unknown-key'
    );

    expect(Resend).not.toHaveBeenCalled();
  });

  it('returns { id: null, skipped: true } and does not call Resend when guard is disabled', async () => {
    vi.mocked(lifecycleEmailsEnabled).mockReturnValue(false);

    const result = await sendCampaignEmail(baseParams);

    expect(result).toEqual({ id: null, skipped: true });
    expect(Resend).not.toHaveBeenCalled();
    expect(isMarketingUnsubscribed).not.toHaveBeenCalled();
  });

  it('returns { id: null, skipped: true } when user is unsubscribed', async () => {
    vi.mocked(lifecycleEmailsEnabled).mockReturnValue(true);
    vi.mocked(isMarketingUnsubscribed).mockResolvedValue(true);

    const result = await sendCampaignEmail(baseParams);

    expect(result).toEqual({ id: null, skipped: true });
    expect(isMarketingUnsubscribed).toHaveBeenCalledWith(baseParams.userId);
    expect(Resend).not.toHaveBeenCalled();
  });

  it('calls resend.emails.send with subject/render from template and one-click header, returns { id, skipped: false }', async () => {
    vi.mocked(lifecycleEmailsEnabled).mockReturnValue(true);
    vi.mocked(isMarketingUnsubscribed).mockResolvedValue(false);

    const mockSend = vi.fn().mockResolvedValue({ data: { id: 'msg-abc' }, error: null });
    vi.mocked(Resend).mockImplementationOnce(
      () => ({ emails: { send: mockSend } }) as unknown as InstanceType<typeof Resend>
    );

    const result = await sendCampaignEmail(baseParams);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.subject).toBe('SUBJECT');
    expect(callArgs.react).toBe('RENDERED');
    expect(callArgs.to).toEqual([baseParams.to]);
    expect(callArgs.from).toBe('hello@example.com');
    expect(callArgs.headers['List-Unsubscribe']).toBe(`<${baseParams.unsubscribeOneClickUrl}>`);
    expect(callArgs.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(result).toEqual({ id: 'msg-abc', skipped: false });

    // Template subject/render were called with correct args
    expect(fakeSubject).toHaveBeenCalledWith(baseParams.locale);
    expect(fakeRender).toHaveBeenCalledWith({
      name: baseParams.name,
      locale: baseParams.locale,
      appUrl: baseParams.appUrl,
      unsubscribeUrl: baseParams.unsubscribeUrl,
      discountCode: baseParams.discountCode,
      redeemUrl: baseParams.redeemUrl,
    });
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

    await expect(sendCampaignEmail(baseParams)).rejects.toThrow(
      'Resend send failed: Invalid API key'
    );
  });
});
