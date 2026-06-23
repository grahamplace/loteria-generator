import { describe, it, expect } from 'vitest';
import { ILLUSTRATION_PROMPT, buildIllustrationPrompt } from '@/lib/illustration-prompt';

describe('buildIllustrationPrompt', () => {
  it('returns the base prompt when no overlay is given', () => {
    expect(buildIllustrationPrompt()).toBe(ILLUSTRATION_PROMPT);
    expect(buildIllustrationPrompt(undefined)).toBe(ILLUSTRATION_PROMPT);
    expect(buildIllustrationPrompt(null)).toBe(ILLUSTRATION_PROMPT);
  });

  it('returns the base prompt for empty or whitespace-only overlays', () => {
    expect(buildIllustrationPrompt('')).toBe(ILLUSTRATION_PROMPT);
    expect(buildIllustrationPrompt('   \n  ')).toBe(ILLUSTRATION_PROMPT);
  });

  it('appends a trimmed overlay under an Additional Instructions heading', () => {
    const result = buildIllustrationPrompt('  Make the background flat blue.  ');
    expect(result).toContain(ILLUSTRATION_PROMPT);
    expect(result).toContain('## Additional Instructions');
    expect(result).toContain('Make the background flat blue.');
    expect(result).not.toContain('  Make the background flat blue.  ');
  });
});
