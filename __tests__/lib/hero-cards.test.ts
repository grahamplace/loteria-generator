import { describe, it, expect } from 'vitest';
import { heroCards, type HeroCard } from '@/lib/hero-cards';

describe('heroCards', () => {
  it('exports 18 cards', () => {
    expect(heroCards).toHaveLength(18);
  });

  it('has unique ids across all cards', () => {
    const ids = heroCards.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique zero-padded two-digit numbers 01-18', () => {
    const numbers = heroCards.map((c) => c.number).sort();
    const expected = Array.from({ length: 18 }, (_, i) => String(i + 1).padStart(2, '0')).sort();
    expect(numbers).toEqual(expected);
  });

  it('every card has a unique non-empty Spanish label', () => {
    const labels = heroCards.map((c) => c.label);
    for (const label of labels) expect(label.length).toBeGreaterThan(0);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('every card has an image asset', () => {
    for (const card of heroCards) {
      expect(card.image).toBeTruthy();
    }
  });

  it('covers the marketing categories: weddings, quinceañeras, family, pets, hobbies', () => {
    const labels = heroCards.map((c) => c.label);
    expect(labels).toContain('La Boda');
    expect(labels).toContain('La Quinceañera');
    expect(labels).toContain('La Familia');
    expect(labels).toContain('El Perro');
    expect(labels).toContain('La Guitarra');
  });

  it('HeroCard type carries an image field', () => {
    const sample: HeroCard = heroCards[0];
    expect(sample.image).toBeDefined();
  });
});
