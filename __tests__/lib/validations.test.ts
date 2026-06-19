import { describe, it, expect } from 'vitest';
import { createCardSchema, updateCardSchema } from '@/lib/validations';

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

describe('createCardSchema skipLabeling', () => {
  it('accepts skipLabeling true', () => {
    const parsed = createCardSchema.safeParse({ label: 'El Sol', skipLabeling: true });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.skipLabeling).toBe(true);
  });

  it('accepts payloads without skipLabeling (optional)', () => {
    const parsed = createCardSchema.safeParse({ label: 'El Sol' });
    expect(parsed.success).toBe(true);
  });

  it('rejects non-boolean skipLabeling', () => {
    const parsed = createCardSchema.safeParse({ skipLabeling: 'yes' });
    expect(parsed.success).toBe(false);
  });
});

describe('createCardSchema skipIllustration', () => {
  it('accepts skipIllustration true', () => {
    const parsed = createCardSchema.safeParse({ label: 'El Sol', skipIllustration: true });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.skipIllustration).toBe(true);
  });

  it('is optional', () => {
    expect(createCardSchema.safeParse({ label: 'El Sol' }).success).toBe(true);
  });

  it('rejects non-boolean skipIllustration', () => {
    expect(createCardSchema.safeParse({ skipIllustration: 'yes' }).success).toBe(false);
  });
});

describe('cropData on card schemas', () => {
  const crop = { x: 1, y: 2, width: 3, height: 4 };
  it('createCardSchema accepts cropData', () => {
    const p = createCardSchema.safeParse({ skipIllustration: true, cropData: crop });
    expect(p.success).toBe(true);
    if (p.success) expect(p.data.cropData).toEqual(crop);
  });
  it('updateCardSchema accepts cropData', () => {
    const p = updateCardSchema.safeParse({
      cardId: '11111111-1111-1111-1111-111111111111',
      cropData: crop,
    });
    expect(p.success).toBe(true);
  });
  it('rejects malformed cropData', () => {
    expect(
      createCardSchema.safeParse({ cropData: { x: 'a', y: 2, width: 3, height: 4 } }).success
    ).toBe(false);
  });
});
