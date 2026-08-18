'use client';

import posthog from 'posthog-js';
import { NextStepProvider, NextStep } from 'nextstepjs';
import { OnboardingCard } from '@/components/onboarding/onboarding-card';
import { useOnboardingTours } from '@/components/onboarding/onboarding-steps';
import { skipOnboarding } from '@/lib/onboarding/state';

/**
 * Mounts the NextStep onboarding engine around the app. Inert until a page
 * trigger calls startNextStep(...). All tour lifecycle events are forwarded to
 * PostHog so we can measure the signup → first-card funnel.
 */
export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const tours = useOnboardingTours();

  return (
    <NextStepProvider>
      <NextStep
        steps={tours}
        cardComponent={OnboardingCard}
        clickThroughOverlay
        shadowRgb="30, 20, 10"
        shadowOpacity="0.55"
        onStart={(tour) => posthog.capture('onboarding_started', { tour })}
        onStepChange={(step, tour) => posthog.capture('onboarding_step_viewed', { tour, step })}
        onComplete={(tour) => {
          // Each tour is a single step, so "Got it" is the only dismissal there
          // is — it has to persist, or the coachmark returns on every reload.
          skipOnboarding();
          posthog.capture('onboarding_tour_completed', { tour });
        }}
        onSkip={(step, tour) => {
          skipOnboarding();
          posthog.capture('onboarding_skipped', { tour, step });
        }}
      >
        {children}
      </NextStep>
    </NextStepProvider>
  );
}
