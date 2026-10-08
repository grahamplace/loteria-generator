import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installPrintPalettes } from '../helpers/print-palettes';
import {
  editableBoardStyle,
  presetBoardStyle,
  resolveBoardStyle,
  drawThemeFrame,
} from '@/lib/themes/render-style';
import { themePresets, selectedBoardTheme, mergeBoardStyles } from '@/lib/themes/presets';
import { boardStyleSchema } from '@/lib/validations';

beforeEach(installPrintPalettes);

describe('editable print designs', () => {
  it('normalizes CSS colors shortened by the production optimizer', () => {
    document.documentElement.style.setProperty('--loteria-halloween-number', '#fff');
    expect(presetBoardStyle('halloween').numberColor).toBe('#ffffff');
    expect(boardStyleSchema.safeParse(presetBoardStyle('halloween')).success).toBe(true);
  });
  it('materializes every preset into validated, independent design values', () => {
    for (const preset of themePresets) {
      const values = presetBoardStyle(preset.id);
      expect(boardStyleSchema.safeParse({ ...values, presetId: 'custom' }).success).toBe(true);
      expect(editableBoardStyle({ ...values, presetId: 'custom' })).toEqual(values);
      expect(values).toEqual(
        expect.objectContaining({
          font: preset.font,
          backgroundColor: expect.stringMatching(/^#[0-9a-f]{6}$/i),
        })
      );
    }
  });
  it('retains every starting value when a user customizes a single setting', () => {
    const initial = presetBoardStyle('halloween');
    const saved = { ...initial, presetId: 'custom' as const, badgeColor: '#abcdef' };
    expect(editableBoardStyle(saved)).toEqual({ ...initial, badgeColor: '#abcdef' });
    expect(selectedBoardTheme(saved)).toBe('custom');
    expect(resolveBoardStyle(saved).frame).toBe('web');
  });
  it('keeps legacy colors and identifies those boards as Custom', () => {
    const legacy = { backgroundColor: '#fefefe', badgeColor: '#123456' };
    expect(resolveBoardStyle(legacy)).toMatchObject({
      ...legacy,
      labelFont: 'Jost',
      numberFont: 'Caveat',
      borderStyle: 'hand-drawn',
    });
    expect(selectedBoardTheme(legacy)).toBe('custom');
    expect(selectedBoardTheme({ showTitle: true })).toBe('classic');
  });
  it('uses the chosen font consistently while keeping existing board typography intact', () => {
    expect(resolveBoardStyle({ presetId: 'halloween' })).toMatchObject({
      font: 'Creepster',
      labelFont: 'Jost',
      numberFont: 'Caveat',
    });
    expect(
      resolveBoardStyle({ ...presetBoardStyle('wedding'), presetId: 'custom', font: 'Bebas Neue' })
    ).toMatchObject({ font: 'Bebas Neue', labelFont: 'Bebas Neue', numberFont: 'Bebas Neue' });
  });
  it('replaces custom values with a preset and preserves designs on a title-only update', () => {
    const custom = {
      ...presetBoardStyle('halloween'),
      presetId: 'custom' as const,
      showTitle: true,
    };
    expect(mergeBoardStyles(custom, { presetId: 'classic' })).toEqual({
      presetId: 'classic',
      showTitle: true,
    });
    expect(mergeBoardStyles(custom, { showTitle: false })).toEqual({ ...custom, showTitle: false });
    expect(
      mergeBoardStyles(custom, { ...presetBoardStyle('wedding'), presetId: 'wedding' })
    ).toEqual({ ...presetBoardStyle('wedding'), presetId: 'wedding', showTitle: true });
  });
  it.each([
    { backgroundColor: 'url(https://example.com)' },
    { numberColor: 'transparent' },
    { borderColor: '#12' },
    { font: 'unavailable' },
    { borderStyle: 'unknown' },
  ])('rejects unsupported print settings: %j', (settings) => {
    expect(boardStyleSchema.safeParse(settings).success).toBe(false);
  });
  it('can remove all decorative borders independently of the starting theme', () => {
    const ctx = { save: vi.fn() };
    drawThemeFrame(
      ctx as unknown as CanvasRenderingContext2D,
      2550,
      3300,
      resolveBoardStyle({
        ...presetBoardStyle('halloween'),
        presetId: 'custom',
        borderStyle: 'none',
      })
    );
    expect(ctx.save).not.toHaveBeenCalled();
  });
});
