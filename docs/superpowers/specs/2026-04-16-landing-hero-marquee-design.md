# Landing Hero with Card Marquee — Design

## Goal

Replace the current text-only landing hero with an agency-style hero that shows examples of the product's output. A centered headline + CTA block sits on top of two counter-scrolling rows of Loteria-style example cards. Stylized SVG placeholders stand in until real AI-generated examples are produced.

## Current State

- `app/page.tsx` lines 122–152: `<header>` with h1, subheading, two CTAs, "No credit card required" line.
- `app/page.tsx` lines 155–164: "Tagline" section ("Perfect for Weddings, Parties & Family Celebrations" pill row).
- The page is a server component (converted earlier this session).

Both blocks are replaced by the new hero component. The nav bar above and the "Use Cases" section below are untouched.

## Files

| Path                           | Kind                              | Purpose                                                            |
| ------------------------------ | --------------------------------- | ------------------------------------------------------------------ |
| `components/landing-hero.tsx`  | server component                  | Top-level hero: headline, subheading, CTAs, feature pills, marquee |
| `components/card-marquee.tsx`  | client component (`"use client"`) | Two scrolling rows, hover pause, reduced-motion fallback           |
| `components/hero-card.tsx`     | shared (no directive)             | Single card (border, corners, art, label, source avatar)           |
| `components/hero-card-art.tsx` | shared (no directive)             | Inline SVG sprite + `<CardArt artKey="rose" />` lookup             |
| `lib/hero-cards.ts`            | data                              | Typed card array: `{ id, number, label, artKey, tone }`            |
| `app/page.tsx`                 | edit                              | Replace `<header>` + tagline block with `<LandingHero />`          |

## Component Responsibilities

**`LandingHero` (server)** renders the header region (headline, subheading, CTA pair, feature pills) and composes `<CardMarquee cards={...} />`. Pure markup, no client dependencies.

**`CardMarquee` (client)** takes the card array, splits it 9/9 across two rows, duplicates each row inline for a seamless CSS loop, and attaches hover handlers that add/remove a `data-paused` attribute. The attribute drives `animation-play-state: paused` via CSS. The component has no state beyond that attribute; no JS-driven animation.

**`HeroCard`** renders one card's markup: border frame, two numeric corners, art slot (from `<CardArt />`), Spanish label, and the source-avatar badge pinned top-right. No client-only APIs — a shared component that renders identically on server and client.

**`CardArt`** inline SVG `<symbol>` sprite defined once at the top of the marquee, plus a small lookup component that emits `<svg><use href="#i-{artKey}" /></svg>` per card. Keeps DOM small despite 36 rendered card instances (18 unique × 2 duplicated). Also shared (no `"use client"`), safely imported from both server (`LandingHero`) and client (`CardMarquee`).

## Card Data

18 cards in `lib/hero-cards.ts`, split into a traditional set and an event set to tell the "yours will be about YOUR people" story visually:

**Traditional (12):** La Rosa, El Sol, La Luna, El Corazón, La Estrella, El Gallo, La Sirena, La Calavera, El Nopal, El Músico, El Catrín, La Dama.

**Event-themed (6):** La Novia, El Novio, La Quinceañera, El Abuelo, La Abuela, El Bebé.

Each entry shape:

```ts
type HeroCard = {
  id: string; // stable slug, e.g. "la-rosa"
  number: string; // "01".."18", zero-padded
  label: string; // "La Rosa"
  artKey: ArtKey; // keys mapped to SVG symbols
  tone: 'marigold' | 'verde' | 'rose'; // art background gradient pair
};
```

Cards interleave the two sets when split across rows so each row shows both traditional and custom cards.

## Visual Spec

**Card** — 120px wide, 3px `var(--primary)` border, `--radius: 6px`, warm-cream (`#fffdf4`) background, `0 4px 14px rgba(0,0,0,0.12)` shadow. Numbered corners in a system serif stack (`font-family: ui-serif, Georgia, serif`) italic, vermillion. Art box is a 1:1 square, interior 1px tinted-primary border, gradient background by tone. Label below art uses the already-loaded Caveat script font (`var(--font-caveat)`), `--foreground`, 16px — the handmade feel fits "cards made for your celebration" better than a strict serif.

**Source avatar** — 30px circle pinned `-10px` top/right, subtle grey gradient with generic person SVG silhouette. Purely decorative (`aria-hidden`).

**Marquee** — `padding: 14px 0`, 14px gap between cards. Row 1 animates `translateX(0 → -50%)` over 40s; Row 2 animates `translateX(-50%` → 0)`over 45s (different durations = the rows drift apart/together, feels organic). Both use`animation-timing-function: linear`, `animation-iteration-count: infinite`. Row 2 is horizontally offset by `-60px` so cards don't align vertically with Row 1.

**Edge masks** — 60px linear-gradient fades from the page background on both left and right edges, absolute-positioned, `pointer-events: none`, so the rows appear to emerge/disappear from the edges.

**Hero copy block** — unchanged H1 and subheading (preserves SEO). CTA pair unchanged. Below CTAs, three feature pills replace the old "No credit card required" line:

- ⚡ Ready in minutes
- 🖨️ Prints on letter paper
- 💫 $5 one-time, no subscription

(Emoji rendered as inline SVG, not unicode, to avoid font-rendering variance.)

## Responsive

| Breakpoint            | Layout                                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `< 640px` (mobile)    | Headline scales to 2xl, single marquee row visible (Row 2 hidden with `hidden sm:flex`), card width 96px, duration slowed to 60s |
| `640–1024px` (tablet) | Two rows visible, card width 110px                                                                                               |
| `> 1024px` (desktop)  | Two rows, card width 120px, ~8 cards visible per row                                                                             |

Hero copy block itself stays centered with max-width constraints matching the current `max-w-6xl` container.

## Accessibility

- Marquee container: `role="region" aria-label="Example Lotería cards produced by the generator"`.
- Duplicated cards: `aria-hidden="true"` on the second copy within each row.
- Source-avatar SVG: `aria-hidden="true"`.
- Card labels, numbers, and names render as real text (indexable, screen-reader readable).
- `@media (prefers-reduced-motion: reduce)` → animation-duration 0, rows become static single-viewport-width slices with `overflow: hidden` and no translation.
- Hover pause via `data-paused` attribute also fires on keyboard focus within the marquee for parity.

## Performance / SEO

- Server-rendered HTML contains every card name and label → crawlers see 18 authentic Lotería card names in indexed text.
- SVG art is inlined via a single `<symbol>` sprite — zero additional network requests.
- Only two elements animate (one per row), using `transform: translateX` → compositor-friendly, no layout or paint work per frame.
- No images, no JS for motion itself (CSS-only), small client bundle for the hover-pause handler.

## SEO Impact

- Landing page static text density increases by ~300 words (18 card labels + feature pill text + aria labels) — all on-topic, legitimate content.
- The hero now visually demonstrates the product, which is a ranking factor for "time on page" and "engagement" signals via Vercel Analytics.
- OG image (generated earlier via `app/opengraph-image.tsx`) still represents the page — no change needed there.

## Out of Scope

- Real AI-generated example images. The component accepts `art: ReactNode` so placeholders can be swapped for real card assets later without a refactor.
- Before/after interactive slider. Marquee tells the story at a glance — a before/after feature can live in the "How It Works" section if we want it later.
- Social proof with review counts / testimonials. Feature pills serve as the trust signal until real numbers exist.
- Click-to-enlarge card interaction. Cards are presentational only.
- i18n of the hero copy. Current page is English-only; Spanish alternate locale is declared in metadata but no translated routes exist yet.

## Risks / Open Questions

- **Mobile animation smoothness** on low-end Android: mitigated by single-row mobile layout and slower duration, but worth spot-checking post-implementation.
- **Tone set size (3)**: if the visual feels too repetitive with only 3 gradient tones across 18 cards, expand to 5 tones. Easy to adjust in `lib/hero-cards.ts` without touching components.
