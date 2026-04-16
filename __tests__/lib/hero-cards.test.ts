import { describe, it, expect } from 'vitest';
import { heroCards, type HeroCard, type ArtKey, type Tone } from '@/lib/hero-cards';

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

  it('every card has a non-empty Spanish label', () => {
    for (const card of heroCards) {
      expect(card.label.length).toBeGreaterThan(0);
    }
  });

  it('every card uses a valid tone', () => {
    const tones: Tone[] = ['marigold', 'verde', 'rose'];
    for (const card of heroCards) {
      expect(tones).toContain(card.tone);
    }
  });

  it('includes both classic and event-themed cards', () => {
    const labels = heroCards.map((c) => c.label);
    expect(labels).toContain('La Rosa');
    expect(labels).toContain('El Sol');
    expect(labels).toContain('La Luna');
    expect(labels).toContain('La Novia');
    expect(labels).toContain('La Quinceañera');
  });

  it('HeroCard and ArtKey types are exported', () => {
    const sample: HeroCard = {
      id: 'test',
      number: '01',
      label: 'Test',
      artKey: 'rose' as ArtKey,
      tone: 'marigold',
    };
    expect(sample).toBeDefined();
  });
});
