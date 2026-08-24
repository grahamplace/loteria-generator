// __tests__/lib/send-campaign.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/email/guard', () => ({
  lifecycleEmailsEnabled: vi.fn(),
}));

vi.mock('@/lib/email/unsubscribe', () => ({
  isMarketingUnsubscribed: vi.fn(),
}));

// The send fn now delegates the actual Resend call to the central wrapper.
vi.mock('@/lib/email/resend', () => ({
  sendEmail: vi.fn(),
}));

const fakeSubject = vi.fn(() => 'SUBJECT');
const fakeRender = vi.fn(() => 'RENDERED');

vi.mock('@/lib/email/campaigns/registry', () => ({
  getCampaignTemplate: vi.fn((key: string) => {
    if (key === 'fake-template') {
      return { key: 'fake-template', label: 'Fake', subject: fakeSubject, render: fakeRender };
    }
    if (key === 'reply-template') {
      return {
        key: 'reply-template',
        label: 'Reply',
        subject: fakeSubject,
        render: fakeRender,
        replyTo: 'human@example.com',
      };
    }
    return undefined;
  }),
}));

import { lifecycleEmailsEnabled } from '@/lib/email/guard';
import { isMarketingUnsubscribed } from '@/lib/email/unsubscribe';
import { sendEmail } from '@/lib/email/resend';
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
  boardUrl: 'https://example.com/boards/board_1',
};

describe('sendCampaignEmail', () => {
  beforeEach(() => {
    vi.mocked(lifecycleEmailsEnabled).mockReset();
    vi.mocked(isMarketingUnsubscribed).mockReset();
    vi.mocked(sendEmail).mockReset();
    fakeSubject.mockClear();
    fakeRender.mockClear();
  });

  it('throws and does not send when templateKey is unknown', async () => {
    await expect(sendCampaignEmail({ ...baseParams, templateKey: 'unknown-key' })).rejects.toThrow(
      'Unknown campaign template: unknown-key'
    );
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('returns { id: null, skipped: true } and does not send when guard is disabled', async () => {
    vi.mocked(lifecycleEmailsEnabled).mockReturnValue(false);

    const result = await sendCampaignEmail(baseParams);

    expect(result).toEqual({ id: null, skipped: true });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(isMarketingUnsubscribed).not.toHaveBeenCalled();
  });

  it('returns { id: null, skipped: true } when user is unsubscribed', async () => {
    vi.mocked(lifecycleEmailsEnabled).mockReturnValue(true);
    vi.mocked(isMarketingUnsubscribed).mockResolvedValue(true);

    const result = await sendCampaignEmail(baseParams);

    expect(result).toEqual({ id: null, skipped: true });
    expect(isMarketingUnsubscribed).toHaveBeenCalledWith(baseParams.userId);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('calls sendEmail with the template subject/render and one-click header, returns { id, skipped: false }', async () => {
    vi.mocked(lifecycleEmailsEnabled).mockReturnValue(true);
    vi.mocked(isMarketingUnsubscribed).mockResolvedValue(false);
    vi.mocked(sendEmail).mockResolvedValue({ id: 'msg-abc' });

    const result = await sendCampaignEmail(baseParams);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(sendEmail).mock.calls[0][0];
    expect(callArgs.subject).toBe('SUBJECT');
    expect(callArgs.react).toBe('RENDERED');
    expect(callArgs.to).toBe(baseParams.to);
    expect(callArgs.headers?.['List-Unsubscribe']).toBe(`<${baseParams.unsubscribeOneClickUrl}>`);
    expect(callArgs.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(result).toEqual({ id: 'msg-abc', skipped: false });

    expect(fakeSubject).toHaveBeenCalledWith(baseParams.locale);
    expect(fakeRender).toHaveBeenCalledWith({
      name: baseParams.name,
      locale: baseParams.locale,
      appUrl: baseParams.appUrl,
      unsubscribeUrl: baseParams.unsubscribeUrl,
      discountCode: baseParams.discountCode,
      redeemUrl: baseParams.redeemUrl,
      boardUrl: baseParams.boardUrl,
    });
  });

  it('omits replyTo for a template that does not declare one', async () => {
    vi.mocked(lifecycleEmailsEnabled).mockReturnValue(true);
    vi.mocked(isMarketingUnsubscribed).mockResolvedValue(false);
    vi.mocked(sendEmail).mockResolvedValue({ id: 'msg-abc' });

    await sendCampaignEmail(baseParams);

    expect(vi.mocked(sendEmail).mock.calls[0][0]).not.toHaveProperty('replyTo');
  });

  it("passes the template's replyTo through so replies reach a human", async () => {
    vi.mocked(lifecycleEmailsEnabled).mockReturnValue(true);
    vi.mocked(isMarketingUnsubscribed).mockResolvedValue(false);
    vi.mocked(sendEmail).mockResolvedValue({ id: 'msg-abc' });

    await sendCampaignEmail({ ...baseParams, templateKey: 'reply-template' });

    expect(vi.mocked(sendEmail).mock.calls[0][0].replyTo).toBe('human@example.com');
  });

  it('propagates an error thrown by sendEmail', async () => {
    vi.mocked(lifecycleEmailsEnabled).mockReturnValue(true);
    vi.mocked(isMarketingUnsubscribed).mockResolvedValue(false);
    vi.mocked(sendEmail).mockRejectedValue(new Error('Resend send failed: Invalid API key'));

    await expect(sendCampaignEmail(baseParams)).rejects.toThrow(
      'Resend send failed: Invalid API key'
    );
  });
});
