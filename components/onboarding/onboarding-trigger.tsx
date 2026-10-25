'use client';

import { useEffect, useRef, useState } from 'react';
import posthog from 'posthog-js';
import { useNextStep } from 'nextstepjs';
import { completeOnboarding, isOnboardingActive } from '@/lib/onboarding/state';

/** Open Radix dialogs and drawers; they make the rest of the page inert. */
const OPEN_DIALOG = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';

/**
 * Whether a dialog is open anywhere on the page. A coachmark drawn over one
 * can't be clicked or dismissed, because the dialog makes the page inert.
 */
function useDialogOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const update = () => setOpen(document.querySelector(OPEN_DIALOG) !== null);
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributeFilter: ['data-state', 'role'],
    });
    return () => observer.disconnect();
  }, []);
  return open;
}

/**
 * Starts a named tour once, when `enabled` is true and onboarding is still
 * active. Rendered on the page where the tour's anchor element lives. While a
 * dialog is open the tour is hidden, then shown again once it closes.
 *
 * `firedRef` is flipped inside the timeout — i.e. only once the tour has
 * *actually* started — never merely when scheduling. This survives React Strict
 * Mode's dev double-invoke (mount → cleanup → mount): the cleanup clears the
 * pending timeout, and because we haven't fired yet the second run reschedules
 * it. `startNextStep` lives in a ref so it isn't an effect dependency.
 */
export function OnboardingTrigger({ tour, enabled }: { tour: string; enabled: boolean }) {
  const { startNextStep, closeNextStep } = useNextStep();
  const startRef = useRef(startNextStep);
  startRef.current = startNextStep;
  const closeRef = useRef(closeNextStep);
  closeRef.current = closeNextStep;
  const firedRef = useRef(false);
  const dialogOpen = useDialogOpen();

  useEffect(() => {
    if (dialogOpen) {
      // Closing doesn't count as skipping, so the tour can return afterwards.
      if (firedRef.current) closeRef.current();
      firedRef.current = false;
      return;
    }
    if (!enabled || firedRef.current) return;
    if (!isOnboardingActive()) return;

    // Small delay so the anchor element is painted and measurable before the
    // spotlight tries to position against it.
    const id = window.setTimeout(() => {
      firedRef.current = true;
      startRef.current(tour);
    }, 400);
    return () => window.clearTimeout(id);
  }, [enabled, tour, dialogOpen]);

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
