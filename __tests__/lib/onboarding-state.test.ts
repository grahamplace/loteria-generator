import { describe, it, expect, beforeEach } from 'vitest';
import { isOnboardingActive, completeOnboarding, skipOnboarding } from '@/lib/onboarding/state';

const STORAGE_KEY = 'loteria.onboarding.v1';

describe('lib/onboarding/state', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('is active in a fresh state with empty localStorage', () => {
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(isOnboardingActive()).toBe(true);
  });

  it('is inactive after completeOnboarding() and persists the expected JSON', () => {
    completeOnboarding();

    expect(isOnboardingActive()).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ status: 'completed' }));
  });

  it('is inactive after skipOnboarding() and persists the expected JSON', () => {
    skipOnboarding();

    expect(isOnboardingActive()).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ status: 'skipped' }));
  });

  it('is active when a stored status is explicitly "active"', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ status: 'active' }));
    expect(isOnboardingActive()).toBe(true);
  });

  it('fails open (active) when the stored value is malformed garbage', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not-json-at-all{');
    expect(isOnboardingActive()).toBe(true);
  });

  it('fails open (active) when the stored JSON has an unknown status', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ status: 'bogus' }));
    expect(isOnboardingActive()).toBe(true);
  });
});
