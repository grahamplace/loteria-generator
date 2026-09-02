'use client';

import Image from 'next/image';

/**
 * One cell of a Player's Board.
 *
 * Deliberately does NOT show whether the card has been Called. Ticket 07 made
 * paying attention the game, so highlighting called tiles would hand the Player
 * the answer and turn marking into clerical work.
 */
export function CardTile({
  label,
  src,
  marked,
  onToggle,
}: {
  label: string;
  src: string;
  marked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={marked}
      aria-label={marked ? `${label}, marked` : label}
      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
      className="relative flex aspect-2/3 flex-col overflow-hidden rounded-md border border-border bg-card focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
    >
      <Image
        src={src}
        alt=""
        fill
        sizes="25vw"
        className={`object-cover transition-opacity motion-reduce:transition-none ${
          marked ? 'opacity-40' : 'opacity-100'
        }`}
      />
      <span className="relative mt-auto w-full bg-card/90 px-0.5 py-0.5 text-center text-[9px] leading-tight font-medium text-foreground">
        {label}
      </span>
      {/* Two cues, not colour alone: the tile dims and a bean lands on it. */}
      {marked && (
        <span
          aria-hidden
          className="absolute inset-0 m-auto h-8 w-8 rounded-full bg-primary/85 ring-2 ring-primary-foreground/50"
        />
      )}
    </button>
  );
}
