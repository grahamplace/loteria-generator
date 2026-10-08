import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { themePages, themePath } from '@/lib/themes/catalog';
import { themePresets } from '@/lib/themes/presets';
import { parseThemeEntry, themeStartPath } from '@/lib/theme-entry';
import { createBoardSchema, updateBoardSchema } from '@/lib/validations';

describe('theme catalog and acquisition settings', () => {
  it('pairs each published theme with a renderer, bilingual content, and real sample assets', () => {
    expect(themePages).toHaveLength(21);
    expect(new Set(themePages.map((page) => page.id)).size).toBe(21);
    for (const page of themePages) {
      expect(themePresets.some((preset) => preset.id === page.id)).toBe(true);
      expect(page.en.ideas.length).toBeGreaterThanOrEqual(6);
      expect(page['es-MX'].ideas.length).toBeGreaterThanOrEqual(6);
      expect(page.en.intro).not.toEqual(page['es-MX'].intro);
      expect(page.sample.etsyListingId).toMatch(/^\d+$/);
      const sample = JSON.parse(readFileSync(page.sample.manifest, 'utf8'));
      expect(sample.styles.presetId).toBe(page.id);
      expect(
        new Set(sample.cards.map((card: { id: string }) => card.id)).size
      ).toBeGreaterThanOrEqual(16);
      expect(sample.cards.some((card: { id: string }) => card.id === sample.compareId)).toBe(true);
      for (const asset of Object.values(page.sample.assets))
        expect(existsSync(`public${asset}`)).toBe(true);
      expect(themePath(page.id, 'es-MX')).toBe(`/es/loteria/${page.id}`);
    }
  });

  it('rejects unknown presets and modes at API boundaries', () => {
    expect(createBoardSchema.safeParse({ styleOptions: { presetId: 'fake' } }).success).toBe(false);
    expect(updateBoardSchema.safeParse({ photoMode: 'fake' }).success).toBe(false);
    expect(
      createBoardSchema.safeParse({
        styleOptions: { presetId: 'halloween', showTitle: true },
        photoMode: 'original',
      }).success
    ).toBe(true);
  });

  it('preserves explicit original mode and rejects invalid theme links', () => {
    expect(parseThemeEntry('halloween', 'original')).toEqual({
      theme: 'halloween',
      photoMode: 'original',
    });
    expect(parseThemeEntry('halloween', undefined)?.photoMode).toBe('illustrated');
    expect(parseThemeEntry('unknown', 'original')).toBeNull();
    expect(parseThemeEntry(undefined, undefined)).toBeNull();
    expect(themeStartPath('original-photos', 'original', 'es-MX')).toBe(
      '/es/start?theme=original-photos&mode=original'
    );
  });
});
