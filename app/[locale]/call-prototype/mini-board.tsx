'use client';

/** PROTOTYPE — a Player's 4×4 Board at thumbnail size, mirroring their Marks.
 *  Ticket 12 made Marks available to the Caller; this is what that buys. */
import { imageFor } from './fake-call';

export function MiniBoard({
  board,
  marked,
  size = 'sm',
}: {
  board: string[];
  marked: number[];
  size?: 'sm' | 'md';
}) {
  const set = new Set(marked);
  return (
    <div className={`grid grid-cols-4 gap-px ${size === 'md' ? 'w-28' : 'w-16'}`}>
      {board.map((slug, cell) => (
        <div key={cell} className="relative aspect-2/3 overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageFor(slug)}
            alt=""
            className={`h-full w-full object-cover ${set.has(cell) ? 'opacity-30' : ''}`}
          />
          {set.has(cell) && (
            <span
              aria-hidden
              className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-primary"
            />
          )}
        </div>
      ))}
    </div>
  );
}
