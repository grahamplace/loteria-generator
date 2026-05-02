import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { heroCards } from '@/lib/hero-cards';

// Mock next-intl/server so getTranslations returns a synchronous mock translator.
// The key→value mapping mirrors messages/en.json Marketing.Hero.
const heroMessages: Record<string, unknown> = {
  headlineLine1: 'Turn your photos into',
  headlineLine2Prefix: 'a custom',
  headlineLine2Suffix: 'set.',
  subtitle:
    'Upload photos of your <strong>family, friends, even pets</strong> — we instantly illustrate them in classic Mexican Lotería style and generate a full Lotería set you can print and play at home.',
  ctaTry: 'Try it for free →',
  ctaSeeHow: 'See how it works',
  trustItems: ['Ready in minutes', 'Print at home', 'No subscription'],
};

function makeMockT(messages: Record<string, unknown>) {
  const t = (key: string) => messages[key] ?? key;
  t.raw = (key: string) => messages[key];
  t.rich = (key: string, components: Record<string, (chunks: unknown) => unknown>) => {
    // Simple passthrough: replace <tag>...</tag> with the rendered component
    const raw = (messages[key] as string) ?? key;
    const parts: unknown[] = [];
    let remaining = raw;
    for (const [tag, render] of Object.entries(components)) {
      const open = `<${tag}>`;
      const close = `</${tag}>`;
      const idx = remaining.indexOf(open);
      if (idx === -1) continue;
      parts.push(remaining.slice(0, idx));
      const endIdx = remaining.indexOf(close, idx);
      const inner = remaining.slice(idx + open.length, endIdx);
      parts.push(render(inner));
      remaining = remaining.slice(endIdx + close.length);
    }
    parts.push(remaining);
    return parts;
  };
  return t;
}

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async (namespace: string) => {
    if (namespace === 'Marketing.Hero') {
      return makeMockT(heroMessages);
    }
    return makeMockT({});
  }),
  setRequestLocale: vi.fn(),
}));

// Import AFTER mocks are set up
import { LandingHero } from '@/components/landing-hero';

describe('LandingHero', () => {
  it('renders the H1 with "Lotería" keyword', async () => {
    await act(async () => {
      render(await LandingHero());
    });
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toMatch(/Lotería/);
    expect(h1.textContent).toMatch(/custom/i);
  });

  it('renders the primary CTA linking to /sign-up', async () => {
    await act(async () => {
      render(await LandingHero());
    });
    const cta = screen.getByRole('link', { name: /try it for free/i });
    expect(cta).toHaveAttribute('href', '/sign-up');
  });

  it('renders the secondary CTA linking to #how-it-works', async () => {
    await act(async () => {
      render(await LandingHero());
    });
    const cta = screen.getByRole('link', { name: /see how it works/i });
    expect(cta).toHaveAttribute('href', '#how-it-works');
  });

  it('renders all three trust pills', async () => {
    await act(async () => {
      render(await LandingHero());
    });
    expect(screen.getByText(/ready in minutes/i)).toBeInTheDocument();
    expect(screen.getByText(/print at home/i)).toBeInTheDocument();
    expect(screen.getByText(/no subscription/i)).toBeInTheDocument();
  });

  it('renders every hero card label (SEO content density)', async () => {
    await act(async () => {
      render(await LandingHero());
    });
    for (const card of heroCards) {
      expect(screen.getAllByText(card.label).length).toBeGreaterThanOrEqual(1);
    }
  });
});
