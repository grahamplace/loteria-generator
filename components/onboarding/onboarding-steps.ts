import { useTranslations } from 'next-intl';
import type { Tour } from 'nextstepjs';

// Tour identifiers — referenced by the per-page triggers.
export const TOUR_DASHBOARD_START = 'dashboard-start';
export const TOUR_BOARD_ADD_PHOTO = 'board-add-photo';

// Selector anchors — these ids live on the real CTAs in the existing UI.
export const ANCHOR_CREATE_BOARD = 'onb-create-board';
export const ANCHOR_UPLOAD = 'onb-upload';

/**
 * The onboarding is intentionally split into three single-step, per-screen
 * coachmarks instead of one cross-route tour. Each step is self-contained on
 * the page where its anchor lives, which keeps it robust across locale-prefixed
 * routes and lets the user click the real CTA to advance naturally.
 */
export function useOnboardingTours(): Tour[] {
  const t = useTranslations('Onboarding');

  return [
    {
      tour: TOUR_DASHBOARD_START,
      steps: [
        {
          icon: null,
          title: t('dashboardStart.title'),
          content: t('dashboardStart.content'),
          selector: `#${ANCHOR_CREATE_BOARD}`,
          side: 'bottom',
          showControls: true,
          showSkip: true,
          pointerPadding: 8,
          pointerRadius: 12,
        },
      ],
    },
    {
      tour: TOUR_BOARD_ADD_PHOTO,
      steps: [
        {
          icon: null,
          title: t('boardAddPhoto.title'),
          content: t('boardAddPhoto.content'),
          selector: `#${ANCHOR_UPLOAD}`,
          side: 'top',
          showControls: true,
          showSkip: true,
          pointerPadding: 10,
          pointerRadius: 12,
        },
      ],
    },
  ];
}
