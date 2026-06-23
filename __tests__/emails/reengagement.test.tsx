// __tests__/emails/reengagement.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { ReengagementEmail, reengagementSubject } from '@/emails/reengagement';

const baseProps = {
  discountCode: 'LOTERIA-7KQ2M9',
  redeemUrl: 'https://example.com/redeem?code=LOTERIA-7KQ2M9',
  unsubscribeUrl: 'https://example.com/unsubscribe?token=tok123&lang=en',
};

describe('ReengagementEmail', () => {
  it('renders the recipient name', async () => {
    const html = await render(ReengagementEmail({ name: 'Ana', locale: 'en', ...baseProps }));
    expect(html).toContain('Ana');
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

  it('renders ES copy when locale is es', async () => {
    const html = await render(ReengagementEmail({ name: 'Ana', locale: 'es', ...baseProps }));
    // 'descuento' is a distinctive ES word used in the discount lead copy
    expect(html.toLowerCase()).toContain('descuento');
  });

  it('reengagementSubject returns distinct en/es strings each containing 25', () => {
    const en = reengagementSubject('en');
    const es = reengagementSubject('es');
    expect(en).not.toBe(es);
    expect(en).toContain('25');
    expect(es).toContain('25');
  });
});
