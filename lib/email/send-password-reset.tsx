// lib/email/send-password-reset.tsx
//
// Password reset is TRANSACTIONAL, and deliberately does not go through the
// lifecycle-email machinery:
//   * no `isMarketingUnsubscribed` check — an unsubscribed user must still be
//     able to get back into their account;
//   * no `lifecycleEmailsEnabled()` guard — that requires an opt-in env var
//     outside production, which would silently break password recovery on
//     preview deploys;
//   * no `lifecycle_emails` row — that table backs the admin marketing view.
import { PasswordResetEmail, passwordResetSubject } from '@/emails/password-reset';
import { SUPPORT_REPLY_TO_EMAIL } from '@/lib/constants';
import { localeFromResetUrl } from './reset-locale';
import { sendEmail, isProductionEmailEnv } from './resend';

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  /** better-auth's composed reset URL, token included. */
  url: string;
}): Promise<{ id: string | null; skipped: boolean }> {
  // Outside production `sendEmail` rewrites every recipient to Resend's test
  // inbox, so the only way to actually follow the link in dev is the log.
  if (!isProductionEmailEnv()) {
    console.info('[password-reset] reset url for %s: %s', params.to, params.url);
  }

  if (!process.env.RESEND_API_KEY) {
    return { id: null, skipped: true };
  }

  const locale = localeFromResetUrl(params.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3006';

  const { id } = await sendEmail({
    to: params.to,
    subject: passwordResetSubject(locale),
    replyTo: SUPPORT_REPLY_TO_EMAIL,
    react: PasswordResetEmail({
      name: params.name,
      locale,
      resetUrl: params.url,
      appUrl,
    }),
  });

  return { id, skipped: false };
}
