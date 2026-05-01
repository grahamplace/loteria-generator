import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LandingHero } from '@/components/landing-hero';
import { heroCards } from '@/lib/hero-cards';

describe('LandingHero', () => {
  it('renders the H1 with "Lotería" keyword', () => {
    render(<LandingHero />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toMatch(/Lotería/);
    expect(h1.textContent).toMatch(/Custom/i);
  });

  it('renders the primary CTA linking to /sign-up', () => {
    render(<LandingHero />);
    const cta = screen.getByRole('link', { name: /create your lotería set free/i });
    expect(cta).toHaveAttribute('href', '/sign-up');
  });

  it('renders the secondary CTA linking to #how-it-works', () => {
    render(<LandingHero />);
    const cta = screen.getByRole('link', { name: /see how it works/i });
    expect(cta).toHaveAttribute('href', '#how-it-works');
  });

  it('renders all three feature pills', () => {
    render(<LandingHero />);
    expect(screen.getByText(/ready in minutes/i)).toBeInTheDocument();
    expect(screen.getByText(/prints on letter paper/i)).toBeInTheDocument();
    expect(screen.getByText(/no subscription/i)).toBeInTheDocument();
  });

  it('renders every hero card label (SEO content density)', () => {
    render(<LandingHero />);
    for (const card of heroCards) {
      expect(screen.getAllByText(card.label).length).toBeGreaterThanOrEqual(1);
    }
  });
});
