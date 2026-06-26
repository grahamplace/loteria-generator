import { eq } from 'drizzle-orm';
import { inngest } from '../client';
import { db, lifecycleEmails } from '@/db';
import { findSignupNudgeRecipients } from '@/lib/marketing/signup-nudge';
import { generateDiscountCode } from '@/lib/email/discount-code';
import { createOneTimePromotionCode } from '@/lib/stripe-promotions';
import { sendSignupNudgeEmail } from '@/lib/email/send-signup-nudge';
import { isMarketingUnsubscribed, getOrCreateUnsubscribeToken } from '@/lib/email/unsubscribe';
import { getPostHogClient } from '@/lib/posthog-server';
import { LIFECYCLE_EMAIL_TYPE_SIGNUP_NUDGE, SIGNUP_NUDGE_EXPIRY_DAYS } from '@/lib/constants';

const DAY_MS = 24 * 60 * 60 * 1000;

export const signupNudgeEmail = inngest.createFunction(
  {
    id: 'signup-nudge-email',
    triggers: [{ cron: '0 * * * *' }],
    retries: 1,
  },
  async ({ step }) => {
    const recipients = await step.run('find-eligible-users', async () =>
      findSignupNudgeRecipients(new Date())
    );

    let sent = 0;
    let failed = 0;

    for (const r of recipients) {
      const result = await step.run(`process-${r.id}`, async () => {
        // Claim-first: insert before sending so retries can't double-send.
        const claimed = await db
          .insert(lifecycleEmails)
          .values({ userId: r.id, type: LIFECYCLE_EMAIL_TYPE_SIGNUP_NUDGE, status: 'pending' })
          .onConflictDoNothing({ target: [lifecycleEmails.userId, lifecycleEmails.type] })
          .returning({ id: lifecycleEmails.id });

        if (claimed.length === 0) return { outcome: 'skipped' as const };
        const rowId = claimed[0].id;

        // Respect marketing opt-out before spending a Stripe promo code on them.
        if (await isMarketingUnsubscribed(r.id)) {
          await db
            .update(lifecycleEmails)
            .set({ status: 'skipped', sentAt: new Date() })
            .where(eq(lifecycleEmails.id, rowId));
          return { outcome: 'skipped' as const };
        }

        try {
          const code = generateDiscountCode();
          const expiresAt = new Date(Date.now() + SIGNUP_NUDGE_EXPIRY_DAYS * DAY_MS);
          const promo = await createOneTimePromotionCode({ code, expiresAt });

          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3006';
          const redeemUrl = `${appUrl}/redeem?code=${encodeURIComponent(code)}${
            r.boardId ? `&boardId=${encodeURIComponent(r.boardId)}` : ''
          }`;
          const locale: 'en' | 'es' = r.locale === 'es' ? 'es' : 'en';

          const unsubscribeToken = await getOrCreateUnsubscribeToken(r.id);
          const unsubscribeUrl = `${appUrl}/unsubscribe?token=${encodeURIComponent(
            unsubscribeToken
          )}&lang=${locale}`;
          const unsubscribeOneClickUrl = `${appUrl}/api/unsubscribe?token=${encodeURIComponent(
            unsubscribeToken
          )}`;

          const send = await sendSignupNudgeEmail({
            userId: r.id,
            to: r.email,
            name: r.name,
            locale,
            discountCode: code,
            redeemUrl,
            unsubscribeUrl,
            unsubscribeOneClickUrl,
            appUrl,
          });

          await db
            .update(lifecycleEmails)
            .set({
              status: send.skipped ? 'skipped' : 'sent',
              discountCode: code,
              stripePromotionCodeId: promo.id,
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
          properties: { type: LIFECYCLE_EMAIL_TYPE_SIGNUP_NUDGE, error: result.error },
        });
      }
    }

    if (failed > 0) {
      await getPostHogClient()?.shutdown();
    }

    return { candidates: recipients.length, sent, failed };
  }
);
