<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

---

## Database

- There **is** a separate dev database: a Neon branch, distinct from the production branch. `DATABASE_URL` in `.env.local` points at it, so `pnpm db:migrate` / `db:push`, seeds, and destructive queries run locally hit dev data, not customers.
- Before any DB-mutating command, confirm which branch you are actually on — a stale `.env.local` copied from an older checkout is the way this goes wrong:

  ```bash
  grep '^DATABASE_URL' .env.local | sed -E 's|.*@([^/]*)/([^?]*).*|host=\1 db=\2|'
  ```

  Compare the host against the dev branch's endpoint in the Neon console. If it matches the production branch, stop and repoint before running anything.

- New worktrees do not inherit `.env.local` — copy it from an existing checkout (along with `.npmrc` and, for e2e, `.env.test`).
- Schema changes still reach production the usual way, through a deploy. A migration that is correct against dev is not automatically safe against production data: check for rows that violate a new constraint before shipping.
- The e2e suite is separately isolated — `scripts/e2e-run.ts` provisions a throwaway Neon branch per run, migrates and seeds it, and destroys it afterwards. It touches neither dev nor production.

---

## Live Game socket server

- The realtime socket server is a **second deployable** on Fly.io, app
  `loteria-live-game` (region `iad`), configured by `fly.toml` at the repo root.
  Architecture and rationale: `docs/adr/0001-live-game-realtime-architecture.md`.
- Two environment variables belong to it. Both live in **Vercel** — `pnpm dev`
  runs `vercel env pull .env.local`, so a value written only to `.env.local` is
  wiped on the next dev run. Set them with `vercel env add <NAME> <target>
--force`, never by hand-editing `.env.local`.
  - `NEXT_PUBLIC_WS_URL` — `wss://loteria-live-game.fly.dev` in production and
    preview, `ws://localhost:3055` in development.
  - `LIVE_GAME_TICKET_SECRET` — shared HMAC key for the ~60s handshake ticket
    Next.js mints and the socket server verifies. Production and preview share
    one value with Fly (`fly secrets set --app loteria-live-game`); development
    has its own, so a leaked dev secret is worthless against production.
- New worktrees pick both up through `pnpm secrets:pull`, along with everything
  else in `.env.local`.
- Reading a non-development value back (`vercel env pull --environment=…`)
  returns `[SENSITIVE]`, not the real string. Rotate rather than try to recover.
- Provisioning was done by `.scratch/live-game/provision-fly.sh`; it is
  idempotent and safe to re-run.

---

## Board Unlock Price

- MUST: Change the unlock price by editing both constants in `lib/constants.ts`: `BOARD_UNLOCK_PRICE_CENTS` (integer cents, used by Stripe) and `BOARD_UNLOCK_PRICE_DISPLAY` (formatted string, e.g. `'$20'`, used in UI/FAQ copy). Keep the two values in sync.
- NEVER: Hardcode the price in components, copy, Stripe calls, or tests — import from `@/lib/constants`.

---

Concise rules for building accessible, fast, delightful UIs. Use MUST/SHOULD/NEVER to guide decisions.

## Interactions

### Keyboard

- MUST: Full keyboard support per [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/)
- MUST: Visible focus rings (`:focus-visible`; group with `:focus-within`)
- MUST: Manage focus (trap, move, return) per APG patterns
- NEVER: `outline: none` without visible focus replacement

### Targets & Input

- MUST: Hit target ≥24px (mobile ≥44px); if visual <24px, expand hit area
- MUST: Mobile `<input>` font-size ≥16px to prevent iOS zoom
- NEVER: Disable browser zoom (`user-scalable=no`, `maximum-scale=1`)
- MUST: `touch-action: manipulation` to prevent double-tap zoom
- SHOULD: Set `-webkit-tap-highlight-color` to match design

### Forms

- MUST: Hydration-safe inputs (no lost focus/value)
- NEVER: Block paste in `<input>`/`<textarea>`
- MUST: Loading buttons show spinner and keep original label
- MUST: Enter submits focused input; in `<textarea>`, ⌘/Ctrl+Enter submits
- MUST: Keep submit enabled until request starts; then disable with spinner
- MUST: Accept free text, validate after—don't block typing
- MUST: Allow incomplete form submission to surface validation
- MUST: Errors inline next to fields; on submit, focus first error
- MUST: `autocomplete` + meaningful `name`; correct `type` and `inputmode`
- SHOULD: Disable spellcheck for emails/codes/usernames
- SHOULD: Placeholders end with `…` and show example pattern
- MUST: Warn on unsaved changes before navigation
- MUST: Compatible with password managers & 2FA; allow pasting codes
- MUST: Trim values to handle text expansion trailing spaces
- MUST: No dead zones on checkboxes/radios; label+control share one hit target

### State & Navigation

- MUST: URL reflects state (deep-link filters/tabs/pagination/expanded panels)
- MUST: Back/Forward restores scroll position
- MUST: Links use `<a>`/`<Link>` for navigation (support Cmd/Ctrl/middle-click)
- NEVER: Use `<div onClick>` for navigation

### Feedback

- SHOULD: Optimistic UI; reconcile on response; on failure rollback or offer Undo
- MUST: Confirm destructive actions or provide Undo window
- MUST: Use polite `aria-live` for toasts/inline validation
- SHOULD: Ellipsis (`…`) for options opening follow-ups ("Rename…") and loading states ("Loading…")

### Touch & Drag

- MUST: Generous targets, clear affordances; avoid finicky interactions
- MUST: Delay first tooltip; subsequent peers instant
- MUST: `overscroll-behavior: contain` in modals/drawers
- MUST: During drag, disable text selection and set `inert` on dragged elements
- MUST: If it looks clickable, it must be clickable

### Autofocus

- SHOULD: Autofocus on desktop with single primary input; rarely on mobile

## Animation

- MUST: Honor `prefers-reduced-motion` (provide reduced variant or disable)
- SHOULD: Prefer CSS > Web Animations API > JS libraries
- MUST: Animate compositor-friendly props (`transform`, `opacity`) only
- NEVER: Animate layout props (`top`, `left`, `width`, `height`)
- NEVER: `transition: all`—list properties explicitly
- SHOULD: Animate only to clarify cause/effect or add deliberate delight
- SHOULD: Choose easing to match the change (size/distance/trigger)
- MUST: Animations interruptible and input-driven (no autoplay)
- MUST: Correct `transform-origin` (motion starts where it "physically" should)
- MUST: SVG transforms on `<g>` wrapper with `transform-box: fill-box`

## Layout

- SHOULD: Optical alignment; adjust ±1px when perception beats geometry
- MUST: Deliberate alignment to grid/baseline/edges—no accidental placement
- SHOULD: Balance icon/text lockups (weight/size/spacing/color)
- MUST: Verify mobile, laptop, ultra-wide (simulate ultra-wide at 50% zoom)
- MUST: Respect safe areas (`env(safe-area-inset-*)`)
- MUST: Avoid unwanted scrollbars; fix overflows
- SHOULD: Flex/grid over JS measurement for layout

## Content & Accessibility

- SHOULD: Inline help first; tooltips last resort
- MUST: Skeletons mirror final content to avoid layout shift
- MUST: `<title>` matches current context
- MUST: No dead ends; always offer next step/recovery
- MUST: Design empty/sparse/dense/error states
- SHOULD: Curly quotes (" "); avoid widows/orphans (`text-wrap: balance`)
- MUST: `font-variant-numeric: tabular-nums` for number comparisons
- MUST: Redundant status cues (not color-only); icons have text labels
- MUST: Accessible names exist even when visuals omit labels
- MUST: Use `…` character (not `...`)
- MUST: `scroll-margin-top` on headings; "Skip to content" link; hierarchical `<h1>`–`<h6>`
- MUST: Resilient to user-generated content (short/avg/very long)
- MUST: Locale-aware dates/times/numbers (`Intl.DateTimeFormat`, `Intl.NumberFormat`)
- MUST: Accurate `aria-label`; decorative elements `aria-hidden`
- MUST: Icon-only buttons have descriptive `aria-label`
- MUST: Prefer native semantics (`button`, `a`, `label`, `table`) before ARIA
- MUST: Non-breaking spaces: `10&nbsp;MB`, `⌘&nbsp;K`, brand names

## Content Handling

- MUST: Text containers handle long content (`truncate`, `line-clamp-*`, `break-words`)
- MUST: Flex children need `min-w-0` to allow truncation
- MUST: Handle empty states—no broken UI for empty strings/arrays

## Performance

- SHOULD: Test iOS Low Power Mode and macOS Safari
- MUST: Measure reliably (disable extensions that skew runtime)
- MUST: Track and minimize re-renders (React DevTools/React Scan)
- MUST: Profile with CPU/network throttling
- MUST: Batch layout reads/writes; avoid reflows/repaints
- MUST: Mutations (`POST`/`PATCH`/`DELETE`) target <500ms
- SHOULD: Prefer uncontrolled inputs; controlled inputs cheap per keystroke
- MUST: Virtualize large lists (>50 items)
- MUST: Preload above-fold images; lazy-load the rest
- MUST: Prevent CLS (explicit image dimensions)
- SHOULD: `<link rel="preconnect">` for CDN domains
- SHOULD: Critical fonts: `<link rel="preload" as="font">` with `font-display: swap`

## Dark Mode & Theming

- MUST: `color-scheme: dark` on `<html>` for dark themes
- SHOULD: `<meta name="theme-color">` matches page background
- MUST: Native `<select>`: explicit `background-color` and `color` (Windows fix)

## Color Palette (Loteria Theme)

- MUST: Use CSS variables from `globals.css`—never hardcode hex/rgb values
- MUST: Use Tailwind classes (`bg-primary`, `text-accent`, etc.) for colors
- MUST: Primary (Vermillion Red) for CTAs, links, focus rings
- MUST: Secondary (Marigold Gold) for highlights, badges, warnings
- MUST: Accent (Deep Verde) for success states, secondary actions
- MUST: Foreground (Rich Brown) for body text on light backgrounds
- NEVER: Introduce new brand colors without updating `globals.css`
- SHOULD: Maintain warm, festive aesthetic inspired by traditional Loteria cards

## Hydration

- MUST: Inputs with `value` need `onChange` (or use `defaultValue`)
- SHOULD: Guard date/time rendering against hydration mismatch

## Design

- SHOULD: Layered shadows (ambient + direct)
- SHOULD: Crisp edges via semi-transparent borders + shadows
- SHOULD: Nested radii: child ≤ parent; concentric
- SHOULD: Hue consistency: tint borders/shadows/text toward bg hue
- MUST: Accessible charts (color-blind-friendly palettes)
- MUST: Meet contrast—prefer [APCA](https://apcacontrast.com/) over WCAG 2
- MUST: Increase contrast on `:hover`/`:active`/`:focus`
- SHOULD: Match browser UI to bg
- SHOULD: Avoid dark color gradient banding (use background images when needed)
