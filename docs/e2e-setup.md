# E2E Testing — One-Time Setup

The E2E suite runs against an ephemeral Neon database branch that is created,
migrated, seeded, used, and destroyed per run. This document captures the
one-time setup the maintainer must complete so both local and CI runs work.

## What you'll create

1. A dedicated Neon project (`loteria-e2e`) with a long-lived `test-base`
   branch.
2. A Neon API key with access to that project.
3. A test user password and a better-auth secret.
4. Eight GitHub Actions repository secrets (five for the test infra + three for Stripe webhook signing).
5. A local `.env.test` file with the same eight values.

## Steps

### 1. Create the Neon project

In the Neon console, create a project named `loteria-e2e`. Note the project id.

### 2. Initialize the schema

In a local checkout, temporarily set DATABASE_URL to the new project's
primary branch connection string and run:

    pnpm db:migrate

Verify the tables exist via `pnpm db:studio` or the Neon SQL editor.

### 3. Create the `test-base` branch

In the Neon console, create a branch named `test-base` from the primary
branch of `loteria-e2e`. Note its branch id.

### 4. Generate a Neon API key

In Neon → Account Settings → Developer settings, create a personal API key
with access to the `loteria-e2e` project. Note the value.

### 5. Generate a test password and an auth secret

    openssl rand -base64 32   # → E2E_TEST_PASSWORD
    openssl rand -hex 32      # → E2E_BETTER_AUTH_SECRET

Store both in a password manager.

### 6. Add GitHub Actions secrets

In `Settings → Secrets and variables → Actions`, add:

- `NEON_API_KEY`
- `NEON_PROJECT_ID`
- `NEON_TEST_BASE_BRANCH_ID`
- `E2E_BETTER_AUTH_SECRET`
- `E2E_TEST_PASSWORD`
- `E2E_STRIPE_SECRET_KEY`
- `E2E_STRIPE_PRICE_ID`
- `E2E_STRIPE_WEBHOOK_SECRET`

### 7. Set up `.env.test` locally

    cp .env.test.example .env.test

Fill in the same eight values.

## Running tests

    pnpm test:e2e

The orchestrator script creates a Neon branch named `e2e-<sha>-<attempt>-<ts>`,
runs migrations, seeds the test user, runs Playwright, and destroys the
branch. On failure, the Playwright HTML report is saved to `playwright-report/`.

## Garbage collection

If a run crashes before destroying its branch, the weekly
`e2e-branch-cleanup.yml` workflow deletes branches matching `e2e-*` older than
1 hour. Manually trigger it via the GitHub Actions UI for an immediate cleanup.

## Stripe webhook signing

The unlock test signs a fake `checkout.session.completed` event and POSTs it
to `/api/stripe/webhook`. To make this work locally and in CI, set these env
vars to **the same values** in both contexts:

- `STRIPE_SECRET_KEY` — any `sk_test_...` value (the SDK validates format on
  init but doesn't call Stripe for webhook handling)
- `STRIPE_PRICE_ID` — any `price_...` value
- `STRIPE_WEBHOOK_SECRET` — any `whsec_...` value

In CI, these are stored as repo secrets (`E2E_STRIPE_SECRET_KEY`,
`E2E_STRIPE_PRICE_ID`, `E2E_STRIPE_WEBHOOK_SECRET`).

Add these secrets to `.env.test` locally under the existing five values.

## Skipping Inngest

Tests set `NEXT_PUBLIC_SKIP_AI_PROCESSING=true` so card uploads complete
synchronously with the original image as the illustration. No Inngest dev
server is required.

## Running individual specs

The orchestrator (`pnpm test:e2e`) currently runs all specs in one Neon branch. Filtering individual specs requires forwarding positional args to Playwright, which `scripts/e2e-run.ts` doesn't yet do. To run a single spec for iteration, edit the script to append `process.argv.slice(2)` to the playwright command, or run Playwright directly after manually setting `DATABASE_URL`.

## Resetting the seeded user's boards

    pnpm e2e:reset

## Local dev server conflict

The orchestrator uses `reuseExistingServer: false` and kills any existing
process on port 3006 before starting (the previous behavior of reusing a
server connected to the wrong DATABASE_URL was silently breaking local runs).
To opt out:

    E2E_SKIP_PORT_FREE=1 pnpm test:e2e
