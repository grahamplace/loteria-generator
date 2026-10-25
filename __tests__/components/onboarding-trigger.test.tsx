import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { NextStepProvider, useNextStep } from 'nextstepjs';
import { OnboardingTrigger } from '@/components/onboarding/onboarding-trigger';
import { ONBOARDING_STORAGE_KEY } from '@/lib/onboarding/state';

function TourState() {
  const { currentTour, isNextStepVisible } = useNextStep();
  return <output>{isNextStepVisible ? currentTour : 'hidden'}</output>;
}

function renderTrigger() {
  return render(
    <NextStepProvider>
      <OnboardingTrigger tour="board-add-photo" enabled />
      <TourState />
    </NextStepProvider>
  );
}

/** Mounts an element shaped like an open Radix dialog. */
function openDialog() {
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('data-state', 'open');
  document.body.append(dialog);
  return dialog;
}

/** Lets the observer re-render, then runs the trigger's start delay. */
async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
}

describe('OnboardingTrigger', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  });
  afterEach(() => {
    vi.useRealTimers();
    document.querySelectorAll('[role="dialog"]').forEach((node) => node.remove());
  });

  it('starts the tour when no dialog is open', async () => {
    renderTrigger();
    await settle();
    expect(screen.getByRole('status')).toHaveTextContent('board-add-photo');
  });

  it('hides the tour while a dialog is open and brings it back after', async () => {
    renderTrigger();
    await settle();
    const dialog = openDialog();
    await settle();
    expect(screen.getByRole('status')).toHaveTextContent('hidden');
    dialog.setAttribute('data-state', 'closed');
    await settle();
    expect(screen.getByRole('status')).toHaveTextContent('board-add-photo');
  });

  it('waits for an already-open dialog to close before starting', async () => {
    const dialog = openDialog();
    renderTrigger();
    await settle();
    expect(screen.getByRole('status')).toHaveTextContent('hidden');
    dialog.remove();
    await settle();
    expect(screen.getByRole('status')).toHaveTextContent('board-add-photo');
  });

  it('does not come back after the dialog if onboarding ended meanwhile', async () => {
    renderTrigger();
    await settle();
    const dialog = openDialog();
    await settle();
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({ status: 'completed' }));
    dialog.remove();
    await settle();
    expect(screen.getByRole('status')).toHaveTextContent('hidden');
  });
});
