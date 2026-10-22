import { describe, expect, it } from 'vitest';
import {
  getGenerationLimit,
  IMAGE_GENERATION_LIMIT_FREE,
  IMAGE_GENERATION_LIMIT_PAID,
} from '@/db/schema';

describe('getGenerationLimit', () => {
  it('uses the free default for a locked board', () => {
    expect(getGenerationLimit({ isUnlocked: false, generationLimitOverride: null })).toBe(
      IMAGE_GENERATION_LIMIT_FREE
    );
  });

  it('uses the paid default for an unlocked board', () => {
    expect(getGenerationLimit({ isUnlocked: true, generationLimitOverride: null })).toBe(
      IMAGE_GENERATION_LIMIT_PAID
    );
  });

  it('prefers the override when set', () => {
    expect(getGenerationLimit({ isUnlocked: true, generationLimitOverride: 125 })).toBe(125);
    expect(getGenerationLimit({ isUnlocked: false, generationLimitOverride: 10 })).toBe(10);
  });

  it('treats an override of 0 as a real limit', () => {
    expect(getGenerationLimit({ isUnlocked: true, generationLimitOverride: 0 })).toBe(0);
  });
});
