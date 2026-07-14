'use client';

import { useEffect, useRef } from 'react';
import posthog from 'posthog-js';
import { useNextStep } from 'nextstepjs';
import { completeOnboarding, isOnboardingActive } from '@/lib/onboarding/state';

/**
 * Starts a named tour once, when `enabled` is true and onboarding is still
 * active. Rendered on the page where the tour's anchor element lives.
 *
 * `firedRef` is flipped inside the timeout — i.e. only once the tour has
 * *actually* started — never merely when scheduling. This survives React Strict
 * Mode's dev double-invoke (mount → cleanup → mount): the cleanup clears the
 * pending timeout, and because we haven't fired yet the second run reschedules
 * it. `startNextStep` lives in a ref so it isn't an effect dependency.
 */
export function OnboardingTrigger({ tour, enabled }: { tour: string; enabled: boolean }) {
  const { startNextStep } = useNextStep();
  const startRef = useRef(startNextStep);
  startRef.current = startNextStep;
  const firedRef = useRef(false);

  useEffect(() => {
    if (!enabled || firedRef.current) return;
    if (!isOnboardingActive()) return;

    // Small delay so the anchor element is painted and measurable before the
    // spotlight tries to position against it.
    const id = window.setTimeout(() => {
      firedRef.current = true;
      startRef.current(tour);
    }, 400);
    return () => window.clearTimeout(id);
  }, [enabled, tour]);

  return null;
}

/**
 * Marks onboarding complete when the user reaches the activation moment
 * (their first card exists), then dismisses any open coachmark.
 */
export function OnboardingCompleteWatcher({ done }: { done: boolean }) {
  const { closeNextStep } = useNextStep();
  const closeRef = useRef(closeNextStep);
  closeRef.current = closeNextStep;
  const firedRef = useRef(false);

  useEffect(() => {
    if (!done || firedRef.current) return;
    if (!isOnboardingActive()) return;

    firedRef.current = true;
    completeOnboarding();
    closeRef.current();
    posthog.capture('onboarding_completed');
  }, [done]);

  return null;
}
