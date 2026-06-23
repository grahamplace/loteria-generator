// lib/email/send-campaign.tsx
import { Resend } from 'resend';
import { getCampaignTemplate } from '@/lib/email/campaigns/registry';
import { lifecycleEmailsEnabled } from './guard';
import { isMarketingUnsubscribed } from './unsubscribe';

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

  const resend = new Resend(process.env.RESEND_API_KEY!);
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: [params.to],
    subject: template.subject(params.locale),
    react: template.render({
      name: params.name,
      locale: params.locale,
      appUrl: params.appUrl,
      unsubscribeUrl: params.unsubscribeUrl,
      discountCode: params.discountCode,
      redeemUrl: params.redeemUrl,
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
