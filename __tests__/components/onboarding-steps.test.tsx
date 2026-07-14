import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/messages/en.json';
import {
  useOnboardingTours,
  TOUR_DASHBOARD_START,
  TOUR_BOARD_INTRO,
  TOUR_BOARD_ADD_PHOTO,
  ANCHOR_CREATE_BOARD,
  ANCHOR_GET_STARTED,
  ANCHOR_UPLOAD,
} from '@/components/onboarding/onboarding-steps';

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

function renderTours() {
  return renderHook(() => useOnboardingTours(), { wrapper }).result.current;
}

describe('useOnboardingTours', () => {
  it('returns exactly 3 tours with the expected tour identifiers', () => {
    const tours = renderTours();

    expect(tours).toHaveLength(3);
    expect(tours.map((tour) => tour.tour)).toEqual([
      TOUR_DASHBOARD_START,
      TOUR_BOARD_INTRO,
      TOUR_BOARD_ADD_PHOTO,
    ]);
  });

  it('gives each tour exactly one step targeting the matching anchor selector', () => {
    const tours = renderTours();

    const expectedSelectors: Record<string, string> = {
      [TOUR_DASHBOARD_START]: `#${ANCHOR_CREATE_BOARD}`,
      [TOUR_BOARD_INTRO]: `#${ANCHOR_GET_STARTED}`,
      [TOUR_BOARD_ADD_PHOTO]: `#${ANCHOR_UPLOAD}`,
    };

    for (const tour of tours) {
      expect(tour.steps).toHaveLength(1);
      expect(tour.steps[0].selector).toBe(expectedSelectors[tour.tour]);
    }
  });

  it('resolves real translations (non-empty title/content, not raw keys) for every step', () => {
    const tours = renderTours();

    for (const tour of tours) {
      const step = tour.steps[0];
      expect(typeof step.title).toBe('string');
      expect((step.title as string).length).toBeGreaterThan(0);
      expect(typeof step.content).toBe('string');
      expect((step.content as string).length).toBeGreaterThan(0);

      // A resolved translation must not still look like a `namespace.key` path.
      expect(step.title).not.toMatch(/^[a-zA-Z]+\.[a-zA-Z]+$/);
      expect(step.content).not.toMatch(/^[a-zA-Z]+\.[a-zA-Z]+$/);
    }
  });
});
