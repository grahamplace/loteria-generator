import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';
import * as schema from '@/db/schema';

/**
 * Give every brand-new user a board, immediately.
 *
 * Two layers keep the "never 0 boards" invariant:
 *   1. this hook — a board exists the instant the `user` row does, independent
 *      of which redirect, provider, or client navigation follows signup;
 *   2. the `/start` route — idempotent repair via the same `ensureFirstBoard`,
 *      which also covers users who signed up before this hook existed.
 *
 * `ensureFirstBoard` is loaded dynamically to break a module cycle:
 * `lib/auth` -> `lib/boards/ensure-first-board` -> `lib/admin` -> `lib/auth`
 * (`lib/admin` imports `auth` for `requireAdmin`). A static import would make
 * the `auth` binding uninitialized for whichever module in the cycle loads
 * first — deferring the import to call time sidesteps it entirely.
 *
 * Never throws: better-auth runs `create.after` hooks inline in the signup
 * request and re-throws whatever they throw (verified against better-auth
 * 1.6.9 — `db/with-hooks.mjs` awaits the hook and `context/transaction.mjs`
 * re-raises), so an unguarded failure here would fail signup itself. A missing
 * board is recoverable at `/start`; a failed signup is not.
 */
export async function createFirstBoardForNewUser(user: {
  id: string;
  email: string;
}): Promise<void> {
  try {
    const { ensureFirstBoard } = await import('@/lib/boards/ensure-first-board');
    await ensureFirstBoard({ id: user.id, email: user.email });
  } catch (error) {
    console.error('[auth] failed to create first board for new user', user.id, error);
  }
}

export const auth = betterAuth({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3006',
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Simplified for MVP
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3006'],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await createFirstBoardForNewUser(user);
        },
      },
    },
  },
});

// Export types for use throughout the app
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
