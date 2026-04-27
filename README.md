# Loteria Generator

AI-powered Loteria board generator. Upload photos, get traditional Loteria-style illustrations with Spanish labels, and create printable bingo boards.

## Tech Stack

- **Framework**: Next.js 16 + React 19 + TypeScript
- **Database**: Neon (serverless Postgres) + Drizzle ORM
- **Auth**: Better Auth (email/password + Google OAuth)
- **Payments**: Stripe Checkout ($5 one-time board unlock)
- **Storage**: Vercel Blob
- **AI**: OpenAI API (DALL-E for illustrations, GPT for labels)
- **UI**: Tailwind CSS v4 + shadcn/ui

## Prerequisites

- Node.js 20.17+
- pnpm 9+
- A [Neon](https://neon.tech) database (free tier works)
- A [Stripe](https://stripe.com) account
- A [Vercel](https://vercel.com) account (for Blob storage)
- An [OpenAI](https://platform.openai.com) API key

## Getting Started

### 1. Clone and Install

```bash
git clone <repo-url>
cd loteria-generator-app
pnpm install
```

### 2. Environment Variables

Copy the example env file:

```bash
cp .env.example .env.local
```

Fill in your values:

```bash
# Database (from Neon dashboard)
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"

# Better Auth
BETTER_AUTH_SECRET="generate-a-random-string-here"
BETTER_AUTH_URL="http://localhost:3000"

# Google OAuth (optional - for social login)
# Create at https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Vercel Blob
# Create at https://vercel.com/dashboard/stores
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."

# Stripe (from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."  # See Stripe section below

# OpenAI
OPENAI_API_KEY="sk-proj-..."

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Skip AI processing in dev (uses placeholder images/labels)
NEXT_PUBLIC_SKIP_AI_PROCESSING="true"
```

### 3. Database Setup

Push the schema to your Neon database:

```bash
pnpm db:push
```

To explore your data:

```bash
pnpm db:studio
```

### 4. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stripe Setup

### Getting API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Copy **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. Copy **Secret key** → `STRIPE_SECRET_KEY`

### Webhooks in Development

The app uses Stripe webhooks to unlock boards after payment. In development, you have two options:

#### Option A: Skip Webhooks (Recommended for most dev work)

Don't set up webhooks. After a test payment:

1. The checkout completes but the board won't auto-unlock
2. Manually unlock in Drizzle Studio:
   ```bash
   pnpm db:studio
   ```
3. Find your board and set `isUnlocked` to `true`

Set `STRIPE_WEBHOOK_SECRET` to any placeholder value (e.g., `whsec_placeholder`).

#### Option B: Full Webhook Flow

For end-to-end payment testing:

1. Install Stripe CLI:

   ```bash
   brew install stripe/stripe-cli/stripe
   ```

2. Login to Stripe:

   ```bash
   stripe login
   ```

3. Forward webhooks to localhost (run in a separate terminal):

   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

4. Copy the webhook signing secret it outputs and set as `STRIPE_WEBHOOK_SECRET`

5. Restart your dev server to pick up the new secret

6. Keep the Stripe CLI terminal running while testing payments

**Important:** The webhook secret changes every time you restart `stripe listen`. You'll need to update `.env.local` and restart your dev server each time.

### Testing Payments with Test Cards

When testing the checkout flow, use Stripe's test card numbers. **Never use real card details** — the Stripe Services Agreement prohibits testing with real payment methods.

To complete a test payment:

1. Use a test card number (see below)
2. Use any valid future date (e.g., `12/34`)
3. Use any 3-digit CVC (e.g., `123`)
4. Use any value for other fields (name, zip, etc.)

| Scenario                | Card Number           |
| ----------------------- | --------------------- |
| Successful payment      | `4242 4242 4242 4242` |
| Card declined           | `4000 0000 0000 0002` |
| Requires authentication | `4000 0025 0000 3155` |
| Insufficient funds      | `4000 0000 0000 9995` |

## Testing

Run all tests:

```bash
pnpm test
```

Watch mode:

```bash
pnpm test:watch
```

Run a single test file:

```bash
pnpm exec vitest run __tests__/lib/utils.test.ts
```

## Available Commands

| Command            | Description              |
| ------------------ | ------------------------ |
| `pnpm dev`         | Start development server |
| `pnpm build`       | Production build         |
| `pnpm start`       | Start production server  |
| `pnpm lint`        | Run ESLint               |
| `pnpm lint:fix`    | Fix ESLint issues        |
| `pnpm typecheck`   | TypeScript type checking |
| `pnpm test`        | Run tests                |
| `pnpm test:watch`  | Run tests in watch mode  |
| `pnpm db:push`     | Push schema to database  |
| `pnpm db:studio`   | Open Drizzle Studio      |
| `pnpm db:generate` | Generate migrations      |
| `pnpm db:migrate`  | Run migrations           |

## Project Structure

```
app/
├── (auth)/              # Sign-in/sign-up pages
├── api/
│   ├── auth/            # Better Auth handler
│   ├── boards/          # Board & card CRUD
│   ├── generate-image/  # AI illustration generation
│   ├── generate-label/  # AI label generation
│   ├── images/          # Auth-gated image proxy
│   └── stripe/          # Checkout & webhook
├── boards/[boardId]/    # Board editor
├── dashboard/           # Board list
└── page.tsx             # Landing page

components/              # React components
db/                      # Drizzle schema & client
hooks/                   # React hooks
lib/                     # Utilities (auth, stripe, blob)
```

## Features by Plan

| Feature           | Free    | Unlocked ($5) |
| ----------------- | ------- | ------------- |
| Cards per board   | 16      | 54            |
| Board generations | 1       | Unlimited     |
| AI illustrations  | Yes     | Yes           |
| Export options    | Limited | All           |

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import in [Vercel](https://vercel.com/new)
3. Add environment variables (use production keys for Stripe)
4. Set up Stripe webhook:
   - Endpoint: `https://your-domain.vercel.app/api/stripe/webhook`
   - Events: `checkout.session.completed`

### Environment Variables for Production

Use live Stripe keys (`sk_live_...`, `pk_live_...`) and set up a real webhook endpoint in the Stripe dashboard pointing to your production URL.

## Troubleshooting

### "Card limit reached" error

The board is at capacity. Unlock it ($5) or delete some cards.

### Payments complete but board not unlocked

Webhook isn't configured. Either:

- Run Stripe CLI locally (Option B above)
- Manually set `isUnlocked = true` in Drizzle Studio

### AI generation not working

- Check `OPENAI_API_KEY` is set correctly
- Ensure you have API credits
- Set `NEXT_PUBLIC_SKIP_AI_PROCESSING=true` to bypass AI in dev

### Database connection errors

- Verify `DATABASE_URL` is correct
- Check Neon dashboard for connection issues
- Ensure SSL is enabled (`?sslmode=require`)
