'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRealtime } from 'inngest/react';
import { GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { boardChannel, boardChannelTopics, type CardUpdatedPayload } from '@/lib/inngest/channels';
import { getAdminBoardRealtimeToken } from '@/app/actions/admin-board-realtime';
import { adminCardImageSrc } from '@/lib/admin-card-image';
import { cardImageProps, CARD_GRID_THUMB_WIDTH } from '@/lib/card-image';
import type { Card } from '@/db/schema';
import { EditLabelButton } from './edit-label-button';
import { AdminCardModal } from './admin-card-modal';
import type { CardOwner } from './admin-card-detail';

export function AdminBoardCardsGrid({
  boardId,
  initialCards,
  owner,
}: {
  boardId: string;
  initialCards: Card[];
  owner: CardOwner;
}) {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [reorderError, setReorderError] = useState(false);

  // The open card lives in `?card=<id>` so the modal deep-links and survives
  // a refresh. history.* calls sync with useSearchParams without a navigation.
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openCardId = searchParams.get('card');
  // True when this page pushed the open-card entry, so closing can pop it and
  // Back doesn't reopen the card.
  const pushedCardEntry = useRef(false);

  const cardUrl = useCallback(
    (cardId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (cardId) params.set('card', cardId);
      else params.delete('card');
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, searchParams]
  );

  const openCard = useCallback(
    (cardId: string) => {
      window.history.pushState(null, '', cardUrl(cardId));
      pushedCardEntry.current = true;
    },
    [cardUrl]
  );

  const pageToCard = useCallback(
    (cardId: string) => window.history.replaceState(null, '', cardUrl(cardId)),
    [cardUrl]
  );

  const closeCard = useCallback(() => {
    if (pushedCardEntry.current) {
      pushedCardEntry.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, '', cardUrl(null));
    }
  }, [cardUrl]);

  const handleLabelSaved = useCallback((cardId: string, label: string) => {
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, label } : c)));
  }, []);

  // Re-seed local state when the server hands us a new initialCards array
  // (e.g. after router.refresh() following the bulk retry POST).
  useEffect(() => {
    setCards(initialCards);
  }, [initialCards]);

  const tokenFactory = useCallback(() => getAdminBoardRealtimeToken(boardId), [boardId]);

  const channel = useMemo(() => boardChannel({ boardId }), [boardId]);

  const { connectionStatus, messages } = useRealtime({
    channel,
    topics: boardChannelTopics,
    token: tokenFactory,
    bufferInterval: 0,
  });

  // Apply each new cardUpdated message to local state.
  useEffect(() => {
    const delta = messages.delta;
    if (!delta || delta.length === 0) return;
    setCards((prev) => {
      let next = prev;
      for (const m of delta) {
        if (m.topic !== 'cardUpdated') continue;
        const { cardId, status, illustrationUrl, errorMessage } = m.data as CardUpdatedPayload;
        next = next.map((c) =>
          c.id === cardId
            ? {
                ...c,
                status,
                illustrationUrl: illustrationUrl ?? c.illustrationUrl,
                // Changes the versioned image src so the new image is fetched.
                updatedAt: new Date(),
                errorMessage: errorMessage === undefined ? c.errorMessage : errorMessage,
              }
            : c
        );
      }
      return next;
    });
  }, [messages.delta]);

  const liveDisconnected = connectionStatus === 'error' || connectionStatus === 'closed';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Saves run one at a time so a quick second drag can't land on the server
  // before the first. Once the queue drains, refresh the server props so the
  // export/preview buttons pick up the new order.
  const reorderQueue = useRef<Promise<void>>(Promise.resolve());
  const pendingReorders = useRef(0);

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const oldIndex = cards.findIndex((c) => c.id === active.id);
    const newIndex = cards.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(cards, oldIndex, newIndex).map((c, i) => ({ ...c, number: i + 1 }));
    setCards(next);
    setReorderError(false);

    const cardIds = next.map((c) => c.id);
    pendingReorders.current += 1;
    reorderQueue.current = reorderQueue.current.then(async () => {
      try {
        const res = await fetch(`/api/admin/boards/${boardId}/cards/order`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cardIds }),
        });
        if (!res.ok) throw new Error(`Reorder failed: ${res.status}`);
      } catch {
        setReorderError(true);
      } finally {
        pendingReorders.current -= 1;
        if (pendingReorders.current === 0) router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Cards ({cards.length})</h3>
        {reorderError && (
          <p role="status" aria-live="polite" className="text-xs text-destructive">
            Couldn’t save the new order — showing the saved order.
          </p>
        )}
        {!reorderError && liveDisconnected && (
          <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
            Live updates disconnected — refresh to see progress.
          </p>
        )}
      </div>
      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cards</p>
      ) : (
        <DndContext
          // Stable id so the server and client render the same aria-describedby.
          id={`admin-board-cards-${boardId}`}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={cards.map((c) => c.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
              {cards.map((card) => (
                <SortableAdminCard
                  key={card.id}
                  card={card}
                  onOpen={() => openCard(card.id)}
                  onLabelSaved={(label) => handleLabelSaved(card.id, label)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <AdminCardModal
        cards={cards}
        cardId={openCardId}
        owner={owner}
        onSelect={pageToCard}
        onClose={closeCard}
        onLabelSaved={handleLabelSaved}
      />
    </div>
  );
}

function SortableAdminCard({
  card,
  onOpen,
  onLabelSaved,
}: {
  card: Card;
  onOpen: () => void;
  onLabelSaved: (label: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });
  const imageSrc = adminCardImageSrc(card);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative ${isDragging ? 'z-10 opacity-80 shadow-lg' : ''}`}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        className="group block w-full rounded-lg border border-border p-2 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="relative mb-2 block aspect-[2/3] overflow-hidden rounded bg-muted">
          {imageSrc ? (
            <Image
              {...cardImageProps(imageSrc, CARD_GRID_THUMB_WIDTH)}
              alt={card.label || `Card ${card.number}`}
              fill
              sizes="(max-width: 640px) 25vw, (max-width: 1024px) 17vw, 130px"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No image
            </span>
          )}
          {card.status === 'error' && (
            <span className="absolute inset-0 flex items-center justify-center bg-destructive/20">
              <Badge variant="destructive" className="text-[10px]">
                Error
              </Badge>
            </span>
          )}
          {card.status === 'processing' && (
            <span className="absolute inset-0 flex items-center justify-center bg-background/40">
              <Badge variant="secondary" className="text-[10px]">
                Processing…
              </Badge>
            </span>
          )}
        </span>
        <span className="block text-center">
          <span className="block text-xs font-medium">#{card.number}</span>
          <span className="block truncate text-[10px] text-muted-foreground">
            {card.label || 'Unlabeled'}
          </span>
        </span>
      </button>
      {/* Sibling of the card button, not a child: buttons can't nest. */}
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder card #${card.number}${card.label ? ` (${card.label})` : ''}`}
        className="absolute left-3 top-3 flex size-6 cursor-grab touch-none items-center justify-center rounded bg-background/80 text-muted-foreground shadow-sm hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>
      <EditLabelButton
        cardId={card.id}
        cardNumber={card.number}
        label={card.label}
        variant="icon"
        className="absolute right-3 top-3"
        onSaved={onLabelSaved}
      />
    </div>
  );
}
