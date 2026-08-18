// lib/email/send-empty-board-nudge.tsx
import { EmptyBoardNudgeEmail, emptyBoardNudgeSubject } from '@/emails/empty-board-nudge';
import { SUPPORT_REPLY_TO_EMAIL } from '@/lib/constants';
import { lifecycleEmailsEnabled } from './guard';
import { isMarketingUnsubscribed } from './unsubscribe';
import { sendEmail } from './resend';

export async function sendEmptyBoardNudgeEmail(params: {
  userId: string;
  to: string;
  name: string;
  locale: 'en' | 'es';
  boardUrl: string;
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
    subject: emptyBoardNudgeSubject(params.locale),
    // The email asks people to reply with questions, so replies have to reach a
    // human rather than the no-reply sending address.
    replyTo: SUPPORT_REPLY_TO_EMAIL,
    react: EmptyBoardNudgeEmail({
      name: params.name,
      locale: params.locale,
      boardUrl: params.boardUrl,
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
