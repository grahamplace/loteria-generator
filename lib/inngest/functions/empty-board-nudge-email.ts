import { eq } from 'drizzle-orm';
import { inngest } from '../client';
import { db, lifecycleEmails } from '@/db';
import { findEmptyBoardNudgeRecipients } from '@/lib/marketing/empty-board-nudge';
import { sendEmptyBoardNudgeEmail } from '@/lib/email/send-empty-board-nudge';
import { isMarketingUnsubscribed, getOrCreateUnsubscribeToken } from '@/lib/email/unsubscribe';
import { getPostHogClient } from '@/lib/posthog-server';
import { LIFECYCLE_EMAIL_TYPE_EMPTY_BOARD_NUDGE } from '@/lib/constants';

/**
 * Hourly nudge for users who signed up, got a board, and never made a card.
 *
 * Parallel to `signupNudgeEmail` but with no Stripe promo code — these users have
 * not tried the product yet, so the ask is to make a first card, not to buy.
 */
export const emptyBoardNudgeEmail = inngest.createFunction(
  {
    id: 'empty-board-nudge-email',
    triggers: [{ cron: '30 * * * *' }],
    retries: 1,
  },
  async ({ step }) => {
    const recipients = await step.run('find-eligible-users', async () =>
      findEmptyBoardNudgeRecipients(new Date())
    );

    let sent = 0;
    let failed = 0;

    for (const r of recipients) {
      const result = await step.run(`process-${r.id}`, async () => {
        // Claim-first: insert before sending so retries can't double-send.
        const claimed = await db
          .insert(lifecycleEmails)
          .values({ userId: r.id, type: LIFECYCLE_EMAIL_TYPE_EMPTY_BOARD_NUDGE, status: 'pending' })
          .onConflictDoNothing({ target: [lifecycleEmails.userId, lifecycleEmails.type] })
          .returning({ id: lifecycleEmails.id });

        if (claimed.length === 0) return { outcome: 'skipped' as const };
        const rowId = claimed[0].id;

        if (await isMarketingUnsubscribed(r.id)) {
          await db
            .update(lifecycleEmails)
            .set({ status: 'skipped', sentAt: new Date() })
            .where(eq(lifecycleEmails.id, rowId));
          return { outcome: 'skipped' as const };
        }

        try {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3006';
          const locale: 'en' | 'es' = r.locale === 'es' ? 'es' : 'en';
          const boardUrl = r.boardId ? `${appUrl}/boards/${r.boardId}` : appUrl;

          const unsubscribeToken = await getOrCreateUnsubscribeToken(r.id);
          const unsubscribeUrl = `${appUrl}/unsubscribe?token=${encodeURIComponent(
            unsubscribeToken
          )}&lang=${locale}`;
          const unsubscribeOneClickUrl = `${appUrl}/api/unsubscribe?token=${encodeURIComponent(
            unsubscribeToken
          )}`;

          const send = await sendEmptyBoardNudgeEmail({
            userId: r.id,
            to: r.email,
            name: r.name,
            locale,
            boardUrl,
            unsubscribeUrl,
            unsubscribeOneClickUrl,
            appUrl,
          });

          await db
            .update(lifecycleEmails)
            .set({
              status: send.skipped ? 'skipped' : 'sent',
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
          properties: { type: LIFECYCLE_EMAIL_TYPE_EMPTY_BOARD_NUDGE, error: result.error },
        });
      }
    }

    if (failed > 0) {
      await getPostHogClient()?.shutdown();
    }

    return { candidates: recipients.length, sent, failed };
  }
);
