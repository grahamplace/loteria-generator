# i18n: English + Spanish (en, es-MX)

**Status:** Design — pending implementation plan
**Date:** 2026-05-01
**Scope:** Marketing surfaces + authed app. Admin, transactional flows, and APIs stay English-only.

---

## 1. Goals & non-goals

### Goals

- Render the marketing site and authed app in English or Spanish, persisted across visits.
- Maximize SEO discoverability for Spanish-language queries (e.g. "loteria personalizada", "loteria para boda", "loteria quinceañera").
- Respect the user's browser preference without hijacking URLs.
- Let the user override the choice via a visible toggle on every page.

### Non-goals (v1)

- Admin pages (`app/(admin)/*`).
- API routes (`app/api/*`) — locale-agnostic.
- Better Auth transactional emails (verification, password reset).
- Stripe Checkout UI (Stripe accepts a `locale` param; deferred follow-up).
- Inngest job status / log messages.
- Text rendered inside exported PDFs (card labels are Spanish by product design; board chrome unchanged).
- `not-found.tsx` / `error.tsx` translation (easy follow-up).
- Translation of user-generated content (board names, user-edited card labels) — never translated.
- Auto-redirect on `/` based on `Accept-Language` (Google explicitly warns against this; Googlebot can't crawl variants it gets bounced from).

### Card-label policy (carve-out)

Card labels (`card.label` in the database, e.g. "El Pollo", "La Sirena", and AI-generated labels) stay in Spanish in both locales. They are the cultural artifact of the product. UI chrome around them ("Edit label", "Delete card", "Save changes") is translated.

---

## 2. Architecture

### Locales

- `en` — default, served at root (`/`, `/dashboard`, `/faq`, ...).
- `es-MX` — served at `/es/...`. URL token is `es`; HTML/hreflang token is `es-MX` (more specific than `es`; helps Google geo-target Latin American queries since the brand is explicitly Mexican Lotería).

### URL strategy

`localePrefix: 'as-needed'` (via `next-intl`). English at root, Spanish at `/es/*`. Best of both worlds for SEO: each locale has stable indexable URLs, and the default locale keeps clean canonical URLs.

### Library

`next-intl` (latest compatible with Next.js 16.2 / App Router).

Rationale: ICU plural support (cards, boards, photos uploaded), date/number formatting, App Router-native middleware integration, first-class `hreflang` and sitemap helpers. Bundle cost ~30–40 KB gzipped — acceptable for a public consumer site.

### Route layout

```
app/
  [locale]/
    layout.tsx              # sets <html lang>, NextIntlClientProvider, loads messages
    page.tsx                # landing (moved from app/page.tsx)
    faq/page.tsx
    (auth)/sign-in/page.tsx
    (auth)/sign-up/page.tsx
    dashboard/page.tsx
    boards/[boardId]/page.tsx
    account/page.tsx
  (admin)/                  # untouched — admin stays English
  api/                      # untouched — APIs locale-agnostic
  layout.tsx                # minimal root, just <html> shell + global providers
  globals.css
  manifest.ts
  opengraph-image.tsx
  robots.ts
  sitemap.ts                # rewritten with hreflang alternates
```

The marketing landing page currently at `app/page.tsx` moves to `app/[locale]/page.tsx`. Same for `faq`, `(auth)`, `dashboard`, `boards`, `account`.

### Locale negotiation order

On every request, the locale is decided in this order (first match wins):

1. **URL prefix** — `/es/...` ⇒ `es`.
2. **`LOCALE` cookie** — set by the toggle or banner. Stored value is the URL token (`en` or `es`), not the hreflang token.
3. **`user_profiles.locale`** in the DB — only consulted if the user is signed in.
4. **`Accept-Language` header** — used **only to decide whether to show the banner** on `/`. Does **not** trigger a redirect.
5. **Fallback** — `en`.

**Consistency guarantee — URL must match the negotiated locale.** If steps 2–5 resolve to a non-default locale but the URL has no prefix (e.g., signed-in Spanish-preferring user visits `/dashboard` from a fresh browser with no cookie, DB says `es`), the middleware **redirects** to the prefixed URL (`/es/dashboard`) and sets the `LOCALE` cookie at the same time. This is `next-intl`'s default behavior under `localePrefix: 'as-needed'`. Avoids URL/locale mismatch and the "wrong canonical for this content" SEO problem.

### `proxy.ts` (Next.js 16 middleware) changes

`proxy.ts` currently handles auth redirects. It will be rewritten to compose with `next-intl`'s middleware:

1. `next-intl` middleware runs first → resolves the locale, rewrites internally so downstream code sees the de-prefixed pathname plus a `locale` value.
2. Existing auth checks run on the de-prefixed pathname.
3. Auth redirects preserve the active locale: an unauthenticated visit to `/es/dashboard` redirects to `/es/sign-in?callbackUrl=/es/dashboard`. Authenticated visit to `/es/sign-in` redirects to `/es/dashboard`.

The `matcher` config stays roughly the same (excluding `_next/static`, `_next/image`, `favicon.ico`, `public`, `api/auth`).

---

## 3. Translation content

### File layout

```
messages/
  en.json
  es.json
```

### Namespacing

Each file is structured by route/component to keep keys grep-able:

```json
{
  "Marketing": {
    "Nav": { ... },
    "Hero": { ... },
    "UseCases": { ... },
    "HowItWorks": { ... },
    "Pricing": { ... },
    "Faq": { "items": [ { "question": "...", "answer": "..." }, ... ] },
    "Footer": { ... }
  },
  "Auth": { "SignIn": { ... }, "SignUp": { ... } },
  "Dashboard": { ... },
  "BoardEditor": { ... },
  "Account": { ... },
  "Common": { "buttons": { ... }, "errors": { ... }, "toasts": { ... } },
  "Banner": { "preferSpanish": "..." }
}
```

### Authoring flow

1. **Extract** every English string from in-scope files into `messages/en.json`. This is the bulk of the implementation work (~30–40 files touched).
2. **Translate** by running `en.json` through Claude with a brand-context prompt:
   - Mexican Lotería; warm/festive tone.
   - Use **tú** (informal singular), not **usted** — audience is families/parties.
   - Preserve Spanish words already in the English copy: "Lotería", "tabla", "quinceañera", "cantor".
   - Keep ICU placeholder syntax intact.
3. **Human review** of high-traffic surfaces by the project owner: `Marketing.*` (landing + FAQ) and `Auth.*`. Dashboard / board editor / account ship without owner review (lower-stakes interior copy).
4. **SEO-critical strings** flagged in the implementation plan for extra care: page `<title>`, meta `description`, landing H1, FAQ questions/answers, structured-data `name` and `description`. Generic LLM Spanish ranks worse than idiomatic Spanish exactly here.

### Pluralization

ICU plural syntax for counts:
```
"cardCount": "{count, plural, one {# card} other {# cards}}"
```
Spanish naturally: `# tarjeta` / `# tarjetas`.

### Card labels

`card.label` values (DB) are never run through `t()`. AI-generated label text from Inngest jobs stays Spanish. UI chrome around labels uses `t()`.

---

## 4. Toggle UX & persistence

### `<LanguageSwitch />` component

A compact dropdown with a globe icon showing `EN` / `ES`. Two placements:

- **Marketing nav** — inline in the top-right cluster, before "Sign In", on `app/[locale]/page.tsx`, `faq/page.tsx`, and the `(auth)/*` pages.
- **Authed app user menu** — extend the existing dashboard header user/account menu to include the language switcher above "Sign out".

### Toggle behavior

On click:

1. Compute the equivalent URL in the other locale using `next-intl/navigation`'s `useRouter()` + `usePathname()`. Example: `/es/boards/abc123` ↔ `/boards/abc123`. Query string and hash are preserved.
2. Set cookie `LOCALE=<value>`: 1-year `Max-Age`, `SameSite=Lax`, `Path=/`, `Secure` in production.
3. If signed in, fire-and-forget `POST /api/account/locale`. Failure is silent — the cookie is still authoritative on the next visit.
4. `router.replace()` to the new URL — preserves scroll position, no full reload.

### `Accept-Language` banner

Conditions to show:

- Path is `/` (landing only).
- Cookie `LOCALE` is **not** set.
- `Accept-Language` header starts with `es` (any region).
- Currently rendering English.

Copy:
> ¿Prefieres ver esta página en español? **Sí, cambiar** • _Seguir en inglés_

Behavior:

- "Sí, cambiar" → same flow as the toggle (route to `/es`, set cookie + DB).
- "Seguir en inglés" → set `LOCALE=en` cookie so the banner does not reappear.
- Implementation: server component reads `Accept-Language` + cookie, renders a small dismissible client component when conditions met. `aria-live="polite"`, dismiss button gets a visible focus ring per project a11y standards.

### Database change

Extend `user_profiles` (do **not** touch the `user` table — Better Auth manages it):

```ts
// db/schema.ts
export const userProfiles = pgTable('user_profiles', {
  id: text('id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id'),
  locale: text('locale'),  // new — nullable; null = "no preference set"
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

Single Drizzle migration. Nullable so existing rows are unaffected.

### API endpoint

`POST /api/account/locale`

- Body: `{ locale: 'en' | 'es' }`, validated with Zod.
- Requires authentication (covered by existing `proxy.ts` auth-route protection — this path is added to the protected-API list, or matched by a new prefix).
- Updates `user_profiles.locale` for the authenticated user.
- Returns `204 No Content` on success.

---

## 5. SEO plumbing

### `<html lang>`

Set in `app/[locale]/layout.tsx` based on the active locale: `en` or `es-MX`.

### `hreflang` tags

Generated via `generateMetadata()` in each page (or the locale layout where applicable), using `next-intl`'s alternate-language helpers. Every translated page emits all three:

```html
<link rel="alternate" hreflang="en" href="https://.../faq" />
<link rel="alternate" hreflang="es-MX" href="https://.../es/faq" />
<link rel="alternate" hreflang="x-default" href="https://.../faq" />
```

`x-default` points to the English URL.

### Canonical

Each page's `<link rel="canonical">` points to **its own** locale URL — English page's canonical is the English URL, Spanish page's canonical is the Spanish URL. Critical: if both pages had the English canonical, Google would fold the Spanish version into the English one and never index it.

### OpenGraph metadata

In `app/[locale]/layout.tsx` (or the existing root metadata, made locale-aware):

- `openGraph.locale` becomes dynamic: `en_US` or `es_MX`.
- `openGraph.alternateLocale` is the other one.
- `title` and `description` pull from `messages/*.json`.

### `sitemap.ts`

Currently English-only. Rewritten to emit both locales with `alternates.languages` per entry — Google reads this as a strong hreflang signal alongside the `<link>` tags:

```ts
{
  url: `${siteUrl}/faq`,
  lastModified: ...,
  alternates: {
    languages: {
      en: `${siteUrl}/faq`,
      'es-MX': `${siteUrl}/es/faq`,
    },
  },
}
```

**Included in sitemap:** marketing routes (`/`, `/faq`) and auth routes (`/sign-in`, `/sign-up`) in both locales.
**Excluded from sitemap:** authed app routes (dashboard, board editor, account) — they are behind login and should not be indexed.

### `robots.ts`

Unchanged. Already `Allow: /`. Authed routes rely on existing per-page `noindex` (verify still applies under the locale prefix during implementation).

### Structured data (`components/json-ld.tsx`)

- JSON-LD `name` / `description` strings translated based on active locale.
- `availableLanguage` already lists `["English", "Spanish"]` — no change.
- `FAQJsonLd` pulls from translated FAQ content so the Spanish FAQ page emits Spanish FAQ schema (Google can show Spanish FAQ rich results in Spanish SERPs).
- `HowToJsonLd` step text translated.

---

## 6. Testing

### Unit (Vitest)

- **Locale negotiation** — table-driven tests over the negotiation order (URL > cookie > DB > default), including edge cases (malformed cookie, signed-in user with no `user_profiles` row, `Accept-Language` with multiple values).
- **Auth-redirect locale preservation** — `/es/dashboard` while logged out → `/es/sign-in?callbackUrl=/es/dashboard`. `/dashboard` while logged out → `/sign-in?callbackUrl=/dashboard`. `/es/sign-in` while logged in → `/es/dashboard`.

### Component (Vitest + Testing Library)

- `<LanguageSwitch />` — toggles cookie, calls `POST /api/account/locale`, navigates to the equivalent URL.
- Banner — shows when (no cookie, `Accept-Language: es*`, rendering English on `/`); hidden otherwise; "Seguir en inglés" persists `LOCALE=en` cookie.

### Smoke / integration

- Render landing page in both locales, assert a marker string from each (e.g., the H1).
- Render FAQ in both locales, assert one question is present in the active language.

### SEO assertions

Only the indexable marketing pages are asserted (authed pages aren't in the sitemap and rely on `noindex`). For `/`, `/es`, `/faq`, `/es/faq`:

- `<html lang>` matches the locale (`en` or `es-MX`).
- `<link rel="canonical">` points to the page's own locale URL.
- `<link rel="alternate" hreflang="en">`, `hreflang="es-MX"`, and `hreflang="x-default"` are all present and correct.

### Manual PR checklist

- Load `/`, `/es`, `/faq`, `/es/faq`, `/dashboard`, `/es/dashboard`.
- Toggle in both directions on each page; verify URL changes, cookie persists, and (when signed in) DB row updates.
- Sign in with Spanish active → still Spanish after sign-in. Sign out → still Spanish. Sign in with a different account whose `user_profiles.locale = es` from a fresh browser (no cookie) → renders Spanish.
- Banner appears on `/` for `Accept-Language: es-MX,es;q=0.9,en;q=0.8` with no cookie. Dismissing with "Seguir en inglés" prevents re-appearance.
- Banner does **not** appear when cookie is set or when `Accept-Language` is English.
- View-source check: `<html lang>`, canonical, hreflang on the four marketing URLs.

---

## 7. Rollout

Single PR. The feature is inherently safe to ship incrementally: Spanish only renders at `/es/...` URLs that don't exist today, and English at `/` is unchanged until merge. No feature flag needed.

### Implementation order (the plan will expand each step)

1. Install `next-intl`. Scaffold `[locale]` route and empty `messages/{en,es}.json`. Configure `next-intl` middleware in `proxy.ts`.
2. Move all in-scope pages under `app/[locale]/`. Make `proxy.ts` locale-aware. Checkpoint: typecheck passes, dev server loads `/` and `/es` with placeholder content.
3. Extract every English string into `en.json`; wire up `t()` across all in-scope files. Site renders identically to today on `/`. Checkpoint: visual diff against pre-change screenshots of `/`, `/faq`, `/dashboard`, `/boards/[id]`, `/account`.
4. Generate `es.json` via Claude with the brand-context prompt. Hand-review `Marketing.*` and `Auth.*`.
5. Build `<LanguageSwitch />`, banner, DB column + migration, `POST /api/account/locale`.
6. SEO plumbing: `<html lang>`, `hreflang`, canonical, `sitemap.ts`, OpenGraph, JSON-LD.
7. Tests + manual checklist.

---

## 8. Open questions

None at design time. Items that may surface during implementation:

- Whether any current `noindex` headers/tags need updating now that authed pages live under `/[locale]/`. To verify in step 6.
- Whether `next-intl` and Next.js 16.2 require any special config (App Router was first-class in `next-intl` 3.x; 16.2 should be supported, verify the latest version at install time).
- Exact placement of the language toggle inside the existing dashboard header — the existing user menu may need a small refactor to accommodate it cleanly.
