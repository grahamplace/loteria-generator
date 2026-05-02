import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardMarquee } from '@/components/card-marquee';
import { heroCards } from '@/lib/hero-cards';

describe('CardMarquee', () => {
  it('renders a region landmark with a descriptive label', () => {
    render(<CardMarquee cards={heroCards} />);
    const region = screen.getByRole('region', { name: /example lotería cards/i });
    expect(region).toBeInTheDocument();
  });

  it('renders each unique card label at least once in the DOM', () => {
    render(<CardMarquee cards={heroCards} />);
    for (const card of heroCards) {
      const matches = screen.getAllByText(card.label);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('renders a single scrolling row', () => {
    const { container } = render(<CardMarquee cards={heroCards} />);
    expect(container.querySelector('.hero-marquee-row--left')).not.toBeNull();
    // The right-direction row was removed when the marquee was simplified to one row.
    expect(container.querySelector('.hero-marquee-row--right')).toBeNull();
  });

  it('duplicates the row for seamless looping', () => {
    const { container } = render(<CardMarquee cards={heroCards} />);
    const row = container.querySelector('.hero-marquee-row--left')!;
    // The row contains all cards plus a duplicate set for the loop.
    expect(row.children.length).toBe(heroCards.length * 2);
  });
});
