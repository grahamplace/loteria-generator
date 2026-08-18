// Client-side persistence for the first-run onboarding flow.
//
// We deliberately keep this in localStorage (not the DB) for the first version:
// it avoids a schema migration against the shared prod database, and "have I
// seen the intro coachmarks on this device" is low-stakes enough that per-device
// state is acceptable. Promote to a user_profiles column later if we want
// cross-device persistence.

export const ONBOARDING_STORAGE_KEY = 'loteria.onboarding.v1';

export type OnboardingStatus = 'active' | 'completed' | 'skipped';

interface OnboardingRecord {
  status: OnboardingStatus;
}

function read(): OnboardingRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingRecord>;
    if (
      parsed &&
      (parsed.status === 'active' || parsed.status === 'completed' || parsed.status === 'skipped')
    ) {
      return { status: parsed.status };
    }
    return null;
  } catch {
    // Private mode / disabled storage / malformed JSON — fail open (no tour).
    return null;
  }
}

function write(status: OnboardingStatus): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({ status }));
  } catch {
    // Ignore write failures — the tour simply won't be suppressed next load.
  }
}

/**
 * Whether the first-run onboarding should still guide the user.
 * True until the user completes it (creates a first card) or skips it.
 * Returns false during SSR so tours never attempt to start on the server.
 */
export function isOnboardingActive(): boolean {
  const record = read();
  return record === null || record.status === 'active';
}

/** Mark onboarding finished — the user reached the activation moment. */
export function completeOnboarding(): void {
  write('completed');
}

/** Mark onboarding dismissed — the user opted out of the guidance. */
export function skipOnboarding(): void {
  write('skipped');
}
