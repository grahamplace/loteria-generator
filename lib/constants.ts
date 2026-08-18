export const FREE_CARD_LIMIT = 4;
export const TOTAL_CARD_COUNT = 54;

// Default name for an auto-created board (new-user first board + dashboard "New Board").
export const DEFAULT_BOARD_NAME = 'My Loteria Board';

// Single source of truth for board unlock pricing. Update both values together.
export const BOARD_UNLOCK_PRICE_CENTS = 2000;
export const BOARD_UNLOCK_PRICE_DISPLAY = '$20';

// Single source of truth for export board counts. Never hardcode these elsewhere.
export const DEFAULT_EXPORT_BOARD_COUNT = 50;
export const MIN_EXPORT_BOARD_COUNT = 1;
export const MAX_EXPORT_BOARD_COUNT = 100;

// Signup nudge lifecycle email + discount
export const SIGNUP_NUDGE_COUPON_ID = 'signup-nudge-25';
export const SIGNUP_NUDGE_DISCOUNT_PERCENT = 25;
export const SIGNUP_NUDGE_CODE_PREFIX = 'LOTERIA';
export const SIGNUP_NUDGE_EXPIRY_DAYS = 7;
export const LIFECYCLE_EMAIL_TYPE_SIGNUP_NUDGE = 'signup_nudge';

// Re-engagement lifecycle email + discount
export const REENGAGEMENT_COUPON_ID = 'reengagement-25';
export const REENGAGEMENT_DISCOUNT_PERCENT = 25;
export const REENGAGEMENT_EXPIRY_DAYS = 30;
export const LIFECYCLE_EMAIL_TYPE_REENGAGEMENT = 'reengagement';
