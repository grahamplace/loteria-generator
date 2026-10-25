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

describe('LoteriaEmailLayout dashboard links', () => {
  const marketing = {
    ...base,
    unsubscribeUrl: 'https://example.com/unsubscribe?token=tok1',
    unsubscribeLabel: 'Unsubscribe',
    showExampleImage: true,
    children: 'Body',
  };
  const count = (html: string, needle: string) => html.split(needle).length - 1;

  it('links the wordmark, example image, and visit line to the dashboard', async () => {
    const html = await render(LoteriaEmailLayout(marketing));
    expect(count(html, 'href="https://example.com/dashboard"')).toBe(3);
    expect(html).toContain('Visit example.com');
  });

  it('points Spanish readers at the /es dashboard', async () => {
    const html = await render(LoteriaEmailLayout({ ...marketing, locale: 'es' }));
    expect(count(html, 'href="https://example.com/es/dashboard"')).toBe(3);
    expect(html).toContain('Visita example.com');
  });

  it('keeps transactional email to the wordmark link only', async () => {
    const html = await render(LoteriaEmailLayout({ ...base, children: 'Body' }));
    expect(count(html, 'href="https://example.com/dashboard"')).toBe(1);
    expect(html).not.toContain('Visit example.com');
  });
});
