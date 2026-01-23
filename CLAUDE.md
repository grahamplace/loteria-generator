# Loteria Generator

AI-powered Loteria board generator SaaS. Users upload photos, AI generates traditional Loteria-style illustrations with Spanish labels, and creates printable bingo boards.

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run typecheck    # TypeScript check
npm run test         # Run all tests
npm run test:watch   # Watch mode
vitest run path/to/file.test.ts  # Single test file

# Database
npm run db:generate  # Generate migrations from schema
npm run db:migrate   # Run migrations
npm run db:push      # Push schema directly (dev only)
npm run db:studio    # Open Drizzle Studio
```

## Architecture

### Stack

- **Framework**: Next.js 16 + React 19 + TypeScript
- **Database**: Neon (serverless Postgres) + Drizzle ORM
- **Auth**: Better Auth (email/password + Google OAuth)
- **Payments**: Stripe Checkout (one-time $5 board unlock)
- **Storage**: Vercel Blob (private image storage)
- **AI**: OpenAI API (image generation + label generation)
- **UI**: Tailwind CSS v4 + shadcn/ui + Radix primitives

### Key Directories

```
app/
├── (auth)/          # Sign-in/sign-up pages
├── api/             # API routes
│   ├── auth/        # Better Auth handler
│   ├── boards/      # Board CRUD + cards
│   ├── images/      # Auth-gated image proxy
│   ├── stripe/      # Checkout + webhook
│   └── generate-*/  # AI generation endpoints
├── boards/[boardId] # Board editor
└── dashboard/       # Board list

db/
├── schema.ts        # Drizzle schema (userProfiles, boards, cards)
└── index.ts         # Database client

lib/
├── auth.ts          # Better Auth server config
├── auth-client.ts   # Client auth hooks
├── blob.ts          # Vercel Blob utilities
└── stripe.ts        # Stripe client + checkout

hooks/
├── use-session.ts   # Auth session hook
├── use-boards.ts    # Board management
└── use-board-cards.ts # Card CRUD with optimistic updates
```

### Database Schema

- `userProfiles` - Extends Better Auth users with Stripe customer ID
- `boards` - User boards with unlock status and style options
- `cards` - Individual cards with original/illustration URLs and status

### Auth Flow

- Middleware (`middleware.ts`) protects `/dashboard`, `/boards`, `/account`, `/api/boards`, `/api/stripe`
- Session stored in `better-auth.session_token` cookie
- Auth routes (`/sign-in`, `/sign-up`) redirect to dashboard if already authenticated

### Payment Flow

- Free tier: 16 cards, 1 example board generation
- Unlocked ($5): 54 cards, unlimited board generations
- Stripe Checkout creates session with `boardId` in metadata
- Webhook marks board as `isUnlocked = true`

### Image Storage

- All images stored in Vercel Blob with public access
- Served through `/api/images/[...path]` proxy that verifies user ownership
- Path pattern: `users/{userId}/boards/{boardId}/cards/{cardId}/{type}.png`

## Testing

- Vitest with jsdom environment
- Tests in `__tests__/` mirroring source structure
- `vitest.setup.ts` configures jest-dom matchers
- Mock external dependencies (Stripe, Blob, database) in tests

## Patterns

- Optimistic updates in hooks with rollback on error
- API routes use `getAuthSession()` from `lib/auth-client.ts` for auth checks
- Board/card limits enforced in API routes based on `board.isUnlocked`
