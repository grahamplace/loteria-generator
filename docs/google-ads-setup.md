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
    has an account is also counted — acceptable noise at this stage. Two more:
    if the user abandons the Google consent screen with the Back button, the
    flag can be left stale for that tab session and may count a later
    dashboard visit as a signup; and a brand-new user who instead uses "Sign in
    with Google" on the `/sign-in` page is _not_ counted as a signup
    conversion.)
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

| Setting         | Sign-up action        | Purchase action                          |
| --------------- | --------------------- | ---------------------------------------- |
| Goal category   | Sign-up               | Purchase                                 |
| Conversion name | `Sign-up`             | `Board unlock`                           |
| Value           | Don't use a value     | Use different values for each conversion |
| Count           | One                   | Every                                    |
| Attribution     | Data-driven (default) | Data-driven (default)                    |

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
4. Perform a real test checkout in production (unlock a board), then confirm
   the Board unlock conversion registers in Google Ads (Goals → Conversions)
   with the expected value, and that Tag Assistant shows the conversion hit
   on the success redirect. Don't trust campaign purchase data until you've
   seen this working once.

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
