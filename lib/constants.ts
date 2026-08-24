export const FREE_CARD_LIMIT = 4;
export const TOTAL_CARD_COUNT = 54;

// Default name for an auto-created board (new-user first board + dashboard "New Board").
export const DEFAULT_BOARD_NAME = 'My Loteria Board';

// Single source of truth for board unlock pricing. Update both values together.
export const BOARD_UNLOCK_PRICE_CENTS = 2000;
export const BOARD_UNLOCK_PRICE_DISPLAY = '$20';

// Single source of truth for export board counts. Never hardcode these elsewhere.
/** Cards a board needs before its Lotería set can be generated. */
export const MIN_EXPORT_CARD_COUNT = 16;
export const DEFAULT_EXPORT_BOARD_COUNT = 50;
export const MIN_EXPORT_BOARD_COUNT = 1;
export const MAX_EXPORT_BOARD_COUNT = 100;

// Signup nudge lifecycle email + discount
export const SIGNUP_NUDGE_COUPON_ID = 'signup-nudge-25';
export const SIGNUP_NUDGE_DISCOUNT_PERCENT = 25;
export const SIGNUP_NUDGE_CODE_PREFIX = 'LOTERIA';
export const SIGNUP_NUDGE_EXPIRY_DAYS = 7;
export const LIFECYCLE_EMAIL_TYPE_SIGNUP_NUDGE = 'signup_nudge';

// Password reset. Must stay in sync with better-auth's own `minPasswordLength`
// default (1.6.9) — we duplicate it here only to share one value across pages.
export const MIN_PASSWORD_LENGTH = 8;

// Re-engagement lifecycle email + discount
export const REENGAGEMENT_COUPON_ID = 'reengagement-25';
export const REENGAGEMENT_DISCOUNT_PERCENT = 25;
export const REENGAGEMENT_EXPIRY_DAYS = 30;
export const LIFECYCLE_EMAIL_TYPE_REENGAGEMENT = 'reengagement';

// Empty-board nudge lifecycle email (signed up, has a board, made zero cards).
//
// The discount is carried by the *manual* campaign only. The hourly cron mails
// people 24-48h after signup, where the ask is still "try it", not "buy it" —
// and minting a Stripe promo code for every stalled new signup, hourly, buys
// nothing. Manual sends chase a much older backlog, who need the incentive.
export const LIFECYCLE_EMAIL_TYPE_EMPTY_BOARD_NUDGE = 'empty_board_nudge';
export const EMPTY_BOARD_COUPON_ID = 'empty-board-25';
export const EMPTY_BOARD_DISCOUNT_PERCENT = 25;
export const EMPTY_BOARD_EXPIRY_DAYS = 30;

// No-board nudge campaign + discount (signed up, never created a board at all).
// These users predate the auto-created first board, so they never saw the editor.
// Its own Stripe coupon rather than sharing the re-engagement one, so redemptions
// stay attributable per campaign in the Stripe dashboard.
export const NO_BOARD_COUPON_ID = 'no-board-25';
export const NO_BOARD_DISCOUNT_PERCENT = 25;
export const NO_BOARD_EXPIRY_DAYS = 30;
export const LIFECYCLE_EMAIL_TYPE_NO_BOARD = 'no_board_nudge';

// Reply-to for lifecycle email that invites a human reply. Replies land in a real
// inbox, so this must stay an address someone actually reads.
export const SUPPORT_REPLY_TO_EMAIL = 'graham@stonecutterlabs.com';
