import { after } from 'next/server';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { oAuthProxy } from 'better-auth/plugins';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { sendPasswordResetEmail } from '@/lib/email/send-password-reset';
import { assertSignUpEmailIsAvailable } from '@/lib/signup-enumeration-guard';

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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3006';

/**
 * Vercel previews get a new hostname per deployment and branch, and Google only
 * accepts the production callback URL. So previews hand Google sign-in to
 * production via the OAuth proxy: production completes the exchange and sends
 * the encrypted profile back to the preview, which creates the user and session
 * in its own database. Production and localhost sign in directly as before.
 */
const isPreview = process.env.VERCEL_ENV === 'preview';
const PRODUCTION_URL = 'https://loteriagenerator.com';
// Matches this project's deployment and branch URLs, and nothing else on vercel.app.
const PREVIEW_HOST = 'loteria-generator-*-stonecutter-labs.vercel.app';

export const auth = betterAuth({
  // Previews resolve their own origin per request, limited to PREVIEW_HOST.
  baseURL: isPreview ? { allowedHosts: [PREVIEW_HOST], protocol: 'https' } : APP_URL,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Simplified for MVP
    // Short-lived by design: a reset link sitting in an inbox is a standing key
    // to the account.
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour, in seconds
    // A reset is how you recover a compromised account, so every other session
    // has to go with it. Note the 5-minute cookieCache below still lets a
    // stolen session ride for up to that long after a reset — this only
    // guarantees the session *rows* are gone, not that every cached cookie
    // stops working instantly.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({ to: user.email, name: user.name, url });
    },
  },
  advanced: {
    backgroundTasks: {
      // Without this, better-auth awaits sendResetPassword (and therefore the
      // Resend HTTP call) before responding. That makes the request-reset
      // endpoint slower for a known email than an unknown one, leaking account
      // existence through response timing. Handing the promise to Next's
      // after() lets the response return immediately while the email still
      // sends in the background.
      handler: (promise: Promise<unknown>) => after(promise),
    },
  },
  hooks: {
    // `hooks.before` is a single global middleware in better-auth 1.6.9 — it runs
    // for every endpoint, so filter by path (dist/api/to-auth-endpoints.mjs:268).
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-up/email') return;
      const body = ctx.body as { email?: unknown } | undefined;
      await assertSignUpEmailIsAvailable(body?.email, (email) =>
        ctx.context.internalAdapter.findUserByEmail(email)
      );
    }),
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  session: {
    // Sliding window: any session check more than `updateAge` after the last
    // refresh pushes expiry `expiresIn` out again, in the DB row and the cookie.
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  rateLimit: {
    customRules: {
      // Cheap brake on mailbox-flooding someone else's address. better-auth's
      // default storage is in-memory, so on serverless this counts per
      // instance rather than globally; the durable fix is `storage: 'database'`,
      // which needs a migration against the shared production database.
      //
      // NOTE: the installed better-auth (1.6.9) renamed this endpoint from
      // `/forget-password` (used by the task brief, written against 1.4.17)
      // to `/request-password-reset`. Confirmed against
      // node_modules/better-auth/dist/api/routes/password.mjs — `/forget-password`
      // is dead code in this version (404s) and only remains as an email-otp
      // plugin path we don't use.
      '/request-password-reset': { window: 300, max: 3 },
    },
  },
  // Production must trust previews so it can send proxied sign-ins back to them.
  trustedOrigins: [APP_URL, `https://${PREVIEW_HOST}`],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await createFirstBoardForNewUser(user);
        },
      },
    },
  },
  // Most session checks run server-side (route handlers, server actions), where
  // better-auth can't write cookies on its own. Without this plugin a refresh
  // extended the DB row but not the cookie, so the browser still dropped the
  // cookie `expiresIn` after sign-in. Must stay last in `plugins`.
  plugins: [
    oAuthProxy({
      // Outside previews this is the app's own URL, which turns the proxy off.
      productionURL: isPreview ? PRODUCTION_URL : APP_URL,
      // Shared by production and previews only; never the session secret.
      secret: process.env.OAUTH_PROXY_SECRET,
    }),
    nextCookies(),
  ],
});

// Export types for use throughout the app
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
