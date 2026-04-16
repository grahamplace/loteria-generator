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
