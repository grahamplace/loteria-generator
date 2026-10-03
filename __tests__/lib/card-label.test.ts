import { describe, it, expect } from 'vitest';
import { parseLabelResponse } from '@/lib/card-label';

const json = (label: unknown) => JSON.stringify({ label });

describe('parseLabelResponse', () => {
  it.each(['La Luna', 'El Corazón', 'La Muñeca', 'El Pájaro Azul', 'Los 3 Cochinitos'])(
    'accepts %s',
    (label) => {
      expect(parseLabelResponse(json(label))).toBe(label);
    }
  );

  it('trims surrounding whitespace', () => {
    expect(parseLabelResponse(json('  La Luna  '))).toBe('La Luna');
  });

  it.each([
    ['leaked reasoning', 'el.. wait, no I need a label in spanish. Maybe I should'],
    ['too many words', 'El Gran Perro Negro Del Barrio'],
    ['too long', 'Supercalifragilisticoexpialidoso'],
    ['punctuation', 'La Luna.'],
    ['newline', 'La\nLuna'],
    ['empty', '   '],
    ['non-string', 42],
  ])('rejects %s', (_case, label) => {
    expect(parseLabelResponse(json(label))).toBeNull();
  });

  it.each([null, undefined, '', 'La Luna', '{"name":"La Luna"}'])(
    'rejects non-conforming content %j',
    (content) => {
      expect(parseLabelResponse(content)).toBeNull();
    }
  );
});
