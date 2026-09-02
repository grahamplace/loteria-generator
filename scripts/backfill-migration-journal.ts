#!/usr/bin/env tsx
/**
 * Backfill drizzle's migration journal for a database that was built with
 * `drizzle-kit push` rather than `migrate`.
 *
 * Why this exists: `push` applies schema changes without recording anything, so
 * `drizzle.__drizzle_migrations` stays empty while the tables are very much
 * there. The first `drizzle-kit migrate` then tries to replay from 0000 and
 * dies on "relation already exists" — with the error swallowed behind a
 * spinner, which is how it goes unnoticed.
 *
 * This marks migrations as applied WITHOUT running their SQL. That is only
 * correct for migrations whose changes are already in the database, so the
 * cutoff is explicit rather than guessed:
 *
 *   pnpm db:journal --through 0011_chief_boomerang          # dry run
 *   pnpm db:journal --through 0011_chief_boomerang --yes    # write
 *
 * Idempotent: a migration already in the journal is left alone.
 *
 * Run it against whichever database you mean — it reads DATABASE_URL like
 * everything else, so check which branch that points at first.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

const MIGRATIONS_DIR = join(process.cwd(), 'db', 'migrations');

type JournalEntry = { idx: number; when: number; tag: string };

const args = process.argv.slice(2);
const through = args[args.indexOf('--through') + 1];
const write = args.includes('--yes');

if (!args.includes('--through') || !through || through.startsWith('--')) {
  process.stderr.write('usage: pnpm db:journal --through <migration-tag> [--yes]\n');
  process.exit(1);
}

const journal: { entries: JournalEntry[] } = JSON.parse(
  readFileSync(join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8')
);

const cutoff = journal.entries.findIndex((e) => e.tag === through);
if (cutoff === -1) {
  process.stderr.write(`no migration tagged "${through}" in the journal\n`);
  process.exit(1);
}

/** Exactly how drizzle-orm hashes a migration: sha256 of the raw file. */
const hashOf = (tag: string) =>
  createHash('sha256')
    .update(readFileSync(join(MIGRATIONS_DIR, `${tag}.sql`), 'utf8'))
    .digest('hex');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? '').host;
  process.stderr.write(`database: ${host}\n`);
  process.stderr.write(`mode    : ${write ? 'WRITE' : 'dry run (pass --yes to apply)'}\n\n`);

  await pool.query('create schema if not exists drizzle');
  await pool.query(
    'create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)'
  );

  const existing = new Set(
    (await pool.query('select hash from drizzle.__drizzle_migrations')).rows.map((r) => r.hash)
  );

  const wanted = journal.entries.slice(0, cutoff + 1);
  const missing = wanted.filter((e) => !existing.has(hashOf(e.tag)));

  process.stderr.write(
    `journal has ${journal.entries.length} migrations; marking through ${through}\n`
  );
  process.stderr.write(`already recorded: ${wanted.length - missing.length}/${wanted.length}\n`);

  if (missing.length === 0) {
    process.stderr.write('nothing to do\n');
    return;
  }

  for (const e of missing) process.stderr.write(`  + ${e.tag}\n`);

  if (!write) {
    process.stderr.write('\ndry run — nothing written. Re-run with --yes.\n');
    return;
  }

  // One transaction: a half-filled journal is worse than an empty one, because
  // `migrate` would then replay from the gap.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const e of missing) {
      await client.query(
        'insert into drizzle.__drizzle_migrations (hash, created_at) values ($1,$2)',
        [hashOf(e.tag), e.when]
      );
    }
    await client.query('COMMIT');
    process.stderr.write(`\nrecorded ${missing.length} migration(s)\n`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    process.stderr.write(`failed: ${(err as Error).message}\n`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
