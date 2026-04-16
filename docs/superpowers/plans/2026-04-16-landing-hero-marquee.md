# Landing Hero with Card Marquee — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current text-only landing hero with an agency-style hero: centered headline + CTAs above two counter-scrolling rows of Loteria-style example cards, rendered with stylized inline-SVG placeholders.

**Architecture:** One server component (`LandingHero`) composes a client marquee (`CardMarquee`) that scrolls pre-rendered `HeroCard` markup. Card data is static in `lib/hero-cards.ts`; art is an inline SVG `<symbol>` sprite looked up by key. Animation is pure CSS `@keyframes transform: translateX` with `animation-play-state: paused` driven by a `data-paused` attribute on hover/focus. `prefers-reduced-motion` disables the animation via CSS media query.

**Tech Stack:** Next.js App Router (server + client components), Tailwind v4, Vitest + React Testing Library, CSS keyframes in `app/globals.css`, inline SVG sprite. Existing fonts: Geist (sans) + Caveat (script, via `var(--font-caveat)`).

**Reference:** Full spec at `docs/superpowers/specs/2026-04-16-landing-hero-marquee-design.md`.

---

## Task 1: Card data + types

Create the static card list used by the marquee. Pure data, easy to unit-test for shape and uniqueness, and the first thing every downstream component depends on.

**Files:**

- Create: `lib/hero-cards.ts`
- Create: `__tests__/lib/hero-cards.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/hero-cards.test.ts
import { describe, it, expect } from 'vitest';
import { heroCards, type HeroCard, type ArtKey, type Tone } from '@/lib/hero-cards';

describe('heroCards', () => {
  it('exports 18 cards', () => {
    expect(heroCards).toHaveLength(18);
  });

  it('has unique ids across all cards', () => {
    const ids = heroCards.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique zero-padded two-digit numbers 01-18', () => {
    const numbers = heroCards.map((c) => c.number).sort();
    const expected = Array.from({ length: 18 }, (_, i) => String(i + 1).padStart(2, '0')).sort();
    expect(numbers).toEqual(expected);
  });

  it('every card has a non-empty Spanish label', () => {
    for (const card of heroCards) {
      expect(card.label.length).toBeGreaterThan(0);
    }
  });

  it('every card uses a valid tone', () => {
    const tones: Tone[] = ['marigold', 'verde', 'rose'];
    for (const card of heroCards) {
      expect(tones).toContain(card.tone);
    }
  });

  it('includes both classic and event-themed cards', () => {
    const labels = heroCards.map((c) => c.label);
    // Classic
    expect(labels).toContain('La Rosa');
    expect(labels).toContain('El Sol');
    expect(labels).toContain('La Luna');
    // Event-themed
    expect(labels).toContain('La Novia');
    expect(labels).toContain('La Quinceañera');
  });

  it('HeroCard and ArtKey types are exported', () => {
    const sample: HeroCard = {
      id: 'test',
      number: '01',
      label: 'Test',
      artKey: 'rose' as ArtKey,
      tone: 'marigold',
    };
    expect(sample).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/lib/hero-cards.test.ts`
Expected: FAIL — `Cannot find module '@/lib/hero-cards'`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/hero-cards.ts
export type ArtKey =
  | 'rose'
  | 'sun'
  | 'moon'
  | 'heart'
  | 'star'
  | 'rooster'
  | 'mermaid'
  | 'skull'
  | 'cactus'
  | 'guitar'
  | 'crown'
  | 'dame'
  | 'bride'
  | 'groom'
  | 'quince'
  | 'grandpa'
  | 'grandma'
  | 'baby';

export type Tone = 'marigold' | 'verde' | 'rose';

export type HeroCard = {
  id: string;
  number: string;
  label: string;
  artKey: ArtKey;
  tone: Tone;
};

export const heroCards: HeroCard[] = [
  // Classic Loteria (12)
  { id: 'la-rosa', number: '01', label: 'La Rosa', artKey: 'rose', tone: 'marigold' },
  { id: 'el-sol', number: '02', label: 'El Sol', artKey: 'sun', tone: 'verde' },
  { id: 'la-luna', number: '03', label: 'La Luna', artKey: 'moon', tone: 'rose' },
  { id: 'el-corazon', number: '04', label: 'El Corazón', artKey: 'heart', tone: 'rose' },
  { id: 'la-estrella', number: '05', label: 'La Estrella', artKey: 'star', tone: 'marigold' },
  { id: 'el-gallo', number: '06', label: 'El Gallo', artKey: 'rooster', tone: 'verde' },
  { id: 'la-sirena', number: '07', label: 'La Sirena', artKey: 'mermaid', tone: 'verde' },
  { id: 'la-calavera', number: '08', label: 'La Calavera', artKey: 'skull', tone: 'rose' },
  { id: 'el-nopal', number: '09', label: 'El Nopal', artKey: 'cactus', tone: 'verde' },
  { id: 'el-musico', number: '10', label: 'El Músico', artKey: 'guitar', tone: 'marigold' },
  { id: 'el-catrin', number: '11', label: 'El Catrín', artKey: 'crown', tone: 'marigold' },
  { id: 'la-dama', number: '12', label: 'La Dama', artKey: 'dame', tone: 'rose' },
  // Event-themed (6)
  { id: 'la-novia', number: '13', label: 'La Novia', artKey: 'bride', tone: 'marigold' },
  { id: 'el-novio', number: '14', label: 'El Novio', artKey: 'groom', tone: 'verde' },
  { id: 'la-quinceanera', number: '15', label: 'La Quinceañera', artKey: 'quince', tone: 'rose' },
  { id: 'el-abuelo', number: '16', label: 'El Abuelo', artKey: 'grandpa', tone: 'marigold' },
  { id: 'la-abuela', number: '17', label: 'La Abuela', artKey: 'grandma', tone: 'verde' },
  { id: 'el-bebe', number: '18', label: 'El Bebé', artKey: 'baby', tone: 'rose' },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/lib/hero-cards.test.ts`
Expected: PASS — 7 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/hero-cards.ts __tests__/lib/hero-cards.test.ts
git commit -m "feat(hero): add typed hero-cards data module"
```

---

## Task 2: Card art SVG sprite + lookup

A single shared component that emits a `<defs>` sprite of all 18 `<symbol>` art icons (one time per page) and a `<CardArt>` lookup that emits `<svg><use href="#..." /></svg>`.

**Files:**

- Create: `components/hero-card-art.tsx`

**No test for this task.** It's a pure passthrough: input `artKey`, output `<use href={...} />`. The meaningful behavior is exercised by the `LandingHero` integration test in Task 5 (verifies every card renders an art element).

- [ ] **Step 1: Write the implementation**

```tsx
// components/hero-card-art.tsx
import type { ArtKey } from '@/lib/hero-cards';

/**
 * Inline SVG symbol sprite. Render <HeroCardArtSprite /> once at the top of
 * any tree that uses <CardArt />.
 */
export function HeroCardArtSprite() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }} focusable="false">
      <defs>
        <symbol id="hero-art-rose" viewBox="0 0 24 24">
          <path
            d="M12 2c-2 2-3 5-3 7 0 2 1 4 3 4s3-2 3-4c0-2-1-5-3-7zM8 13c-2 0-4 1-4 3s2 3 4 3c1 0 2-0.5 2-1M16 13c2 0 4 1 4 3s-2 3-4 3c-1 0-2-0.5-2-1M12 17v5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </symbol>
        <symbol id="hero-art-sun" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="2" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="2" y1="12" x2="5" y2="12" />
            <line x1="19" y1="12" x2="22" y2="12" />
            <line x1="4.5" y1="4.5" x2="6.5" y2="6.5" />
            <line x1="17.5" y1="17.5" x2="19.5" y2="19.5" />
            <line x1="4.5" y1="19.5" x2="6.5" y2="17.5" />
            <line x1="17.5" y1="6.5" x2="19.5" y2="4.5" />
          </g>
        </symbol>
        <symbol id="hero-art-moon" viewBox="0 0 24 24">
          <path d="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z" fill="currentColor" />
        </symbol>
        <symbol id="hero-art-heart" viewBox="0 0 24 24">
          <path
            d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"
            fill="currentColor"
          />
        </symbol>
        <symbol id="hero-art-star" viewBox="0 0 24 24">
          <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" fill="currentColor" />
        </symbol>
        <symbol id="hero-art-rooster" viewBox="0 0 24 24">
          <path
            d="M6 16c0-4 2-6 5-6M11 10l4-5 1 3 3-1-1 4 3 1-3 2-2 4-3-2M6 16c-2 0-3 2-3 4h18c0-2-1-4-3-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </symbol>
        <symbol id="hero-art-mermaid" viewBox="0 0 24 24">
          <path
            d="M12 3a3 3 0 0 1 0 6 3 3 0 0 1 0-6zM12 9c-2 2-4 5-4 8 0 2 2 4 4 4s4-2 4-4c0-3-2-6-4-8zM6 21c2-1 4 1 6 0s4 1 6 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </symbol>
        <symbol id="hero-art-skull" viewBox="0 0 24 24">
          <path
            d="M12 2a8 8 0 0 0-8 8v4l2 2v3h3v-2h6v2h3v-3l2-2v-4a8 8 0 0 0-8-8z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="11" r="1.3" fill="currentColor" />
          <circle cx="15" cy="11" r="1.3" fill="currentColor" />
        </symbol>
        <symbol id="hero-art-cactus" viewBox="0 0 24 24">
          <path
            d="M10 22h4v-6h3a2 2 0 0 0 2-2V9a2 2 0 0 0-4 0v3h-1V4a2 2 0 0 0-4 0v12H9a2 2 0 0 1-2-2V11a2 2 0 0 0-4 0v3a2 2 0 0 0 2 2h5v6z"
            fill="currentColor"
          />
        </symbol>
        <symbol id="hero-art-guitar" viewBox="0 0 24 24">
          <path
            d="M17 3l4 4-6 6M14 10a4 4 0 1 0-4 4l-4 4 2 2 4-4a4 4 0 0 0 2-6z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </symbol>
        <symbol id="hero-art-crown" viewBox="0 0 24 24">
          <path
            d="M3 18V8l4 3 5-7 5 7 4-3v10zM3 18h18"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </symbol>
        <symbol id="hero-art-dame" viewBox="0 0 24 24">
          <circle cx="12" cy="7" r="3" fill="currentColor" />
          <path
            d="M7 22c0-3 2-5 5-5s5 2 5 5M8 11h8M6 14c1-1 2-1 3 0M15 14c1-1 2-1 3 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </symbol>
        <symbol id="hero-art-bride" viewBox="0 0 24 24">
          <path
            d="M12 2c-2.5 0-4 2-4 4v2c0 2.5 1.5 4 4 4s4-1.5 4-4V6c0-2-1.5-4-4-4zM6 22c0-4 3-6 6-6s6 2 6 6M8 10c-2 2-2 6 0 8M16 10c2 2 2 6 0 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </symbol>
        <symbol id="hero-art-groom" viewBox="0 0 24 24">
          <circle cx="12" cy="7" r="3" fill="currentColor" />
          <path
            d="M6 22c0-4 3-6 6-6s6 2 6 6M10 14l2 2 2-2M9 16l3 4 3-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </symbol>
        <symbol id="hero-art-quince" viewBox="0 0 24 24">
          <path d="M12 2l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z" fill="currentColor" />
          <circle cx="12" cy="15" r="3" fill="currentColor" />
          <path d="M7 22c0-3 2-4 5-4s5 1 5 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </symbol>
        <symbol id="hero-art-grandpa" viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="3" fill="currentColor" />
          <path
            d="M9 10c-1 1-1 3 0 4M15 10c1 1 1 3 0 4M7 22c0-3 2-5 5-5s5 2 5 5M10 7h4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </symbol>
        <symbol id="hero-art-grandma" viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="3" fill="currentColor" />
          <path
            d="M8 6l4-3 4 3M7 22c0-3 2-5 5-5s5 2 5 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </symbol>
        <symbol id="hero-art-baby" viewBox="0 0 24 24">
          <circle cx="12" cy="10" r="5" fill="currentColor" />
          <circle cx="10" cy="9" r="0.8" fill="#fffdf4" />
          <circle cx="14" cy="9" r="0.8" fill="#fffdf4" />
          <path
            d="M10 12c0.5 1 1.5 1 2 1s1.5 0 2-1M8 20c0-2 2-3 4-3s4 1 4 3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </symbol>
      </defs>
    </svg>
  );
}

/**
 * Renders a single art SVG by looking up the symbol sprite.
 * Color inherits via currentColor — set color on the parent.
 */
export function CardArt({ artKey, className }: { artKey: ArtKey; className?: string }) {
  return (
    <svg
      className={className}
      width="100%"
      height="100%"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <use href={`#hero-art-${artKey}`} />
    </svg>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit`
Expected: PASS (no errors)

- [ ] **Step 3: Commit**

```bash
git add components/hero-card-art.tsx
git commit -m "feat(hero): add SVG sprite + CardArt lookup for hero cards"
```

---

## Task 3: HeroCard component

One card: border, numeric corners, art, label, source avatar. No behavior — presentational. Skipped direct test; behavior verified via integration.

**Files:**

- Create: `components/hero-card.tsx`

- [ ] **Step 1: Write the implementation**

```tsx
// components/hero-card.tsx
import type { HeroCard as HeroCardData, Tone } from '@/lib/hero-cards';
import { CardArt } from './hero-card-art';

const toneGradients: Record<Tone, string> = {
  marigold: 'linear-gradient(135deg, #fde0a4 0%, #f5c263 100%)',
  verde: 'linear-gradient(135deg, #b3d9d6 0%, #7fc2bf 100%)',
  rose: 'linear-gradient(135deg, #e8b4b4 0%, #d48a8a 100%)',
};

export function HeroCard({ card, duplicate = false }: { card: HeroCardData; duplicate?: boolean }) {
  return (
    <div
      className="relative flex-none w-[120px] rounded-md border-[3px] border-primary bg-[#fffdf4] p-2 pt-3 shadow-[0_4px_14px_rgba(0,0,0,0.12)]"
      aria-hidden={duplicate ? 'true' : undefined}
    >
      <span
        className="absolute left-1.5 top-1 text-[11px] font-extrabold italic text-primary"
        style={{ fontFamily: 'ui-serif, Georgia, serif' }}
      >
        {card.number}
      </span>
      <span
        className="absolute right-1.5 top-1 text-[11px] font-extrabold italic text-primary"
        style={{ fontFamily: 'ui-serif, Georgia, serif' }}
      >
        {card.number}
      </span>
      <div
        className="mt-3 flex aspect-square items-center justify-center rounded-sm text-primary"
        style={{
          background: toneGradients[card.tone],
          border: '1px solid rgba(200, 54, 46, 0.25)',
        }}
      >
        <div style={{ width: '60%', height: '60%' }}>
          <CardArt artKey={card.artKey} />
        </div>
      </div>
      <div
        className="mt-1.5 text-center text-[16px] italic text-foreground"
        style={{ fontFamily: 'var(--font-caveat), ui-serif, Georgia, serif' }}
      >
        {card.label}
      </div>
      <div
        className="absolute -right-2.5 -top-2.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white shadow-md"
        style={{ background: 'linear-gradient(135deg, #d4d4d4, #a8a8a8)' }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="#fff" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 22c0-4.5 3.5-8 8-8s8 3.5 8 8" fill="none" stroke="#fff" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/hero-card.tsx
git commit -m "feat(hero): add HeroCard presentational component"
```

---

## Task 4: Marquee keyframes in globals.css

Add the CSS keyframes, hover-pause, and reduced-motion handling. This is CSS-only — no test.

**Files:**

- Modify: `app/globals.css` (append)

- [ ] **Step 1: Append to `app/globals.css`**

Add this block at the end of the file:

```css
/* Hero card marquee animation */
@keyframes hero-marquee-scroll-left {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}

@keyframes hero-marquee-scroll-right {
  from {
    transform: translateX(-50%);
  }
  to {
    transform: translateX(0);
  }
}

.hero-marquee-row {
  display: flex;
  gap: 14px;
  width: max-content;
  will-change: transform;
}

.hero-marquee-row--left {
  animation: hero-marquee-scroll-left 40s linear infinite;
}

.hero-marquee-row--right {
  animation: hero-marquee-scroll-right 45s linear infinite;
}

.hero-marquee[data-paused='true'] .hero-marquee-row {
  animation-play-state: paused;
}

@media (prefers-reduced-motion: reduce) {
  .hero-marquee-row {
    animation: none !important;
    transform: translateX(0) !important;
  }
  .hero-marquee {
    overflow-x: auto;
  }
}

@media (max-width: 640px) {
  .hero-marquee-row--right {
    display: none;
  }
  .hero-marquee-row--left {
    animation-duration: 60s;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "feat(hero): add marquee scroll keyframes + reduced-motion styles"
```

---

## Task 5: CardMarquee client component

The scrolling rows. Client component because it listens for hover/focus to set `data-paused`. Split input array in half, duplicate each row inline for seamless loop, mark duplicates `aria-hidden`.

**Files:**

- Create: `components/card-marquee.tsx`
- Create: `__tests__/components/card-marquee.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/components/card-marquee.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardMarquee } from '@/components/card-marquee';
import { heroCards } from '@/lib/hero-cards';

describe('CardMarquee', () => {
  it('renders a region landmark with a descriptive label', () => {
    render(<CardMarquee cards={heroCards} />);
    const region = screen.getByRole('region', { name: /example lotería cards/i });
    expect(region).toBeInTheDocument();
  });

  it('renders each unique card label at least once in the DOM', () => {
    render(<CardMarquee cards={heroCards} />);
    for (const card of heroCards) {
      // getAllByText because duplicates also render the label
      const matches = screen.getAllByText(card.label);
      expect(matches.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('renders two rows with distinct class modifiers', () => {
    const { container } = render(<CardMarquee cards={heroCards} />);
    expect(container.querySelector('.hero-marquee-row--left')).not.toBeNull();
    expect(container.querySelector('.hero-marquee-row--right')).not.toBeNull();
  });

  it('duplicates each row for seamless looping (doubles the card count per row)', () => {
    const { container } = render(<CardMarquee cards={heroCards} />);
    const leftRow = container.querySelector('.hero-marquee-row--left')!;
    // 9 cards + 9 duplicates = 18 cards in the left row
    expect(leftRow.children.length).toBe(18);
  });

  it('sets data-paused=true when the marquee receives pointer enter', () => {
    const { container } = render(<CardMarquee cards={heroCards} />);
    const marquee = container.querySelector('.hero-marquee') as HTMLElement;
    expect(marquee.dataset.paused).toBeUndefined();
    fireEvent.pointerEnter(marquee);
    expect(marquee.dataset.paused).toBe('true');
    fireEvent.pointerLeave(marquee);
    expect(marquee.dataset.paused).toBe('false');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/components/card-marquee.test.tsx`
Expected: FAIL — `Cannot find module '@/components/card-marquee'`.

- [ ] **Step 3: Write the implementation**

```tsx
// components/card-marquee.tsx
'use client';

import { useState } from 'react';
import type { HeroCard as HeroCardData } from '@/lib/hero-cards';
import { HeroCard } from './hero-card';
import { HeroCardArtSprite } from './hero-card-art';

export function CardMarquee({ cards }: { cards: HeroCardData[] }) {
  const [paused, setPaused] = useState(false);
  const mid = Math.ceil(cards.length / 2);
  const rowA = cards.slice(0, mid);
  const rowB = cards.slice(mid);

  return (
    <div
      role="region"
      aria-label="Example Lotería cards produced by the generator"
      className="hero-marquee relative mt-2"
      data-paused={paused ? 'true' : 'false'}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <HeroCardArtSprite />
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[60px]"
        style={{
          background: 'linear-gradient(90deg, #f5f0e1 0%, transparent 100%)',
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[60px]"
        style={{
          background: 'linear-gradient(270deg, #f5f0e1 0%, transparent 100%)',
        }}
        aria-hidden="true"
      />

      <div className="hero-marquee-row hero-marquee-row--left py-3.5">
        {rowA.map((card) => (
          <HeroCard key={`a-${card.id}`} card={card} />
        ))}
        {rowA.map((card) => (
          <HeroCard key={`a-dup-${card.id}`} card={card} duplicate />
        ))}
      </div>

      <div
        className="hero-marquee-row hero-marquee-row--right py-3.5"
        style={{ marginLeft: '-60px' }}
      >
        {rowB.map((card) => (
          <HeroCard key={`b-${card.id}`} card={card} />
        ))}
        {rowB.map((card) => (
          <HeroCard key={`b-dup-${card.id}`} card={card} duplicate />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/components/card-marquee.test.tsx`
Expected: PASS — 5 passed.

- [ ] **Step 5: Commit**

```bash
git add components/card-marquee.tsx __tests__/components/card-marquee.test.tsx
git commit -m "feat(hero): add CardMarquee client component with hover-pause"
```

---

## Task 6: LandingHero composition

The top-level server component. Headline, subheading, CTAs, feature pills, then the marquee. The integration test verifies every card label renders in server-rendered HTML (the SEO payoff).

**Files:**

- Create: `components/landing-hero.tsx`
- Create: `__tests__/components/landing-hero.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/components/landing-hero.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LandingHero } from '@/components/landing-hero';
import { heroCards } from '@/lib/hero-cards';

describe('LandingHero', () => {
  it('renders the H1 with "Lotería" keyword', () => {
    render(<LandingHero />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toMatch(/Lotería/);
    expect(h1.textContent).toMatch(/Custom/i);
  });

  it('renders the primary CTA linking to /sign-up', () => {
    render(<LandingHero />);
    const cta = screen.getByRole('link', { name: /create your lotería cards free/i });
    expect(cta).toHaveAttribute('href', '/sign-up');
  });

  it('renders the secondary CTA linking to #how-it-works', () => {
    render(<LandingHero />);
    const cta = screen.getByRole('link', { name: /see how it works/i });
    expect(cta).toHaveAttribute('href', '#how-it-works');
  });

  it('renders all three feature pills', () => {
    render(<LandingHero />);
    expect(screen.getByText(/ready in minutes/i)).toBeInTheDocument();
    expect(screen.getByText(/prints on letter paper/i)).toBeInTheDocument();
    expect(screen.getByText(/no subscription/i)).toBeInTheDocument();
  });

  it('renders every hero card label (SEO content density)', () => {
    render(<LandingHero />);
    for (const card of heroCards) {
      expect(screen.getAllByText(card.label).length).toBeGreaterThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/components/landing-hero.test.tsx`
Expected: FAIL — `Cannot find module '@/components/landing-hero'`.

- [ ] **Step 3: Write the implementation**

```tsx
// components/landing-hero.tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CardMarquee } from '@/components/card-marquee';
import { heroCards } from '@/lib/hero-cards';

const featurePills = [
  {
    title: 'Ready in minutes',
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    title: 'Prints on letter paper',
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </svg>
    ),
  },
  {
    title: '$5 one-time, no subscription',
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polygon points="12 2 15 8 22 9 17 14 18 21 12 18 6 21 7 14 2 9 9 8 12 2" />
      </svg>
    ),
  },
];

export function LandingHero() {
  return (
    <header className="relative overflow-hidden bg-gradient-to-b from-orange-50 to-background pb-10 pt-12 md:pb-16 md:pt-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="mb-6 text-4xl font-bold text-foreground md:text-6xl">
            Create Custom <span className="text-primary">Lotería</span> Cards
            <br />
            <span className="text-3xl md:text-5xl">from Your Photos</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-xl text-muted-foreground">
            The easiest <strong>custom Lotería card maker</strong> powered by AI. Transform your
            photos into beautiful Mexican Lotería-style illustrations. Perfect for{' '}
            <strong>weddings</strong>, <strong>quinceañeras</strong>, <strong>parties</strong>, and{' '}
            <strong>family celebrations</strong>.
          </p>
          <div className="mb-6 flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/sign-up">
              <Button size="lg" className="w-full px-8 text-lg sm:w-auto">
                Create Your Lotería Cards Free
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button size="lg" variant="outline" className="w-full px-8 text-lg sm:w-auto">
                See How It Works
              </Button>
            </Link>
          </div>
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {featurePills.map((p) => (
              <li key={p.title} className="inline-flex items-center gap-1.5">
                <span className="text-primary">{p.icon}</span>
                {p.title}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-[1400px] md:mt-14">
        <CardMarquee cards={heroCards} />
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/components/landing-hero.test.tsx`
Expected: PASS — 5 passed.

- [ ] **Step 5: Commit**

```bash
git add components/landing-hero.tsx __tests__/components/landing-hero.test.tsx
git commit -m "feat(hero): compose LandingHero with copy, CTAs, pills, and marquee"
```

---

## Task 7: Wire LandingHero into the landing page

Replace the current `<header>` and tagline section in `app/page.tsx` with a single `<LandingHero />`. The nav bar above and "Use Cases" section below are untouched.

**Files:**

- Modify: `app/page.tsx`

- [ ] **Step 1: Add the import**

Open `app/page.tsx`. Add to the import block:

```tsx
import { LandingHero } from '@/components/landing-hero';
```

- [ ] **Step 2: Replace the hero + tagline sections**

Locate the current `<header>` element (starts around line 123 with `<header className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">`) through the end of the tagline `<section>` (ends with the `</section>` before the "Use Cases" block, around line 164).

Delete that entire block and replace with a single line:

```tsx
<LandingHero />
```

After the edit, the area between the closing `</nav>` and the `{/* Use Cases */}` comment should contain only `<LandingHero />`.

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: all existing tests plus the three new suites pass. If any pre-existing tests fail that are unrelated to this change, note them but do not fix them in this task.

- [ ] **Step 4: Run the build to confirm no type or server-component errors**

Run: `npm run build`
Expected: build succeeds; the landing route `/` stays `ƒ` (dynamic, server-rendered). Warnings about `BETTER_AUTH_SECRET` are pre-existing and fine.

- [ ] **Step 5: Manual browser check**

Run: `npm run dev`
Open the dev URL in a browser (not signed in). Verify:

1. The new hero renders with the headline, CTAs, feature pills, and two scrolling rows of cards.
2. Hovering the marquee pauses both rows; leaving resumes them.
3. With the browser's DevTools → Rendering → Emulate CSS media feature `prefers-reduced-motion` set to `reduce`, the rows stop animating.
4. Resize to mobile width (≤640px): only one row shows, and it still scrolls.
5. View page source and confirm all 18 card labels (La Rosa, El Sol, La Luna, El Corazón, La Estrella, El Gallo, La Sirena, La Calavera, El Nopal, El Músico, El Catrín, La Dama, La Novia, El Novio, La Quinceañera, El Abuelo, La Abuela, El Bebé) appear in the initial HTML response.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx
git commit -m "feat(landing): swap text hero for agency-style hero with card marquee"
```

---

## Task 8: Verification

Final pass — lint, typecheck, full test run, full build.

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: PASS with no errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: PASS (or only pre-existing warnings unrelated to this change).

- [ ] **Step 3: Full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: build succeeds. The `/` route remains server-rendered on demand.

- [ ] **Step 5: Done**

No commit needed if everything passes — all artifacts have been committed in earlier tasks.
