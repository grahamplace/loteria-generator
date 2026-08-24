// lib/email/send-campaign.tsx
import { getCampaignTemplate } from '@/lib/email/campaigns/registry';
import { lifecycleEmailsEnabled } from './guard';
import { isMarketingUnsubscribed } from './unsubscribe';
import { sendEmail } from './resend';

export async function sendCampaignEmail(params: {
  templateKey: string;
  userId: string;
  to: string;
  name: string;
  locale: 'en' | 'es';
  appUrl: string;
  unsubscribeUrl: string;
  unsubscribeOneClickUrl: string;
  discountCode?: string;
  redeemUrl?: string;
  boardUrl: string;
}): Promise<{ id: string | null; skipped: boolean }> {
  const template = getCampaignTemplate(params.templateKey);
  if (!template) {
    throw new Error(`Unknown campaign template: ${params.templateKey}`);
  }

  if (!lifecycleEmailsEnabled()) {
    return { id: null, skipped: true };
  }

  // Central opt-out chokepoint: never send marketing email to an unsubscribed user.
  if (await isMarketingUnsubscribed(params.userId)) {
    return { id: null, skipped: true };
  }

  const { id } = await sendEmail({
    to: params.to,
    // Templates whose copy invites a reply declare where it should land; the rest
    // fall through to `EMAIL_FROM`.
    ...(template.replyTo ? { replyTo: template.replyTo } : {}),
    subject: template.subject(params.locale),
    react: template.render({
      name: params.name,
      locale: params.locale,
      appUrl: params.appUrl,
      unsubscribeUrl: params.unsubscribeUrl,
      discountCode: params.discountCode,
      redeemUrl: params.redeemUrl,
      boardUrl: params.boardUrl,
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
