// lib/email/send-signup-nudge.tsx
import { SignupNudgeEmail, signupNudgeSubject } from '@/emails/signup-nudge';
import { lifecycleEmailsEnabled } from './guard';
import { isMarketingUnsubscribed } from './unsubscribe';
import { sendEmail } from './resend';

export async function sendSignupNudgeEmail(params: {
  userId: string;
  to: string;
  name: string;
  locale: 'en' | 'es';
  discountCode: string;
  redeemUrl: string;
  unsubscribeUrl: string;
  unsubscribeOneClickUrl: string;
  appUrl: string;
}): Promise<{ id: string | null; skipped: boolean }> {
  if (!lifecycleEmailsEnabled()) {
    return { id: null, skipped: true };
  }

  // Central opt-out chokepoint: never send marketing email to an unsubscribed user.
  if (await isMarketingUnsubscribed(params.userId)) {
    return { id: null, skipped: true };
  }

  const { id } = await sendEmail({
    to: params.to,
    subject: signupNudgeSubject(params.locale),
    react: SignupNudgeEmail({
      name: params.name,
      locale: params.locale,
      discountCode: params.discountCode,
      redeemUrl: params.redeemUrl,
      unsubscribeUrl: params.unsubscribeUrl,
      appUrl: params.appUrl,
    }),
    // RFC 8058 one-click unsubscribe (Gmail/Yahoo bulk-sender requirement). The
    // List-Unsubscribe URL must accept the one-click POST, so it points at the API
    // endpoint, not the human confirmation page.
    headers: {
      'List-Unsubscribe': `<${params.unsubscribeOneClickUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });

  return { id, skipped: false };
}
