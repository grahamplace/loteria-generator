'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Maximize2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cardImageProps, CARD_DETAIL_THUMB_WIDTH } from '@/lib/card-image';
import { adminCardProxySrc } from '@/lib/admin-card-image';
import type { Card } from '@/db/schema';
import { RegenerateButton } from './regenerate-button';
import { RecropButton } from './recrop-button';
import { ReplaceIllustrationButton } from './replace-illustration-button';
import { UseOriginalButton } from './use-original-button';
import { InlineLabelEdit } from './inline-label-edit';
import { EditRiddleForm } from './edit-riddle-form';

export type CardOwner = { id: string; name: string | null; email: string };

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'completed' ? 'default' : status === 'error' ? 'destructive' : 'secondary';
  return <Badge variant={variant}>{status}</Badge>;
}

/**
 * The admin card view: original upload | AI illustration | control pane. Shared
 * by the /admin/cards/[id] page and the board view's full-screen card modal.
 *
 * From lg up it fills its parent's height and each image shrinks to fit, so
 * both are fully visible without scrolling; the parent must give it a height.
 * Below lg the three stack and the page scrolls.
 */
export function AdminCardDetail({
  card,
  board,
  owner,
  headerExtra,
  onLabelSaved,
}: {
  card: Card;
  /** The user who created the card (the board's owner). */
  owner?: CardOwner;
  /** Shown as a metadata link when the board isn't already the context. */
  board?: { id: string; name: string };
  /** Rendered under the heading (e.g. a "View Board" link). */
  headerExtra?: React.ReactNode;
  onLabelSaved?: (label: string) => void;
}) {
  const [showWholeOriginal, setShowWholeOriginal] = useState(false);
  const originalSrc = adminCardProxySrc(card.id, 'original', card.updatedAt);

  return (
    <div className="grid gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_20rem]">
      <ImagePane title="Original Upload">
        {card.originalImageUrl ? (
          <button
            type="button"
            onClick={() => setShowWholeOriginal(true)}
            aria-label="Show the whole original image"
            className={`${IMAGE_FRAME} group cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
            style={IMAGE_FRAME_STYLE}
          >
            <Image
              {...cardImageProps(originalSrc, CARD_DETAIL_THUMB_WIDTH)}
              alt="Original upload"
              fill
              sizes="(max-width: 1024px) 100vw, 33vw"
              className="object-cover"
            />
            <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-background/85 px-2 py-1 text-xs font-medium text-foreground shadow-sm transition-opacity group-hover:opacity-100 sm:opacity-80">
              <Maximize2 className="size-3.5" aria-hidden="true" />
              Whole image
            </span>
          </button>
        ) : (
          <EmptyFrame>No image</EmptyFrame>
        )}
      </ImagePane>

      <ImagePane title="AI Illustration">
        {card.illustrationUrl ? (
          <div className={IMAGE_FRAME} style={IMAGE_FRAME_STYLE}>
            <Image
              {...cardImageProps(
                card.isDefault
                  ? card.illustrationUrl
                  : adminCardProxySrc(card.id, 'illustration', card.updatedAt),
                CARD_DETAIL_THUMB_WIDTH
              )}
              alt="AI illustration"
              fill
              sizes="(max-width: 1024px) 100vw, 33vw"
              className="object-cover"
            />
          </div>
        ) : (
          <EmptyFrame>No illustration</EmptyFrame>
        )}
      </ImagePane>

      <aside
        aria-label="Card controls"
        className="space-y-4 rounded-lg border border-border p-4 lg:min-h-0 lg:overflow-y-auto"
      >
        <div className="flex items-center justify-between gap-2">
          <InlineLabelEdit
            cardId={card.id}
            cardNumber={card.number}
            label={card.label}
            onSaved={onLabelSaved}
          />
          <StatusBadge status={card.status} />
        </div>

        {headerExtra}

        {!card.isDefault && (
          // Side by side, splitting the pane's width.
          <div className="flex flex-wrap gap-2 [&>*]:flex-1">
            {card.preserveOriginal && card.originalImageUrl && (
              <RecropButton
                cardId={card.id}
                boardId={card.boardId}
                initialCrop={card.cropData ?? null}
              />
            )}
            {card.originalImageUrl && !card.preserveOriginal && (
              <UseOriginalButton cardId={card.id} />
            )}
            <ReplaceIllustrationButton cardId={card.id} />
          </div>
        )}

        {card.status === 'error' && card.errorMessage && (
          <div className="rounded border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-xs font-medium text-destructive">Error Message</p>
            <p className="mt-1 break-words text-sm">{card.errorMessage}</p>
          </div>
        )}

        <EditRiddleForm cardId={card.id} cardNumber={card.number} riddle={card.riddle} />

        {card.originalImageUrl && (
          <RegenerateButton
            cardId={card.id}
            boardId={card.boardId}
            initialOverlay={card.promptOverlay}
          />
        )}

        <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
          {board && (
            <div className="col-span-2 min-w-0">
              <dt className="text-xs text-muted-foreground">Board</dt>
              <dd>
                <Link href={`/admin/boards/${board.id}`} className="block truncate hover:underline">
                  {board.name}
                </Link>
              </dd>
            </div>
          )}
          {owner && (
            <div className="col-span-2 min-w-0">
              <dt className="text-xs text-muted-foreground">Created by</dt>
              <dd>
                <Link href={`/admin/users/${owner.id}`} className="group block min-w-0">
                  {owner.name && (
                    <span className="block truncate group-hover:underline">{owner.name}</span>
                  )}
                  <span
                    className={`block truncate ${owner.name ? 'text-xs text-muted-foreground' : 'group-hover:underline'}`}
                  >
                    {owner.email}
                  </span>
                </Link>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted-foreground">Created</dt>
            <dd>{new Date(card.createdAt).toLocaleDateString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Updated</dt>
            <dd>{new Date(card.updatedAt).toLocaleDateString()}</dd>
          </div>
        </dl>
      </aside>

      {showWholeOriginal && (
        <WholeImageViewer src={originalSrc} onClose={() => setShowWholeOriginal(false)} />
      )}
    </div>
  );
}

// The frame is the largest 2:3 box that fits its pane: `cqw`/`cqh` are the
// pane's own width and height (it is a size container), so the card shape
// holds whichever dimension runs out first.
const IMAGE_FRAME =
  'relative block aspect-[2/3] overflow-hidden rounded border border-border bg-muted';
const IMAGE_FRAME_STYLE: React.CSSProperties = { width: 'min(100cqw, 100cqh * 2 / 3)' };

function ImagePane({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border p-4 lg:min-h-0">
      <h3 className="text-sm font-medium">{title}</h3>
      {/* Fixed height when stacked; fills the row from lg up. */}
      <div
        className="flex h-[70dvh] items-center justify-center lg:h-auto lg:min-h-0 lg:flex-1"
        style={{ containerType: 'size' }}
      >
        {children}
      </div>
    </section>
  );
}

function EmptyFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${IMAGE_FRAME} flex items-center justify-center border-dashed`}
      style={IMAGE_FRAME_STYLE}
    >
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

/**
 * Full-viewport view of an image at its own aspect ratio and full resolution
 * (no `?w=` resize). Rendered inline rather than portaled, so inside the board
 * modal it stays within that dialog's focus trap.
 */
function WholeImageViewer({ src, onClose }: { src: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Whole original image"
      className="fixed inset-0 z-[60] flex cursor-zoom-out items-center justify-center bg-black/90 p-4"
      style={{ overscrollBehavior: 'contain' }}
      onClick={onClose}
    >
      {/* Full-size, auth-gated proxy image: next/image can't optimize it. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Whole original upload" className="max-h-full max-w-full object-contain" />
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close whole image"
        className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-background/90 text-foreground shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <X className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
