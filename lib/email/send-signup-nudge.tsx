// lib/email/send-signup-nudge.tsx
import { Resend } from 'resend';
import { SignupNudgeEmail, signupNudgeSubject } from '@/emails/signup-nudge';
import { lifecycleEmailsEnabled } from './guard';

export async function sendSignupNudgeEmail(params: {
  to: string;
  name: string;
  locale: 'en' | 'es';
  discountCode: string;
  redeemUrl: string;
}): Promise<{ id: string | null; skipped: boolean }> {
  if (!lifecycleEmailsEnabled()) {
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
    }),
  });

  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
  return { id: data?.id ?? null, skipped: false };
}
