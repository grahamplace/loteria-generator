# Google Ads Integration + Conversion Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google Ads conversion tracking (gtag.js) so paid search campaigns (e.g. keyword "custom loteria") can measure signups and board-unlock purchases, plus a setup runbook for the manual Google Ads account work.

**Architecture:** A `GoogleAdsTag` component in the locale layout loads gtag.js via `next/script` only when `NEXT_PUBLIC_GOOGLE_ADS_ID` is set (so dev/preview are no-ops). A small client-side helper module (`lib/google-ads.ts`) fires two conversion events: `sign_up` (email signup inline; Google OAuth signup via a sessionStorage flag consumed on the dashboard, since the OAuth redirect leaves the page) and `purchase` (fired on the Stripe success redirect back to the board page, deduped by Stripe checkout session ID). PostHog remains the source of truth for traffic/attribution — posthog-js already auto-captures `utm_*` and `gclid` on the first pageview and is served through the `/ingest` reverse proxy, so it survives ad-blockers; gtag exists purely to report conversions back to Google Ads.

**Tech Stack:** Next.js 16.2 App Router, React 19, `next/script` (no new dependencies), Vitest + Testing Library, existing PostHog + Stripe integrations.

## Global Constraints

- **Never hardcode the unlock price** — import `BOARD_UNLOCK_PRICE_CENTS` from `@/lib/constants` (currently 2000 = $20).
- **No new npm dependencies.** Use `next/script` directly.
- **All Google Ads code must no-op when `NEXT_PUBLIC_GOOGLE_ADS_ID` is unset** (dev, preview, tests without stubs).
- **Env vars (all optional, client-exposed):** `NEXT_PUBLIC_GOOGLE_ADS_ID` (e.g. `AW-1234567890`), `NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL`, `NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL`. Always read them via direct property access (`process.env.NEXT_PUBLIC_X`) — Next.js inlines them at build time; dynamic/bracket access breaks in client bundles.
- **Commit messages: conventional-commit style (`feat: …`), NO AI/Claude attribution trailers of any kind.**
- **Do not run any DB-mutating command** — dev `DATABASE_URL` points at production. Nothing in this plan touches the DB.
- No user-facing copy changes → no `messages/en.json` / `messages/es-MX.json` changes needed.
- Repo commands: `pnpm test` (vitest run), `pnpm typecheck`, `pnpm lint`, `pnpm format`.
- Run all commands from the worktree root: `/Users/grahamplace/Projects/loteria-generator-app/.claude/worktrees/graham+google-ads`.

---

### Task 1: `lib/google-ads.ts` conversion helpers

**Files:**
- Create: `lib/google-ads.ts`
- Test: `__tests__/lib/google-ads.test.ts`

**Interfaces:**
- Consumes: `BOARD_UNLOCK_PRICE_CENTS` from `@/lib/constants`.
- Produces (used by Tasks 3 & 4):
  - `fireSignupConversion(): void`
  - `firePurchaseConversion(transactionId?: string): void`
  - `setPendingSignupConversion(): void`
  - `consumePendingSignupConversion(): void`

All functions are client-side, synchronous, and silently no-op when the env vars are missing or `window` is unavailable. The helper defines `window.gtag` itself if the tag script hasn't executed yet (the standard dataLayer-queue stub), so conversions fired in a mount effect immediately after a redirect are queued rather than dropped — gtag.js drains the queue when it loads.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/google-ads.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  fireSignupConversion,
  firePurchaseConversion,
  setPendingSignupConversion,
  consumePendingSignupConversion,
} from '@/lib/google-ads';
import { BOARD_UNLOCK_PRICE_CENTS } from '@/lib/constants';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

describe('google-ads conversion helpers', () => {
  let gtagSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gtagSpy = vi.fn();
    window.gtag = gtagSpy;
    window.dataLayer = [];
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete window.gtag;
    delete window.dataLayer;
  });

  function stubAdsEnv() {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', 'AW-123456');
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL', 'signupLbl');
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL', 'purchaseLbl');
  }

  describe('fireSignupConversion', () => {
    it('no-ops when NEXT_PUBLIC_GOOGLE_ADS_ID is unset', () => {
      fireSignupConversion();
      expect(gtagSpy).not.toHaveBeenCalled();
    });

    it('no-ops when the signup label is unset', () => {
      vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', 'AW-123456');
      fireSignupConversion();
      expect(gtagSpy).not.toHaveBeenCalled();
    });

    it('fires a conversion event with send_to = id/label', () => {
      stubAdsEnv();
      fireSignupConversion();
      expect(gtagSpy).toHaveBeenCalledWith('event', 'conversion', {
        send_to: 'AW-123456/signupLbl',
      });
    });
  });

  describe('firePurchaseConversion', () => {
    it('fires with value from BOARD_UNLOCK_PRICE_CENTS, USD currency, and transaction id', () => {
      stubAdsEnv();
      firePurchaseConversion('cs_test_abc');
      expect(gtagSpy).toHaveBeenCalledWith('event', 'conversion', {
        send_to: 'AW-123456/purchaseLbl',
        value: BOARD_UNLOCK_PRICE_CENTS / 100,
        currency: 'USD',
        transaction_id: 'cs_test_abc',
      });
    });

    it('omits transaction_id when not provided', () => {
      stubAdsEnv();
      firePurchaseConversion();
      expect(gtagSpy).toHaveBeenCalledWith('event', 'conversion', {
        send_to: 'AW-123456/purchaseLbl',
        value: BOARD_UNLOCK_PRICE_CENTS / 100,
        currency: 'USD',
      });
    });

    it('no-ops when NEXT_PUBLIC_GOOGLE_ADS_ID is unset', () => {
      firePurchaseConversion('cs_test_abc');
      expect(gtagSpy).not.toHaveBeenCalled();
    });
  });

  describe('gtag queue stub', () => {
    it('defines window.gtag and queues into dataLayer when the tag script has not loaded', () => {
      stubAdsEnv();
      delete window.gtag;
      window.dataLayer = [];
      fireSignupConversion();
      expect(typeof window.gtag).toBe('function');
      expect(window.dataLayer).toHaveLength(1);
    });
  });

  describe('pending signup conversion (OAuth redirect flow)', () => {
    it('consumePendingSignupConversion fires once and clears the flag', () => {
      stubAdsEnv();
      setPendingSignupConversion();
      consumePendingSignupConversion();
      consumePendingSignupConversion();
      expect(gtagSpy).toHaveBeenCalledTimes(1);
      expect(gtagSpy).toHaveBeenCalledWith('event', 'conversion', {
        send_to: 'AW-123456/signupLbl',
      });
    });

    it('consumePendingSignupConversion no-ops when no flag is set', () => {
      stubAdsEnv();
      consumePendingSignupConversion();
      expect(gtagSpy).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test __tests__/lib/google-ads.test.ts`
Expected: FAIL — `Cannot find module '@/lib/google-ads'` (or equivalent resolve error).

- [ ] **Step 3: Write the implementation**

Create `lib/google-ads.ts`:

```ts
// Client-side Google Ads (gtag.js) conversion helpers. Every function no-ops
// unless NEXT_PUBLIC_GOOGLE_ADS_ID and the relevant conversion label are set,
// so dev/preview environments never talk to Google.

import { BOARD_UNLOCK_PRICE_CENTS } from '@/lib/constants';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const PENDING_SIGNUP_KEY = 'loteria_pending_signup_conversion';

function trackConversion(label: string | undefined, params: Record<string, unknown> = {}) {
  const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  if (!adsId || !label || typeof window === 'undefined') {
    return;
  }
  // The gtag.js loader may not have executed yet (e.g. a conversion fired in a
  // mount effect right after a redirect). Install the standard queue stub so
  // the event lands in dataLayer and is drained when the library loads.
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
  }
  window.gtag('event', 'conversion', { send_to: `${adsId}/${label}`, ...params });
}

export function fireSignupConversion() {
  trackConversion(process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL);
}

export function firePurchaseConversion(transactionId?: string) {
  trackConversion(process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL, {
    value: BOARD_UNLOCK_PRICE_CENTS / 100,
    currency: 'USD',
    ...(transactionId ? { transaction_id: transactionId } : {}),
  });
}

// Google OAuth signup navigates away to Google before we can fire the
// conversion, so stash a flag in sessionStorage (survives same-tab redirects)
// and fire when the user lands back on the dashboard.
export function setPendingSignupConversion() {
  try {
    sessionStorage.setItem(PENDING_SIGNUP_KEY, '1');
  } catch {
    // Storage unavailable (private mode quota, disabled) — drop the conversion.
  }
}

export function consumePendingSignupConversion() {
  try {
    if (sessionStorage.getItem(PENDING_SIGNUP_KEY) !== '1') {
      return;
    }
    sessionStorage.removeItem(PENDING_SIGNUP_KEY);
  } catch {
    return;
  }
  fireSignupConversion();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test __tests__/lib/google-ads.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Typecheck, lint, format, commit**

```bash
pnpm typecheck && pnpm lint && pnpm format
git add lib/google-ads.ts __tests__/lib/google-ads.test.ts
git commit -m "feat(ads): add Google Ads conversion helpers"
```

---

### Task 2: `GoogleAdsTag` component mounted in the locale layout

**Files:**
- Create: `components/google-ads-tag.tsx`
- Modify: `app/[locale]/layout.tsx` (mount next to `<Analytics />`, ~line 138)
- Test: `__tests__/components/google-ads-tag.test.tsx`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_GOOGLE_ADS_ID` env var only (labels are irrelevant to the loader).
- Produces: `GoogleAdsTag(): JSX element | null` — a server-compatible component (no hooks, no handlers) rendering two `next/script` tags, or `null` when the env var is unset.

- [ ] **Step 1: Write the failing tests**

`next/script` with `afterInteractive` injects scripts as a mount side effect in jsdom, which is timing-flaky to assert on. Instead, call the component function directly (it has no hooks) and assert on the returned element tree.

Create `__tests__/components/google-ads-tag.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { GoogleAdsTag } from '@/components/google-ads-tag';

afterEach(() => {
  vi.unstubAllEnvs();
});

function scriptChildren(element: React.ReactElement): React.ReactElement[] {
  const children = (element.props as { children: React.ReactElement[] }).children;
  return React.Children.toArray(children) as React.ReactElement[];
}

describe('GoogleAdsTag', () => {
  it('renders nothing when NEXT_PUBLIC_GOOGLE_ADS_ID is unset', () => {
    expect(GoogleAdsTag()).toBeNull();
  });

  it('renders the gtag loader and init scripts when the env var is set', () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', 'AW-987654');
    const element = GoogleAdsTag();
    expect(element).not.toBeNull();

    const [loader, init] = scriptChildren(element!);
    expect((loader.props as { src: string }).src).toBe(
      'https://www.googletagmanager.com/gtag/js?id=AW-987654'
    );
    const inline = (init.props as { children: string }).children;
    expect(inline).toContain("gtag('config', 'AW-987654')");
    expect(inline).toContain('dataLayer');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test __tests__/components/google-ads-tag.test.tsx`
Expected: FAIL — cannot find module `@/components/google-ads-tag`.

- [ ] **Step 3: Write the component**

Create `components/google-ads-tag.tsx`:

```tsx
import Script from 'next/script';

/**
 * Loads the Google Ads tag (gtag.js) for conversion tracking. Renders nothing
 * unless NEXT_PUBLIC_GOOGLE_ADS_ID is set, so dev/preview builds stay clean.
 * Conversion events are fired from lib/google-ads.ts.
 */
export function GoogleAdsTag() {
  const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  if (!adsId) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${adsId}`}
        strategy="afterInteractive"
      />
      <Script id="google-ads-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${adsId}');`}
      </Script>
    </>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test __tests__/components/google-ads-tag.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Mount in the locale layout**

In `app/[locale]/layout.tsx`, add the import near the other component imports (after the `Toaster` import):

```tsx
import { GoogleAdsTag } from '@/components/google-ads-tag';
```

And in the returned JSX, add `<GoogleAdsTag />` next to `<Analytics />`:

```tsx
        <Toaster />
        <Analytics />
        <GoogleAdsTag />
        {process.env.NODE_ENV === 'development' && <Agentation />}
```

- [ ] **Step 6: Run the full suite, typecheck, lint, commit**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm format
git add components/google-ads-tag.tsx __tests__/components/google-ads-tag.test.tsx 'app/[locale]/layout.tsx'
git commit -m "feat(ads): load Google Ads tag when NEXT_PUBLIC_GOOGLE_ADS_ID is set"
```

---

### Task 3: Purchase conversion on Stripe success redirect

**Files:**
- Modify: `app/api/stripe/checkout/route.ts:64` (append `session_id={CHECKOUT_SESSION_ID}` to `successUrl`)
- Modify: `app/[locale]/boards/[boardId]/page.tsx:53-66` (fire purchase conversion in the `payment === 'success'` effect)

**Interfaces:**
- Consumes: `firePurchaseConversion(transactionId?: string)` from `@/lib/google-ads` (Task 1).
- Produces: nothing consumed by later tasks.

Stripe replaces the literal `{CHECKOUT_SESSION_ID}` template in `success_url` with the real checkout session ID, giving us a `transaction_id` so Google Ads dedupes reloads of the success URL.

- [ ] **Step 1: Update the checkout success URL**

In `app/api/stripe/checkout/route.ts`, change:

```ts
      successUrl: `${baseUrl}/boards/${boardId}?payment=success`,
```

to:

```ts
      successUrl: `${baseUrl}/boards/${boardId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
```

- [ ] **Step 2: Fire the conversion on the board page**

In `app/[locale]/boards/[boardId]/page.tsx`, add to the existing imports:

```tsx
import { firePurchaseConversion } from '@/lib/google-ads';
```

Then in the payment-redirect effect, fire the conversion before the URL is cleaned up. Change:

```tsx
  useEffect(() => {
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      toast.success(t('toasts.boardUnlockedTitle'), {
        description: t('toasts.boardUnlockedDesc'),
      });
      refreshBoard();
      router.replace(`/boards/${boardId}`);
    } else if (payment === 'cancelled') {
```

to:

```tsx
  useEffect(() => {
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      firePurchaseConversion(searchParams.get('session_id') ?? undefined);
      toast.success(t('toasts.boardUnlockedTitle'), {
        description: t('toasts.boardUnlockedDesc'),
      });
      refreshBoard();
      router.replace(`/boards/${boardId}`);
    } else if (payment === 'cancelled') {
```

(The `t` dependency note: the effect's dependency array stays as-is — this matches the file's existing pattern.)

- [ ] **Step 3: Run the full suite, typecheck, lint**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm format`
Expected: all pass (Task 1's unit tests already cover `firePurchaseConversion` behavior; this task is wiring).

- [ ] **Step 4: Commit**

```bash
git add app/api/stripe/checkout/route.ts 'app/[locale]/boards/[boardId]/page.tsx'
git commit -m "feat(ads): report board unlock purchases as Google Ads conversions"
```

---

### Task 4: Signup conversion (email + Google OAuth)

**Files:**
- Modify: `app/[locale]/(auth)/sign-up/page.tsx` (~lines 59 and 70-80)
- Modify: `app/[locale]/dashboard/page.tsx` (add a mount effect)

**Interfaces:**
- Consumes: `fireSignupConversion()`, `setPendingSignupConversion()`, `consumePendingSignupConversion()` from `@/lib/google-ads` (Task 1).
- Produces: nothing consumed by later tasks.

Email signup completes in-page, so the conversion fires inline right where `posthog.capture('signed_up')` already fires. Google OAuth signup redirects the tab to Google and back to `/dashboard`, so we stash a sessionStorage flag before redirecting and consume it on the dashboard. Known accepted noise: a user who clicks "Sign up with Google" but already has an account also gets counted — acceptable for early-stage campaign measurement, noted in the setup doc.

- [ ] **Step 1: Wire the sign-up page**

In `app/[locale]/(auth)/sign-up/page.tsx`, add to the imports:

```tsx
import { fireSignupConversion, setPendingSignupConversion } from '@/lib/google-ads';
```

In `handleEmailSignUp`, immediately after `posthog.capture('signed_up', { method: 'email' });`, add:

```tsx
        fireSignupConversion();
```

In `handleGoogleSignUp`, before the `await signIn.social({ ... })` call, add:

```tsx
      // The OAuth redirect leaves the page before gtag could fire; the
      // dashboard consumes this flag on landing.
      setPendingSignupConversion();
```

(Place it inside the `try` block, as the first statement.)

- [ ] **Step 2: Consume the flag on the dashboard**

In `app/[locale]/dashboard/page.tsx` (a `'use client'` component), add to the imports:

```tsx
import { consumePendingSignupConversion } from '@/lib/google-ads';
```

Ensure `useEffect` is imported from `react` (add it to the existing react import if not present), then add a mount effect inside the page component, near the top with the other hooks:

```tsx
  // Completes the Google-OAuth signup conversion started on the sign-up page.
  useEffect(() => {
    consumePendingSignupConversion();
  }, []);
```

- [ ] **Step 3: Run the full suite, typecheck, lint**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm format`
Expected: all pass (the flag/consume behavior is unit-tested in Task 1).

- [ ] **Step 4: Commit**

```bash
git add 'app/[locale]/(auth)/sign-up/page.tsx' 'app/[locale]/dashboard/page.tsx'
git commit -m "feat(ads): report signups as Google Ads conversions"
```

---

### Task 5: Google Ads setup runbook

**Files:**
- Create: `docs/google-ads-setup.md`

**Interfaces:**
- Consumes: env var names and conversion semantics from Tasks 1-4 (exact names: `NEXT_PUBLIC_GOOGLE_ADS_ID`, `NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL`, `NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL`).
- Produces: operator documentation only.

- [ ] **Step 1: Write the runbook**

Create `docs/google-ads-setup.md` with exactly this content:

```markdown
# Google Ads Setup Runbook

The code ships dark: nothing loads or fires until the env vars below are set in
Vercel. This doc covers the one-time Google Ads account setup and the first
campaign for keywords like "custom loteria".

## How the integration works

- `components/google-ads-tag.tsx` loads gtag.js site-wide when
  `NEXT_PUBLIC_GOOGLE_ADS_ID` is set. Page views are tracked automatically.
- `lib/google-ads.ts` fires two conversion events:
  - **Sign-up** — email signups fire inline; Google-OAuth signups set a
    sessionStorage flag on the sign-up page and fire when the user lands on
    `/dashboard`. (Caveat: someone who clicks "Sign up with Google" but already
    has an account is also counted — acceptable noise at this stage.)
  - **Purchase** — fires on the Stripe success redirect back to the board page,
    with `value` = `BOARD_UNLOCK_PRICE_CENTS / 100` USD and `transaction_id` =
    the Stripe checkout session ID (so reloads don't double-count).
- **PostHog remains the source of truth for traffic.** posthog-js auto-captures
  `utm_*` and `gclid` on the landing pageview and is proxied through `/ingest`,
  so it survives most ad-blockers; gtag conversions exist to feed Google Ads
  bidding and campaign reporting, and will undercount relative to PostHog.

## One-time setup

### 1. Create the Google Ads account

1. Sign up at https://ads.google.com with the business Google account.
2. Skip/dismiss the guided "first campaign" wizard (switch to Expert Mode) so
   you can set up conversions before spending anything.

### 2. Create the two conversion actions

In Google Ads: **Goals → Conversions → New conversion action → Website**, enter
the production domain, and create both actions manually:

| Setting | Sign-up action | Purchase action |
| --- | --- | --- |
| Goal category | Sign-up | Purchase |
| Conversion name | `Sign-up` | `Board unlock` |
| Value | Don't use a value | Use different values for each conversion |
| Count | One | Every |
| Attribution | Data-driven (default) | Data-driven (default) |

For each action, choose **"Install the tag yourself"** and note:

- The **tag ID** (`AW-XXXXXXXXXX`) — same for both actions.
- Each action's **conversion label** — the part after the `/` in the
  `send_to` value (`AW-XXXXXXXXXX/AbCdEfGhIj`).

### 3. Set the env vars in Vercel

```bash
vercel env add NEXT_PUBLIC_GOOGLE_ADS_ID production          # AW-XXXXXXXXXX
vercel env add NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL production
vercel env add NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL production
```

Leave them unset for Preview/Development so test traffic never reaches Google.
Redeploy production after adding them (`NEXT_PUBLIC_*` vars are inlined at
build time).

### 4. Verify

1. Visit the production site with `?gclid=test` and confirm the gtag network
   request to `googletagmanager.com/gtag/js?id=AW-…` loads (DevTools → Network).
2. Use Google's Tag Assistant (https://tagassistant.google.com) against the
   production URL and confirm the `AW-` tag is detected.
3. Sign up with a throwaway email and confirm the conversion appears in
   Google Ads (Goals → Conversions; can take a few hours to show).

## First campaign checklist ("custom loteria")

- **Campaign type:** Search. Turn OFF Display Network and Search Partners for
  the first run — keep spend concentrated on search intent.
- **Bidding:** start with Maximize Clicks with a low daily budget (e.g. $10-20)
  to gather data; switch to Maximize Conversions once ~30 days / enough
  conversions accumulate.
- **Keywords to start:** phrase-match `"custom loteria"`, `"custom loteria
  cards"`, `"personalized loteria"`, `"loteria maker"`, `"custom loteria game"`.
  Add exact-match variants of whatever converts.
- **Negative keywords:** `free printable`, `rules`, `how to play`, `meaning` —
  informational queries that won't convert.
- **Location/language:** United States, English + Spanish (the site serves
  `/es`).
- **Auto-tagging:** ON (Account settings → Auto-tagging) — this appends
  `gclid`, which PostHog captures for attribution.
- **Final URL suffix** (campaign or account level), so PostHog dashboards can
  segment paid traffic without relying on gclid:

  ```
  utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_term={keyword}
  ```

- **Landing page:** the homepage (`/`). Revisit with a dedicated landing page
  only if the homepage bounce rate on paid traffic looks bad in PostHog.

## Measuring results

- **PostHog:** filter Web Analytics / insights by `utm_medium = cpc` (or
  `gclid is set`) to see paid sessions, and funnel them against `signed_up`,
  `checkout_initiated`, and `board_unlocked`.
- **Google Ads:** the Campaigns table shows clicks, CPC, and the two conversion
  columns once actions are verified.
- **Consent note:** campaigns above target the US only. If you later target the
  EEA/UK, Google Consent Mode v2 and a consent banner are required first.
```

- [ ] **Step 2: Format and commit**

```bash
pnpm format
git add docs/google-ads-setup.md
git commit -m "docs(ads): add Google Ads setup runbook"
```

---

### Task 6: Final verification

**Files:** none new.

- [ ] **Step 1: Full suite from the worktree root**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm format:check`
Expected: all green (baseline was 306 passed / 6 skipped; expect +11 tests).

- [ ] **Step 2: Production build check**

Run: `pnpm build`
Expected: build completes without errors (catches any Server/Client component boundary mistakes, e.g. `GoogleAdsTag` in the layout).
