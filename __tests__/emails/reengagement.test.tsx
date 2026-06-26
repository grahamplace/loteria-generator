// __tests__/emails/reengagement.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { ReengagementEmail, reengagementSubject } from '@/emails/reengagement';

const baseProps = {
  discountCode: 'LOTERIA-7KQ2M9',
  redeemUrl: 'https://example.com/redeem?code=LOTERIA-7KQ2M9',
  unsubscribeUrl: 'https://example.com/unsubscribe?token=tok123&lang=en',
  appUrl: 'https://example.com',
};

describe('ReengagementEmail', () => {
  it('renders the recipient name', async () => {
    const html = await render(ReengagementEmail({ name: 'Ana', locale: 'en', ...baseProps }));
    expect(html).toContain('Ana');
  });

  it('greets with only the first name when given a full name', async () => {
    const html = await render(
      ReengagementEmail({ name: 'Ana Maria Garcia', locale: 'en', ...baseProps })
    );
    expect(html).toContain('Hi Ana,');
    expect(html).not.toContain('Ana Maria Garcia');
  });

  it('renders the discount code', async () => {
    const html = await render(ReengagementEmail({ name: 'Ana', locale: 'en', ...baseProps }));
    expect(html).toContain('LOTERIA-7KQ2M9');
  });

  it('renders the redeemUrl in the CTA', async () => {
    const html = await render(ReengagementEmail({ name: 'Ana', locale: 'en', ...baseProps }));
    expect(html).toContain('https://example.com/redeem?code=LOTERIA-7KQ2M9');
  });

  it('renders the unsubscribeUrl in the footer', async () => {
    const html = await render(ReengagementEmail({ name: 'Ana', locale: 'en', ...baseProps }));
    expect(html).toContain('unsubscribe?token=tok123');
  });

  it('renders the wordmark and process images with absolute URLs built from appUrl', async () => {
    const html = await render(ReengagementEmail({ name: 'Ana', locale: 'en', ...baseProps }));
    expect(html).toContain('https://example.com/email/wordmark.png');
    expect(html).toContain('https://example.com/email/loteria-process.png');
  });

  it('renders ES copy when locale is es', async () => {
    const html = await render(ReengagementEmail({ name: 'Ana', locale: 'es', ...baseProps }));
    // 'descuento' is a distinctive ES word used in the discount lead copy
    expect(html.toLowerCase()).toContain('descuento');
  });

  it('reengagementSubject returns distinct en/es strings asking if still interested', () => {
    const en = reengagementSubject('en');
    const es = reengagementSubject('es');
    expect(en).not.toBe(es);
    expect(en).toBe('Still Interested in Custom Lotería?');
    expect(es).toContain('Lotería personalizada');
  });
});
