import { useTranslations } from 'next-intl';
import type { Tour } from 'nextstepjs';

// Tour identifiers — referenced by the per-page triggers.
export const TOUR_BOARD_ADD_PHOTO = 'board-add-photo';

// Selector anchors — these ids live on the real CTAs in the existing UI.
export const ANCHOR_UPLOAD = 'onb-upload';

/** First-run help starts at the upload control inside the user's board. */
export function useOnboardingTours(): Tour[] {
  const t = useTranslations('Onboarding');

  return [
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
          pointerPadding: 10,
          pointerRadius: 12,
        },
      ],
    },
  ];
}
