// __tests__/emails/no-board-nudge.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { NoBoardNudgeEmail, noBoardNudgeSubject } from '@/emails/no-board-nudge';
import { NO_BOARD_DISCOUNT_PERCENT, NO_BOARD_EXPIRY_DAYS } from '@/lib/constants';

const baseProps = {
  discountCode: 'LOTERIA-7KQ2M9',
  redeemUrl: 'https://example.com/redeem?code=LOTERIA-7KQ2M9',
  unsubscribeUrl: 'https://example.com/unsubscribe?token=tok123&lang=en',
  appUrl: 'https://example.com',
};

function renderEn(name = 'Ana') {
  return render(NoBoardNudgeEmail({ name, locale: 'en', ...baseProps }));
}

describe('NoBoardNudgeEmail', () => {
  it('greets with only the first name when given a full name', async () => {
    const html = await render(
      NoBoardNudgeEmail({ name: 'Ana Maria Garcia', locale: 'en', ...baseProps })
    );
    expect(html).toContain('Hi Ana,');
    expect(html).not.toContain('Ana Maria Garcia');
  });

  it('renders the discount code and the redeemUrl in the CTA', async () => {
    const html = await renderEn();
    expect(html).toContain('LOTERIA-7KQ2M9');
    expect(html).toContain('https://example.com/redeem?code=LOTERIA-7KQ2M9');
  });

  it('states the discount percent and expiry from constants, not hardcoded copy', async () => {
    const html = await renderEn();
    expect(html).toContain(`${NO_BOARD_DISCOUNT_PERCENT}%`);
    expect(html).toContain(`${NO_BOARD_EXPIRY_DAYS} days`);
  });

  it('invites a reply — the copy promises a human, so the send path must set reply-to', async () => {
    const html = await renderEn();
    expect(html).toContain('reply to this email');
  });

  it('renders the unsubscribeUrl in the footer', async () => {
    const html = await renderEn();
    expect(html).toContain('unsubscribe?token=tok123');
  });

  it('renders the wordmark and process images with absolute URLs built from appUrl', async () => {
    const html = await renderEn();
    expect(html).toContain('https://example.com/email/wordmark.png');
    expect(html).toContain('https://example.com/email/loteria-process.png');
  });

  it('renders ES copy when locale is es', async () => {
    const html = await render(NoBoardNudgeEmail({ name: 'Ana', locale: 'es', ...baseProps }));
    expect(html).toContain('Hola Ana,');
    expect(html.toLowerCase()).toContain('descuento');
    expect(html).not.toContain('Hi Ana,');
  });

  it('falls back to EN copy for an unrecognized locale', async () => {
    const html = await render(
      // Locale is typed as 'en' | 'es', but it arrives from a nullable DB column
      // upstream — this guards the runtime fallback, not the type.
      NoBoardNudgeEmail({ name: 'Ana', locale: 'fr' as 'en', ...baseProps })
    );
    expect(html).toContain('Hi Ana,');
  });

  it('noBoardNudgeSubject returns distinct en/es strings', () => {
    const en = noBoardNudgeSubject('en');
    const es = noBoardNudgeSubject('es');
    expect(en).not.toBe(es);
    expect(en).toBe('Ready to Make Your Own Lotería?');
    expect(es).toContain('Lotería');
  });
});
