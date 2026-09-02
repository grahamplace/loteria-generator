import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  json,
  uuid,
  unique,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

/**
 * Better Auth core tables (required by the Drizzle adapter).
 * See: https://www.better-auth.com/docs/concepts/database#core-schema
 */
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// User profiles - our extension of neon_auth users
export const userProfiles = pgTable('user_profiles', {
  id: text('id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id'),
  locale: text('locale'), // 'en' | 'es' | null — null means no preference set
  // Marketing email opt-out. null = subscribed; timestamp = when they unsubscribed.
  marketingUnsubscribedAt: timestamp('marketing_unsubscribed_at', { withTimezone: true }),
  // Opaque per-user token used in unsubscribe links (no auth needed to act on it).
  unsubscribeToken: text('unsubscribe_token').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Board style options type
export interface BoardStyleOptions {
  backgroundColor?: string;
  badgeColor?: string;
  labelColor?: string;
}

// Crop rectangle in pixels of the stored (downscaled) original image.
export interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Generation limits
export const IMAGE_GENERATION_LIMIT_FREE = 4;
export const IMAGE_GENERATION_LIMIT_PAID = 100;

// Boards table
export const boards = pgTable('boards', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('My Loteria Board'),
  isUnlocked: boolean('is_unlocked').notNull().default(false),
  stripePaymentId: text('stripe_payment_id'),
  unlockedAt: timestamp('unlocked_at'),
  imageGenerationsUsed: integer('image_generations_used').notNull().default(0),
  previewUrl: text('preview_url'),
  styleOptions: json('style_options').$type<BoardStyleOptions>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Card status enum values
export type CardStatus = 'pending' | 'processing' | 'completed' | 'error';

// Cards table
export const cards = pgTable('cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  boardId: uuid('board_id')
    .notNull()
    .references(() => boards.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  label: text('label').notNull().default(''),
  riddle: text('riddle'),
  originalImageUrl: text('original_image_url'), // Vercel Blob URL - private
  illustrationUrl: text('illustration_url'), // Vercel Blob URL - private
  status: text('status').$type<CardStatus>().notNull().default('pending'),
  errorMessage: text('error_message'),
  promptOverlay: text('prompt_overlay'),
  isDefault: boolean('is_default').notNull().default(false),
  defaultCardId: text('default_card_id'),
  preserveOriginal: boolean('preserve_original').notNull().default(false),
  cropData: json('crop_data').$type<CropData>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Lifecycle / marketing emails — one row per (user, type). Claim-first for idempotency.
export const lifecycleEmails = pgTable(
  'lifecycle_emails',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    discountCode: text('discount_code'),
    stripePromotionCodeId: text('stripe_promotion_code_id'),
    resendMessageId: text('resend_message_id'),
    status: text('status').notNull().default('pending'), // pending | sent | skipped | failed
    createdAt: timestamp('created_at').defaultNow().notNull(),
    sentAt: timestamp('sent_at'),
  },
  (table) => [unique('lifecycle_emails_user_id_type_unique').on(table.userId, table.type)]
);

// ---------------------------------------------------------------------------
// Live play. See docs/live-play-spec.md and docs/adr/0001, docs/adr/0002.
//
// A `games.board_id` points at a Set — the `boards` table is a Set, legacy
// naming the glossary records and this effort deliberately does not rename.
// ---------------------------------------------------------------------------

/** Which shape wins a Game. Instances are a static table in code, not data. */
export type GamePattern =
  | 'full_board'
  | 'any_row'
  | 'any_column'
  | 'any_diagonal'
  | 'four_corners'
  | 'centre';

export type GameStatus = 'lobby' | 'playing' | 'ended';

/** Why a Game ended, for the result screen a reconnecting Player lands on. */
export type GameEndReason = 'won' | 'deck_exhausted' | 'caller_ended' | 'expired';

export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** The Set this Game is played from. Its owner is the Caller. */
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    /** Six digits. Never reused, so this is unique across all Games forever. */
    code: text('code').notNull(),
    status: text('status').$type<GameStatus>().notNull().default('lobby'),
    pattern: text('pattern').$type<GamePattern>().notNull(),
    joinsLocked: boolean('joins_locked').notNull().default(false),
    /** null means the Caller draws manually. */
    autoAdvanceSeconds: integer('auto_advance_seconds'),
    /**
     * Persisted so auto-advance survives a restart. On boot the timer re-arms
     * at max(this, now + 15s) so it cannot fire into a room still reconnecting.
     */
    nextCallDueAt: timestamp('next_call_due_at'),
    /** Set when the first Win freezes Calls. null in manual mode — the Caller ends it. */
    claimWindowClosesAt: timestamp('claim_window_closes_at'),
    /**
     * Monotonic per Game. Every broadcast every client sees carries it, and so
     * does the snapshot, so a client can tell a stale snapshot from a fresh
     * event. Marks deliberately do NOT bump it — see docs/adr/0002.
     */
    version: integer('version').notNull().default(0),
    endReason: text('end_reason').$type<GameEndReason>(),
    startedAt: timestamp('started_at'),
    endedAt: timestamp('ended_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    unique('games_code_unique').on(table.code),
    /**
     * One active Game per Set. Partial, so ended Games do not block a new one —
     * the rule is "at most one Game that is not ended", not "one ever".
     */
    uniqueIndex('games_one_active_per_set')
      .on(table.boardId)
      .where(sql`status <> 'ended'`),
    index('games_status_idx').on(table.status),
  ]
);

export const gamePlayers = pgTable(
  'game_players',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    /** The seat. Identity is this token, never the nickname. */
    playerToken: text('player_token').notNull(),
    nickname: text('nickname').notNull(),
    /** 16 card ids in display order: position i is grid cell i. */
    boardCardIds: uuid('board_card_ids').array().notNull(),
    /**
     * SHA-256 of the ORDERED card ids. Two Boards are the same only if they
     * hold the same cards in the same positions — positional Patterns are
     * arrangement-sensitive, so a shuffle is a different Board.
     */
    boardKey: text('board_key').notNull(),
    /** Honor-system: recorded without judging, only a Claim is checked. */
    markedCardIds: uuid('marked_card_ids')
      .array()
      .notNull()
      .default(sql`ARRAY[]::uuid[]`),
    /** Drives "12 players · 2 offline". A Player is never dropped from a Game. */
    lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => [
    /**
     * The backstop ADR 0001 asked the database for. The event loop is the
     * arbiter; this exists to turn a second server instance from silently
     * duplicated Boards into a loud constraint violation.
     */
    unique('game_players_board_unique').on(table.gameId, table.boardKey),
    unique('game_players_nickname_unique').on(table.gameId, table.nickname),
    /** Reconnect looks a Player up by their token. */
    unique('game_players_token_unique').on(table.gameId, table.playerToken),
  ]
);

export const gameCalls = pgTable(
  'game_calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    /** 1-based draw order. Wins record which Call they landed on. */
    sequence: integer('sequence').notNull(),
    calledAt: timestamp('called_at').defaultNow().notNull(),
  },
  (table) => [
    /** "A card is called at most once per Game" — the glossary's rule, enforced. */
    unique('game_calls_card_unique').on(table.gameId, table.cardId),
    unique('game_calls_sequence_unique').on(table.gameId, table.sequence),
  ]
);

export const gameWins = pgTable(
  'game_wins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => gamePlayers.id, { onDelete: 'cascade' }),
    /** Which instance of the Pattern completed — e.g. which row. */
    patternInstance: integer('pattern_instance').notNull(),
    /** The Call this Win was verified against. Everyone in one Claim Window shares it. */
    wonOnSequence: integer('won_on_sequence').notNull(),
    wonAt: timestamp('won_at').defaultNow().notNull(),
  },
  (table) => [
    /** Stops a Player winning twice inside the Claim Window. */
    unique('game_wins_player_unique').on(table.gameId, table.playerId),
  ]
);

// Relations
export const userProfilesRelations = relations(userProfiles, ({ many }) => ({
  boards: many(boards),
}));

export const boardsRelations = relations(boards, ({ one, many }) => ({
  userProfile: one(userProfiles, {
    fields: [boards.userId],
    references: [userProfiles.id],
  }),
  cards: many(cards),
}));

export const cardsRelations = relations(cards, ({ one }) => ({
  board: one(boards, {
    fields: [cards.boardId],
    references: [boards.id],
  }),
  userProfile: one(userProfiles, {
    fields: [cards.userId],
    references: [userProfiles.id],
  }),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
  set: one(boards, {
    fields: [games.boardId],
    references: [boards.id],
  }),
  players: many(gamePlayers),
  calls: many(gameCalls),
  wins: many(gameWins),
}));

export const gamePlayersRelations = relations(gamePlayers, ({ one, many }) => ({
  game: one(games, {
    fields: [gamePlayers.gameId],
    references: [games.id],
  }),
  wins: many(gameWins),
}));

export const gameCallsRelations = relations(gameCalls, ({ one }) => ({
  game: one(games, {
    fields: [gameCalls.gameId],
    references: [games.id],
  }),
  card: one(cards, {
    fields: [gameCalls.cardId],
    references: [cards.id],
  }),
}));

export const gameWinsRelations = relations(gameWins, ({ one }) => ({
  game: one(games, {
    fields: [gameWins.gameId],
    references: [games.id],
  }),
  player: one(gamePlayers, {
    fields: [gameWins.playerId],
    references: [gamePlayers.id],
  }),
}));

// Type exports for use in application
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
export type Board = typeof boards.$inferSelect;
export type NewBoard = typeof boards.$inferInsert;
export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type GamePlayer = typeof gamePlayers.$inferSelect;
export type NewGamePlayer = typeof gamePlayers.$inferInsert;
export type GameCall = typeof gameCalls.$inferSelect;
export type NewGameCall = typeof gameCalls.$inferInsert;
export type GameWin = typeof gameWins.$inferSelect;
export type NewGameWin = typeof gameWins.$inferInsert;
