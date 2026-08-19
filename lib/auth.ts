import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { sendPasswordResetEmail } from '@/lib/email/send-password-reset';

export const auth = betterAuth({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3006',
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
    // has to go with it.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({ to: user.email, name: user.name, url });
    },
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
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3006'],
});

// Export types for use throughout the app
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
