'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { adminCardImageSrc, adminCardProxySrc } from '@/lib/admin-card-image';
import { cardImageProps, CARD_DETAIL_THUMB_WIDTH } from '@/lib/card-image';
import type { Card } from '@/db/schema';
import { AdminCardDetail, type CardOwner } from './admin-card-detail';

function isTypingTarget(el: Element) {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

/** Warm the browser cache for a card's detail images so paging feels instant. */
function preloadCard(card: Card) {
  const srcs = [adminCardImageSrc(card)];
  if (card.originalImageUrl) srcs.push(adminCardProxySrc(card.id, 'original', card.updatedAt));
  for (const src of srcs) {
    if (!src) continue;
    const { src: url, unoptimized } = cardImageProps(src, CARD_DETAIL_THUMB_WIDTH);
    // Optimized (public) srcs go through /_next/image at a width we can't
    // predict here; only the proxy URLs are worth warming.
    if (unoptimized) new window.Image().src = url;
  }
}

/**
 * Full-screen card view over the admin board grid. ←/→ page through the
 * board's cards in grid order.
 */
export function AdminCardModal({
  cards,
  cardId,
  owner,
  onSelect,
  onClose,
  onLabelSaved,
}: {
  cards: Card[];
  cardId: string | null;
  owner: CardOwner;
  onSelect: (cardId: string) => void;
  onClose: () => void;
  onLabelSaved: (cardId: string, label: string) => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const index = cardId ? cards.findIndex((c) => c.id === cardId) : -1;
  const card = index === -1 ? null : cards[index];
  // Paging wraps: ← on the first card goes to the last, → on the last to the
  // first. A one-card board has nowhere to go.
  const canPage = index !== -1 && cards.length > 1;
  const prev = canPage ? cards[(index - 1 + cards.length) % cards.length] : null;
  const next = canPage ? cards[(index + 1) % cards.length] : null;

  useEffect(() => {
    if (!card) return;

    function onKey(e: KeyboardEvent) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const content = contentRef.current;
      if (!content) return;
      // Leave arrows alone while a nested modal (crop, replace, whole image)
      // is open, or while focus is in a text field or a portaled popover.
      if (content.querySelector('[role="dialog"]')) return;
      const target = e.target as Element;
      if (isTypingTarget(target)) return;
      if (target !== document.body && target.closest('[role="dialog"]') !== content) return;

      const to = e.key === 'ArrowLeft' ? prev : next;
      if (!to) return;
      e.preventDefault();
      onSelect(to.id);
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [card, prev, next, onSelect]);

  useEffect(() => {
    if (prev) preloadCard(prev);
    if (next) preloadCard(next);
  }, [prev, next]);

  return (
    <DialogPrimitive.Root open={card !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        {/* Dimmed, blurred board stays visible around the panel, so it reads
            as a layer over the grid rather than a new page. */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          ref={contentRef}
          aria-describedby={undefined}
          // Radix focuses the first button (Previous) on open, which then shows
          // a focus ring for the whole session of arrow-key paging. Focus the
          // panel itself instead; Tab still reaches every control.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            contentRef.current?.focus();
          }}
          onEscapeKeyDown={(e) => {
            // The card view hosts its own inline modals; let them take Escape first.
            if (contentRef.current?.querySelector('[role="dialog"]')) {
              e.preventDefault();
              return;
            }
            // In a text field, Escape leaves the field rather than closing the
            // modal and dropping what was typed. Fields marked
            // data-escape-handled (inline label edit) do their own thing.
            const active = document.activeElement;
            if (active && isTypingTarget(active)) {
              e.preventDefault();
              if (!active.hasAttribute('data-escape-handled')) (active as HTMLElement).blur();
            }
          }}
          className="fixed inset-2 z-50 flex flex-col overflow-hidden rounded-xl border border-foreground/10 bg-background shadow-[0_1px_3px_rgb(0_0_0/0.12),0_24px_64px_-12px_rgb(0_0_0/0.45)] focus:outline-none sm:inset-6 lg:inset-10 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:zoom-in-95 motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=closed]:zoom-out-95"
          style={{ overscrollBehavior: 'contain' }}
        >
          {card && (
            <>
              <header className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2 sm:px-6">
                <DialogPrimitive.Title className="min-w-0 flex-1 truncate text-sm font-semibold">
                  <span className="tabular-nums">
                    {index + 1} / {cards.length}
                  </span>
                  <span className="text-muted-foreground"> · </span>
                  {card.label || 'Unlabeled'}
                </DialogPrimitive.Title>
                <span className="hidden items-center gap-1 text-xs text-muted-foreground md:flex">
                  <Kbd>←</Kbd>
                  <Kbd>→</Kbd>
                  to page
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => prev && onSelect(prev.id)}
                  disabled={!prev}
                  aria-label="Previous card"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => next && onSelect(next.id)}
                  disabled={!next}
                  aria-label="Next card"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
                <Button asChild variant="ghost" size="icon">
                  <Link
                    href={`/admin/cards/${card.id}`}
                    target="_blank"
                    aria-label="Open card page in a new tab"
                  >
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
                <DialogPrimitive.Close asChild>
                  <Button variant="outline" size="sm" className="ml-1">
                    <X className="size-4" aria-hidden="true" />
                    Close
                    <Kbd className="hidden md:inline-flex">Esc</Kbd>
                  </Button>
                </DialogPrimitive.Close>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:overflow-hidden">
                {/* Keyed so per-card state (regenerate prompt, whole-image view) resets on paging. */}
                <AdminCardDetail
                  key={card.id}
                  card={card}
                  owner={owner}
                  onLabelSaved={(label) => onLabelSaved(card.id, label)}
                />
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
