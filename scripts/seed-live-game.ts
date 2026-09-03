#!/usr/bin/env tsx
/**
 * Seed a Set that can host a live Game.
 *
 * There is nothing playable in dev otherwise: a Game needs an unlocked Set with
 * more than 16 completed cards, and the dev branch has no Set anywhere near
 * that. Without this you cannot reach the Play button by hand at all.
 *
 *   pnpm seed:live-game                        # attaches to the first user
 *   pnpm seed:live-game --email you@example.com
 *   pnpm seed:live-game --cards 24 --reset
 *
 * Cards are the shipped default illustrations, inserted exactly as
 * `POST /api/boards/:id/cards/defaults` would — same columns, same
 * `illustrationUrl`, same `isDefault`/`defaultCardId` — so the Set behaves like
 * one a person built rather than one that only exists in the database.
 *
 * Idempotent: re-running finds the Set by name and leaves it alone unless
 * --reset is passed. Reads DATABASE_URL like everything else, so check which
 * branch that points at first.
 */
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

import { Pool } from 'pg';
import { DEFAULT_CARDS } from '@/lib/default-cards';
import { MIN_GAME_CARD_COUNT, SMALL_SET_ADVISORY_CARD_COUNT } from '@/lib/constants';

/** Recognisable at a glance in the dashboard, and the key for idempotency. */
const SET_NAME = 'Dev Play Set';

const args = process.argv.slice(2);
const arg = (flag: string) => {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
};
const email = arg('--email');
const reset = args.includes('--reset');

// Above the advisory threshold on purpose: seeding 17 would put every run into
// the "Boards will be nearly identical" warning and hide what a normal Game
// looks like.
const cardCount = Number(arg('--cards') ?? SMALL_SET_ADVISORY_CARD_COUNT);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const log = (s: string) => process.stderr.write(s + '\n');

async function main() {
  log(`database: ${new URL(process.env.DATABASE_URL ?? '').host}`);

  if (cardCount < MIN_GAME_CARD_COUNT) {
    throw new Error(`--cards must be at least ${MIN_GAME_CARD_COUNT} to host a Game`);
  }
  if (cardCount > DEFAULT_CARDS.length) {
    throw new Error(`only ${DEFAULT_CARDS.length} default cards exist`);
  }

  // Schema-qualified: Neon projects also carry a `neon_auth.user` table, and an
  // unqualified name resolves by search_path rather than by intent.
  const user = email
    ? (await pool.query('select id, email from public."user" where email = $1', [email])).rows[0]
    : (await pool.query('select id, email from public."user" order by created_at limit 1')).rows[0];

  if (!user) throw new Error(email ? `no user with email ${email}` : 'no users in this database');
  log(`owner   : ${user.email}`);

  const existing = (
    await pool.query('select id from boards where user_id = $1 and name = $2', [user.id, SET_NAME])
  ).rows[0];

  if (existing && !reset) {
    const n = (
      await pool.query(
        "select count(*)::int c from cards where board_id = $1 and status = 'completed'",
        [existing.id]
      )
    ).rows[0].c;
    log(`\n"${SET_NAME}" already exists with ${n} completed cards — nothing to do.`);
    log('Pass --reset to rebuild it.');
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (existing) {
      // Games reference the Set; drop them first or the delete is refused.
      await client.query('delete from games where board_id = $1', [existing.id]);
      await client.query('delete from cards where board_id = $1', [existing.id]);
      await client.query('delete from boards where id = $1', [existing.id]);
      log('removed the previous Dev Play Set');
    }

    const setId = (
      await client.query(
        'insert into boards (user_id, name, is_unlocked, unlocked_at) values ($1,$2,true,now()) returning id',
        [user.id, SET_NAME]
      )
    ).rows[0].id;

    for (const [i, card] of DEFAULT_CARDS.slice(0, cardCount).entries()) {
      await client.query(
        `insert into cards
           (board_id, user_id, number, label, original_image_url, illustration_url,
            status, is_default, default_card_id)
         values ($1,$2,$3,$4,null,$5,'completed',true,$6)`,
        [setId, user.id, i + 1, card.label, card.src, card.id]
      );
    }

    await client.query('COMMIT');
    log(`\ncreated "${SET_NAME}" — unlocked, ${cardCount} completed cards`);
    log(`set id  : ${setId}`);
    log(`\nSign in as ${user.email} and it will be on the dashboard.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    log(`failed: ${(err as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
