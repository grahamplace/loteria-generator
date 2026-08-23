// __tests__/email/first-name.test.ts
import { describe, it, expect } from 'vitest';
import { firstName } from '@/lib/email/first-name';

describe('firstName', () => {
  it('returns the only token for a single name', () => {
    expect(firstName('Ana')).toBe('Ana');
  });

  it('returns just the first token for a full name', () => {
    expect(firstName('Ana Maria Garcia')).toBe('Ana');
  });

  it('trims surrounding and collapses internal whitespace', () => {
    expect(firstName('  Ana   Maria ')).toBe('Ana');
  });

  it('returns empty string for null/undefined/blank', () => {
    expect(firstName(null)).toBe('');
    expect(firstName(undefined)).toBe('');
    expect(firstName('   ')).toBe('');
  });

  it('normalizes an all-caps name to title case', () => {
    expect(firstName('MONICA')).toBe('Monica');
    expect(firstName('MONICA GARCIA')).toBe('Monica');
  });

  it('capitalizes an all-lowercase name', () => {
    expect(firstName('monica')).toBe('Monica');
  });

  it('title-cases hyphenated and apostrophe compounds', () => {
    expect(firstName('MARY-ANNE')).toBe('Mary-Anne');
    expect(firstName("o'brien")).toBe("O'Brien");
    expect(firstName('MARÍA')).toBe('María');
  });

  it('leaves deliberate internal capitals alone', () => {
    expect(firstName('McKenna')).toBe('McKenna');
    expect(firstName('DeAndre')).toBe('DeAndre');
    expect(firstName('Ana')).toBe('Ana');
  });
});
