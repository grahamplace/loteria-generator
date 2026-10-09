import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { printFonts } from '@/lib/themes/presets';
import { printFontFiles } from '@/lib/themes/fonts';
import { boardStyleSchema } from '@/lib/validations';

afterEach(() => vi.unstubAllGlobals());

describe('shared print fonts', () => {
  it.each(printFonts)('accepts %s and ships a real local font file', (font) => {
    expect(boardStyleSchema.safeParse({ presetId: 'custom', font }).success).toBe(true);
    const buffer = readFileSync(resolve('public', printFontFiles[font].slice(1)));
    // WOFF2 or TrueType magic, not an HTML error saved as a font.
    expect(['774f4632', '00010000']).toContain(buffer.subarray(0, 4).toString('hex'));
  });

  it('shares in-flight loads across the picker and renderer, and retries failed fonts', async () => {
    vi.resetModules();
    const add = vi.fn();
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValue({ family: 'Fredoka' });
    const construct = vi.fn();
    vi.stubGlobal(
      'FontFace',
      class {
        constructor(family: string, source: string) {
          construct(family, source);
        }
        load = load;
      }
    );
    vi.stubGlobal('document', { fonts: { add } });
    const { loadPrintFont } = await import('@/lib/themes/fonts');
    const first = loadPrintFont('Fredoka');
    expect(loadPrintFont('Fredoka')).toBe(first);
    await expect(first).rejects.toThrow('Network unavailable');
    const second = loadPrintFont('Fredoka');
    expect(second).not.toBe(first);
    await second;
    await loadPrintFont('Fredoka');
    expect(construct).toHaveBeenCalledTimes(2);
    expect(construct).toHaveBeenCalledWith('Fredoka', 'url(/fonts/themes/Fredoka-Regular.woff2)');
    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith({ family: 'Fredoka' });
  });
});
