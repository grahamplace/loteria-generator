'use client';

import { useEffect, useRef } from 'react';
import posthog from 'posthog-js';
import { useNextStep } from 'nextstepjs';
import { completeOnboarding, isOnboardingActive } from '@/lib/onboarding/state';

/**
 * Starts a named tour once, when `enabled` is true and onboarding is still
 * active. Rendered on the page where the tour's anchor element lives.
 */
export function OnboardingTrigger({ tour, enabled }: { tour: string; enabled: boolean }) {
  const { startNextStep } = useNextStep();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled || startedRef.current) return;
    if (!isOnboardingActive()) return;

    startedRef.current = true;
    // Small delay so the anchor element is painted and measurable before the
    // spotlight tries to position against it.
    const id = window.setTimeout(() => startNextStep(tour), 400);
    return () => window.clearTimeout(id);
  }, [enabled, tour, startNextStep]);

  return null;
}

/**
 * Marks onboarding complete when the user reaches the activation moment
 * (their first card exists), then dismisses any open coachmark.
 */
export function OnboardingCompleteWatcher({ done }: { done: boolean }) {
  const { closeNextStep } = useNextStep();
  const firedRef = useRef(false);

  useEffect(() => {
    if (!done || firedRef.current) return;
    if (!isOnboardingActive()) return;

    firedRef.current = true;
    completeOnboarding();
    closeNextStep();
    posthog.capture('onboarding_completed');
  }, [done, closeNextStep]);

  return null;
}
