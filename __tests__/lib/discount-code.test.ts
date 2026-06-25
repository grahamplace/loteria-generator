// __tests__/lib/discount-code.test.ts
import { describe, it, expect } from 'vitest';
import { generateDiscountCode } from '@/lib/email/discount-code';

describe('generateDiscountCode', () => {
  it('matches the LOTERIA-XXXXXX format with unambiguous chars', () => {
    const code = generateDiscountCode();
    expect(code).toMatch(/^LOTERIA-[A-HJ-NP-Z2-9]{6}$/);
  });

  it('excludes ambiguous characters I, O, 0, 1', () => {
    for (let i = 0; i < 200; i++) {
      const body = generateDiscountCode().split('-')[1];
      expect(body).not.toMatch(/[IO01]/);
    }
  });

  it('is highly unlikely to collide across many calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateDiscountCode());
    expect(seen.size).toBeGreaterThan(995);
  });
});
