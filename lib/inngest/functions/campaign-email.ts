import { eq } from 'drizzle-orm';
import { inngest } from '../client';
import { campaignEmailRequested } from '../events';
import { db, lifecycleEmails } from '@/db';
import { getCampaignRecipients } from '@/lib/marketing/campaign-recipients';
import { getCampaignTemplate } from '@/lib/email/campaigns/registry';
import { generateDiscountCode } from '@/lib/email/discount-code';
import { createOneTimePromotionCode } from '@/lib/stripe-promotions';
import { sendCampaignEmail } from '@/lib/email/send-campaign';
import { isMarketingUnsubscribed, getOrCreateUnsubscribeToken } from '@/lib/email/unsubscribe';
import { getPostHogClient } from '@/lib/posthog-server';

const DAY_MS = 24 * 60 * 60 * 1000;

export const campaignEmail = inngest.createFunction(
  {
    id: 'campaign-email',
    triggers: [campaignEmailRequested],
    retries: 1,
  },
  async ({ step, event }) => {
    const { templateKey, userIds } = event.data;

    const template = getCampaignTemplate(templateKey);
    if (!template) {
      return { candidates: 0, sent: 0, failed: 0, error: 'unknown template' };
    }

    const recipients = await step.run('load-recipients', () => getCampaignRecipients(userIds));

    let sent = 0;
    let failed = 0;

    for (const r of recipients) {
      const result = await step.run(`process-${r.id}`, async () => {
        // Claim-first: insert before sending so retries can't double-send.
        const claimed = await db
          .insert(lifecycleEmails)
          .values({ userId: r.id, type: templateKey, status: 'pending' })
          .onConflictDoNothing({ target: [lifecycleEmails.userId, lifecycleEmails.type] })
          .returning({ id: lifecycleEmails.id });

        if (claimed.length === 0) return { outcome: 'skipped - claimed' as const };
        const rowId = claimed[0].id;

        // Respect marketing opt-out before spending a Stripe promo code on them.
        if (await isMarketingUnsubscribed(r.id)) {
          await db
            .update(lifecycleEmails)
            .set({ status: 'skipped', sentAt: new Date() })
            .where(eq(lifecycleEmails.id, rowId));
          return { outcome: 'skipped - unsubscribed' as const };
        }

        try {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3006';
          const locale: 'en' | 'es' = r.locale === 'es' ? 'es' : 'en';
          // Templates that deep-link into the product need somewhere to point.
          // With no board, `/start` creates one and lands them in it — never the
          // empty dashboard.
          const boardUrl = r.boardId ? `${appUrl}/boards/${r.boardId}` : `${appUrl}/start`;

          const unsubscribeToken = await getOrCreateUnsubscribeToken(r.id);
          const unsubscribeUrl = `${appUrl}/unsubscribe?token=${encodeURIComponent(
            unsubscribeToken
          )}&lang=${locale}`;
          const unsubscribeOneClickUrl = `${appUrl}/api/unsubscribe?token=${encodeURIComponent(
            unsubscribeToken
          )}`;

          let discountCode: string | undefined;
          let redeemUrl: string | undefined;
          let promoId: string | null = null;

          if (template.discount) {
            const code = generateDiscountCode();
            const expiresAt = new Date(Date.now() + template.discount.expiryDays * DAY_MS);
            const couponId = await template.discount.ensureCoupon();
            const promo = await createOneTimePromotionCode({ code, expiresAt, couponId });
            discountCode = code;
            promoId = promo.id;
            redeemUrl = `${appUrl}/redeem?code=${encodeURIComponent(code)}`;
          }

          const send = await sendCampaignEmail({
            templateKey,
            userId: r.id,
            to: r.email,
            name: r.name,
            locale,
            appUrl,
            unsubscribeUrl,
            unsubscribeOneClickUrl,
            discountCode,
            redeemUrl,
            boardUrl,
          });

          await db
            .update(lifecycleEmails)
            .set({
              status: send.skipped ? 'skipped' : 'sent',
              discountCode: discountCode ?? null,
              stripePromotionCodeId: promoId,
              resendMessageId: send.id,
              sentAt: new Date(),
            })
            .where(eq(lifecycleEmails.id, rowId));

          return { outcome: send.skipped ? ('skipped' as const) : ('sent' as const) };
        } catch (err) {
          await db
            .update(lifecycleEmails)
            .set({ status: 'failed' })
            .where(eq(lifecycleEmails.id, rowId));
          return { outcome: 'failed' as const, error: (err as Error).message, userId: r.id };
        }
      });

      if (result.outcome === 'sent') sent++;
      if (result.outcome === 'failed') {
        failed++;
        const posthog = getPostHogClient();
        posthog?.capture({
          distinctId: r.id,
          event: 'lifecycle_email_failed',
          properties: { type: templateKey, error: result.error },
        });
      }
    }

    if (failed > 0) {
      await getPostHogClient()?.shutdown();
    }

    return { candidates: recipients.length, sent, failed };
  }
);
