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

  it('renders two rows with distinct class modifiers', () => {
    const { container } = render(<CardMarquee cards={heroCards} />);
    expect(container.querySelector('.hero-marquee-row--left')).not.toBeNull();
    expect(container.querySelector('.hero-marquee-row--right')).not.toBeNull();
  });

  it('puts every card in both rows and duplicates each row for seamless looping', () => {
    const { container } = render(<CardMarquee cards={heroCards} />);
    const leftRow = container.querySelector('.hero-marquee-row--left')!;
    const rightRow = container.querySelector('.hero-marquee-row--right')!;
    // Each row contains all 18 cards plus a duplicate set for the loop.
    expect(leftRow.children.length).toBe(heroCards.length * 2);
    expect(rightRow.children.length).toBe(heroCards.length * 2);
  });
});
