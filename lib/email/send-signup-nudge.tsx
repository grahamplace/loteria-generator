// lib/email/send-signup-nudge.tsx
import { Resend } from 'resend';
import { SignupNudgeEmail, signupNudgeSubject } from '@/emails/signup-nudge';
import { lifecycleEmailsEnabled } from './guard';
import { isMarketingUnsubscribed } from './unsubscribe';

export async function sendSignupNudgeEmail(params: {
  userId: string;
  to: string;
  name: string;
  locale: 'en' | 'es';
  discountCode: string;
  redeemUrl: string;
  unsubscribeUrl: string;
  unsubscribeOneClickUrl: string;
}): Promise<{ id: string | null; skipped: boolean }> {
  if (!lifecycleEmailsEnabled()) {
    return { id: null, skipped: true };
  }

  // Central opt-out chokepoint: never send marketing email to an unsubscribed user.
  if (await isMarketingUnsubscribed(params.userId)) {
    return { id: null, skipped: true };
  }

  const resend = new Resend(process.env.RESEND_API_KEY!);
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: [params.to],
    subject: signupNudgeSubject(params.locale),
    react: SignupNudgeEmail({
      name: params.name,
      locale: params.locale,
      discountCode: params.discountCode,
      redeemUrl: params.redeemUrl,
      unsubscribeUrl: params.unsubscribeUrl,
    }),
    // RFC 8058 one-click unsubscribe (Gmail/Yahoo bulk-sender requirement). The
    // List-Unsubscribe URL must accept the one-click POST, so it points at the API
    // endpoint, not the human confirmation page.
    headers: {
      'List-Unsubscribe': `<${params.unsubscribeOneClickUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });

  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
  return { id: data?.id ?? null, skipped: false };
}
