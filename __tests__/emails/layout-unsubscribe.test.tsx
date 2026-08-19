// __tests__/emails/layout-unsubscribe.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { LoteriaEmailLayout } from '@/emails/components/layout';

const base = {
  locale: 'en' as const,
  preview: 'Preview text',
  appUrl: 'https://example.com',
  footerText: 'Footer sentence.',
};

describe('LoteriaEmailLayout footer', () => {
  it('renders no unsubscribe link when no unsubscribeUrl is given', async () => {
    const html = await render(LoteriaEmailLayout({ ...base, children: 'Body' }));
    expect(html).toContain('Footer sentence.');
    expect(html.toLowerCase()).not.toContain('unsubscribe');
  });

  it('still renders the unsubscribe link when a url is given', async () => {
    const html = await render(
      LoteriaEmailLayout({
        ...base,
        unsubscribeUrl: 'https://example.com/unsubscribe?token=tok1',
        unsubscribeLabel: 'Unsubscribe',
        children: 'Body',
      })
    );
    expect(html).toContain('https://example.com/unsubscribe?token=tok1');
    expect(html).toContain('Unsubscribe');
  });
});
