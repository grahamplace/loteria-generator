import { describe, it, expect } from 'vitest';
import { filenameToLabel } from '@/lib/filename-label';

describe('filenameToLabel', () => {
  it('strips a single extension', () => {
    expect(filenameToLabel('el corazon.jpg')).toBe('el corazon');
  });

  it('strips only the last extension on dotted names', () => {
    expect(filenameToLabel('La Dama.v2.PNG')).toBe('La Dama.v2');
  });

  it('returns the name unchanged when there is no extension', () => {
    expect(filenameToLabel('noext')).toBe('noext');
  });

  it('trims surrounding whitespace', () => {
    expect(filenameToLabel('  El Perro .png ')).toBe('El Perro');
  });

  it('returns empty string for empty or whitespace-only input', () => {
    expect(filenameToLabel('')).toBe('');
    expect(filenameToLabel('   ')).toBe('');
    expect(filenameToLabel('.png')).toBe('');
  });

  it('handles uppercase extensions', () => {
    expect(filenameToLabel('GATO.JPEG')).toBe('GATO');
  });
});
