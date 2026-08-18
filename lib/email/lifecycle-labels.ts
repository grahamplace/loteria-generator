// lib/email/lifecycle-labels.ts
//
// Human labels for `lifecycle_emails.type`. Every email that writes a row —
// cron-driven nudges and admin-triggered campaigns alike — should be listed
// here so the admin UI can name it. Kept separate from the campaign registry
// because that only knows about manually-sent campaigns.
import {
  LIFECYCLE_EMAIL_TYPE_SIGNUP_NUDGE,
  LIFECYCLE_EMAIL_TYPE_EMPTY_BOARD_NUDGE,
  LIFECYCLE_EMAIL_TYPE_REENGAGEMENT,
} from '@/lib/constants';

const LABELS: Record<string, string> = {
  [LIFECYCLE_EMAIL_TYPE_SIGNUP_NUDGE]: 'Signup nudge (25% off)',
  [LIFECYCLE_EMAIL_TYPE_EMPTY_BOARD_NUDGE]: 'Empty board nudge',
  [LIFECYCLE_EMAIL_TYPE_REENGAGEMENT]: 'Re-engagement (25% off)',
};

/**
 * Label for a lifecycle email type. Falls back to a humanized version of the raw
 * type so a newly added pipeline shows something sensible in the admin table
 * before anyone remembers to register a label here.
 */
export function lifecycleEmailLabel(type: string): string {
  if (LABELS[type]) return LABELS[type];
  const spaced = type.replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
