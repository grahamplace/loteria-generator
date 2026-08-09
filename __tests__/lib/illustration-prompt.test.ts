import { describe, it, expect } from 'vitest';
import {
  BACKGROUND_COLORS,
  buildIllustrationPrompt,
  pickBackgroundColor,
  renderIllustrationPrompt,
} from '@/lib/illustration-prompt';

const YELLOW = BACKGROUND_COLORS[0];

describe('pickBackgroundColor', () => {
  it('always returns one of BACKGROUND_COLORS', () => {
    for (let i = 0; i < 50; i++) {
      expect(BACKGROUND_COLORS).toContain(pickBackgroundColor());
    }
  });
});

describe('renderIllustrationPrompt', () => {
  it('renders the selected background color name and hex into the prompt', () => {
    const prompt = renderIllustrationPrompt(YELLOW);
    expect(prompt).toContain(YELLOW.name);
    expect(prompt).toContain(YELLOW.hex);
    expect(prompt).toContain('do not default to blue');
  });

  it('tells the model to keep and restyle backgrounds that carry meaning', () => {
    const prompt = renderIllustrationPrompt(YELLOW);
    expect(prompt).toContain('Background IS meaningful');
    expect(prompt).toContain('Keep it and restyle it in the same Lotería style');
  });

  it('tells the model to drop incidental backgrounds for a flat color field', () => {
    const prompt = renderIllustrationPrompt(YELLOW);
    expect(prompt).toContain('Background is NOT meaningful');
    expect(prompt).toContain('Drop it entirely');
  });

  it('no longer blanket-bans scenery, so meaningful settings survive', () => {
    const prompt = renderIllustrationPrompt(YELLOW);
    expect(prompt).not.toContain('no complex scenery');
    expect(prompt).not.toMatch(/negative[\s\S]*\bcomplex scenery\b/i);
  });
});

describe('buildIllustrationPrompt', () => {
  it('returns the base prompt for the given background when no overlay is given', () => {
    const base = renderIllustrationPrompt(YELLOW);
    expect(buildIllustrationPrompt(undefined, YELLOW)).toBe(base);
    expect(buildIllustrationPrompt(null, YELLOW)).toBe(base);
  });

  it('returns the base prompt for empty or whitespace-only overlays', () => {
    const base = renderIllustrationPrompt(YELLOW);
    expect(buildIllustrationPrompt('', YELLOW)).toBe(base);
    expect(buildIllustrationPrompt('   \n  ', YELLOW)).toBe(base);
  });

  it('uses a background from the pool when none is provided', () => {
    const prompt = buildIllustrationPrompt();
    expect(BACKGROUND_COLORS.some((c) => prompt.includes(c.hex))).toBe(true);
  });

  it('appends a trimmed overlay under an Additional Instructions heading', () => {
    const result = buildIllustrationPrompt('  Make the background flat blue.  ', YELLOW);
    expect(result).toContain(renderIllustrationPrompt(YELLOW));
    expect(result).toContain('## Additional Instructions');
    expect(result).toContain('Make the background flat blue.');
    expect(result).not.toContain('  Make the background flat blue.  ');
  });
});
