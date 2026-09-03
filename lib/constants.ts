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

// Extra print-safe margin, in inches, added to every edge of every generated
// PDF page. Consumer inkjets have an unprintable border (often ~0.25"+ at the
// bottom, where the paper feed grips), so a layout that runs closer than that
// to the paper edge gets clipped. Reported by a customer whose board bottoms
// were cut off; raise this if more printers turn out to need it.
export const PRINT_SAFE_MARGIN_IN = 0.125;

/** Same margin in canvas pixels. Pages render at 300 DPI (2550×3300 = 8.5"×11"). */
export const PRINT_SAFE_MARGIN_PX = PRINT_SAFE_MARGIN_IN * 300;

// ---------------------------------------------------------------------------
// Live play. See docs/live-play-spec.md.
// ---------------------------------------------------------------------------

/** Cards a Set needs before it can host a Game — strictly more than one Board. */
export const MIN_GAME_CARD_COUNT = 17;

/**
 * Hard cap on Players. Not a combinatorial limit: a 17-card Set still yields
 * 3.6e14 distinct Boards, because two Boards differ if the same cards sit in
 * different positions.
 */
export const MAX_PLAYERS_PER_GAME = 50;

/**
 * Below this, warn the Caller that Boards will be near-identical. A 20-card Set
 * gives every pair of Boards ~13 of 16 cards in common, so the Game is decided
 * by luck of arrangement rather than by the draw. Advisory, never a block.
 */
export const SMALL_SET_ADVISORY_CARD_COUNT = 24;

/** Six digits: 1,000,000 codes, and a keypad on every phone. */
export const GAME_CODE_LENGTH = 6;

/** Codes are never reused, so generation retries against the unique index. */
export const GAME_CODE_MAX_ATTEMPTS = 5;

/** Lobby that never starts expires; a Game with no Call for this long ends. */
export const GAME_LOBBY_EXPIRY_MINUTES = 120;
export const GAME_IDLE_EXPIRY_MINUTES = 60;

/** Claim Window after the first Win. Manual mode has none — the Caller ends it. */
export const CLAIM_WINDOW_SECONDS = 20;
