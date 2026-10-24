/**
 * Fills amount paid / discount / currency / promotion code / refunds on boards
 * unlocked before the webhook started saving them.
 *
 * Usage:
 *   DATABASE_URL=… STRIPE_SECRET_KEY=… pnpm backfill:payments [--dry-run]
 *
 * DATABASE_URL and STRIPE_SECRET_KEY must point at the same environment:
 * dev DB + test-mode key, or prod DB (.env.personal) + live-mode key.
 * Idempotent: only touches boards whose amount_paid_cents is still null.
 */

import { neon } from '@neondatabase/serverless';
import Stripe from 'stripe';
import { SESSION_DISCOUNT_EXPAND, paymentFieldsFromSession } from '../../lib/stripe';

const dryRun = process.argv.includes('--dry-run');

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const sql = neon(requireEnv('DATABASE_URL'));
const stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'));

async function main() {
  const rows = (await sql`
    select id, name, stripe_payment_id
    from boards
    where stripe_payment_id is not null and amount_paid_cents is null
    order by unlocked_at
  `) as { id: string; name: string; stripe_payment_id: string }[];

  console.log(`${rows.length} paid boards missing payment details${dryRun ? ' (dry run)' : ''}`);

  let updated = 0;
  for (const row of rows) {
    const sessions = await stripe.checkout.sessions.list({
      payment_intent: row.stripe_payment_id,
      limit: 1,
    });
    const session = sessions.data[0];
    if (!session) {
      console.warn(`  ${row.id} (${row.name}): no checkout session for ${row.stripe_payment_id}`);
      continue;
    }

    // List results can't expand this deep, so re-fetch the one session.
    const fields = paymentFieldsFromSession(
      await stripe.checkout.sessions.retrieve(session.id, { expand: [SESSION_DISCOUNT_EXPAND] })
    );
    const charges = await stripe.charges.list({ payment_intent: row.stripe_payment_id, limit: 10 });
    const refunded = charges.data.reduce((sum, c) => sum + c.amount_refunded, 0);

    console.log(
      `  ${row.id} (${row.name}): paid ${fields.amountPaidCents} ${fields.currency}` +
        `, discount ${fields.amountDiscountCents}, code ${fields.promotionCode ?? '-'}` +
        `, refunded ${refunded}`
    );

    if (!dryRun) {
      await sql`
        update boards set
          amount_paid_cents = ${fields.amountPaidCents},
          amount_discount_cents = ${fields.amountDiscountCents},
          currency = ${fields.currency},
          promotion_code = ${fields.promotionCode},
          amount_refunded_cents = ${refunded}
        where id = ${row.id} and amount_paid_cents is null
      `;
      updated++;
    }
  }

  console.log(dryRun ? 'Dry run: nothing written.' : `Updated ${updated} boards.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
