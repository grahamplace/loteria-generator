'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRealtime } from 'inngest/react';
import { Badge } from '@/components/ui/badge';
import { boardChannel, boardChannelTopics } from '@/lib/inngest/channels';
import { getAdminBoardRealtimeToken } from '@/app/actions/admin-board-realtime';
import type { Card } from '@/db/schema';

export function AdminBoardCardsGrid({
  boardId,
  initialCards,
}: {
  boardId: string;
  initialCards: Card[];
}) {
  const [cards, setCards] = useState<Card[]>(initialCards);

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
        const data = m.data as {
          cardId: string;
          status: Card['status'];
          illustrationUrl?: string;
          errorMessage?: string | null;
        };
        next = next.map((c) =>
          c.id === data.cardId
            ? {
                ...c,
                status: data.status,
                illustrationUrl: data.illustrationUrl ?? c.illustrationUrl,
                errorMessage: data.errorMessage === undefined ? c.errorMessage : data.errorMessage,
              }
            : c
        );
      }
      return next;
    });
  }, [messages.delta]);

  const liveDisconnected = connectionStatus === 'error' || connectionStatus === 'closed';

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Cards ({cards.length})</h3>
        {liveDisconnected && (
          <p className="text-xs text-muted-foreground">
            Live updates disconnected — refresh to see progress.
          </p>
        )}
      </div>
      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cards</p>
      ) : (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          {cards.map((card) => (
            <Link
              key={card.id}
              href={`/admin/cards/${card.id}`}
              className="group rounded-lg border border-border p-2 transition-colors hover:border-primary"
            >
              <div className="relative mb-2 aspect-[2/3] overflow-hidden rounded bg-muted">
                {card.illustrationUrl || card.originalImageUrl ? (
                  <Image
                    src={`/api/admin/images/${card.id}/${card.illustrationUrl ? 'illustration' : 'original'}`}
                    alt={card.label || `Card ${card.number}`}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    No image
                  </div>
                )}
                {card.status === 'error' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-destructive/20">
                    <Badge variant="destructive" className="text-[10px]">
                      Error
                    </Badge>
                  </div>
                )}
                {card.status === 'processing' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                    <Badge variant="secondary" className="text-[10px]">
                      Processing…
                    </Badge>
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="text-xs font-medium">#{card.number}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {card.label || 'Unlabeled'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
