# E2E Testing — One-Time Setup

The E2E suite runs against an ephemeral Neon database branch that is created,
migrated, seeded, used, and destroyed per run. This document captures the
one-time setup the maintainer must complete so both local and CI runs work.

## What you'll create

1. A dedicated Neon project (`loteria-e2e`) with a long-lived `test-base`
   branch.
2. A Neon API key with access to that project.
3. A test user password and a better-auth secret.
4. Five GitHub Actions repository secrets.
5. A local `.env.test` file with the same five values.

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

### 7. Set up `.env.test` locally

    cp .env.test.example .env.test

Fill in the same five values.

## Running tests

    pnpm test:e2e

The orchestrator script creates a Neon branch named `e2e-<sha>-<attempt>-<ts>`,
runs migrations, seeds the test user, runs Playwright, and destroys the
branch. On failure, the Playwright HTML report is saved to `playwright-report/`.

## Garbage collection

If a run crashes before destroying its branch, the weekly
`e2e-branch-cleanup.yml` workflow deletes branches matching `e2e-*` older than
1 hour. Manually trigger it via the GitHub Actions UI for an immediate cleanup.
