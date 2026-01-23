import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  json,
  uuid,
  pgSchema,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Reference to Neon Auth schema (managed by Neon Auth)
// We don't create this - it's created automatically when you enable Neon Auth
export const neonAuthSchema = pgSchema('neon_auth');

// Reference to the users table in neon_auth schema
export const neonAuthUsers = neonAuthSchema.table('users_sync', {
  id: uuid('id').primaryKey(),
  email: text('email'),
  name: text('name'),
  image: text('image'),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

// User profiles - our extension of neon_auth users
export const userProfiles = pgTable('user_profiles', {
  id: uuid('id')
    .primaryKey()
    .references(() => neonAuthUsers.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Board style options type
export interface BoardStyleOptions {
  backgroundColor?: string;
  cardBorderColor?: string;
  badgeColor?: string;
  labelColor?: string;
}

// Boards table
export const boards = pgTable('boards', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => neonAuthUsers.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('My Loteria Board'),
  isUnlocked: boolean('is_unlocked').notNull().default(false),
  stripePaymentId: text('stripe_payment_id'),
  unlockedAt: timestamp('unlocked_at'),
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
  userId: uuid('user_id')
    .notNull()
    .references(() => neonAuthUsers.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  label: text('label').notNull().default(''),
  originalImageUrl: text('original_image_url'), // Vercel Blob URL - private
  illustrationUrl: text('illustration_url'), // Vercel Blob URL - private
  status: text('status').$type<CardStatus>().notNull().default('pending'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

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

// Type exports for use in application
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
export type Board = typeof boards.$inferSelect;
export type NewBoard = typeof boards.$inferInsert;
export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
