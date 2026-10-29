import { describe, expect, it } from 'vitest';
import { completedLabel } from '@/lib/cards/completed-label';

describe('completedLabel', () => {
  it('keeps a label edited locally while the job ran', () => {
    expect(completedLabel('El Gato', 'El Gato Viejo')).toBe('El Gato');
  });

  it('uses the AI label for a fresh upload with no local label', () => {
    expect(completedLabel('', 'El Gato')).toBe('El Gato');
  });
});
