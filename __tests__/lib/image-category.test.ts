import { describe, it, expect } from 'vitest';
import { isImageCategory, pickImageCategory } from '@/lib/image-category';

const probs = (p: Record<string, number>) =>
  Object.entries(p).map(([value, probability]) => ({ value, probability }));

describe('pickImageCategory', () => {
  it('takes the most likely category', () => {
    expect(pickImageCategory(probs({ text: 0, object: 0.96, subject: 0, scene: 0.04 }))).toBe(
      'object'
    );
    expect(pickImageCategory(probs({ text: 0, object: 0, subject: 0.69, scene: 0.31 }))).toBe(
      'subject'
    );
  });

  it('leans toward scene on a close call', () => {
    expect(pickImageCategory(probs({ text: 0, object: 0, subject: 0.51, scene: 0.49 }))).toBe(
      'scene'
    );
    expect(pickImageCategory(probs({ subject: 0.6, scene: 0.4 }))).toBe('scene');
  });

  it('ignores unknown values and returns null when nothing is usable', () => {
    expect(pickImageCategory(probs({ other: 0.9, text: 0.1 }))).toBe('text');
    expect(pickImageCategory([])).toBeNull();
    expect(pickImageCategory([{ value: 'scene', probability: 'high' }])).toBeNull();
  });
});

describe('isImageCategory', () => {
  it('accepts only the four categories', () => {
    expect(isImageCategory('scene')).toBe(true);
    expect(isImageCategory('landscape')).toBe(false);
    expect(isImageCategory(null)).toBe(false);
  });
});
