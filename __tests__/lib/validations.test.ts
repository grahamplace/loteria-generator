import { describe, it, expect } from 'vitest';
import { updateCardSchema } from '@/lib/validations';

const validId = '00000000-0000-0000-0000-000000000000';

describe('updateCardSchema riddle', () => {
  it('accepts a riddle string', () => {
    const parsed = updateCardSchema.safeParse({ cardId: validId, riddle: 'Una rima corta' });
    expect(parsed.success).toBe(true);
  });

  it('accepts null to clear a riddle', () => {
    const parsed = updateCardSchema.safeParse({ cardId: validId, riddle: null });
    expect(parsed.success).toBe(true);
  });

  it('accepts omitting the riddle entirely', () => {
    const parsed = updateCardSchema.safeParse({ cardId: validId, label: 'El Sol' });
    expect(parsed.success).toBe(true);
  });

  it('rejects a riddle longer than 500 characters', () => {
    const parsed = updateCardSchema.safeParse({ cardId: validId, riddle: 'x'.repeat(501) });
    expect(parsed.success).toBe(false);
  });
});
