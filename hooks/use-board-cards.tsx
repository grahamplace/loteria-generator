'use client';
import { filenameToLabel } from '@/lib/filename-label';
import type { PhotoMode } from '@/lib/themes/presets';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Card, CardStatus } from '@/db/schema';
import { useCardStream } from '@/hooks/use-card-stream';
import { FREE_CARD_LIMIT, TOTAL_CARD_COUNT } from '@/lib/constants';
import { DEFAULT_CARDS_BY_ID } from '@/lib/default-cards';

function preloadImage(src: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // Fail open — UI falls back on regular <img> behavior.
    img.src = src;
  });
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function createTempId() {
  // Date.now() alone can collide when multiple cards are added quickly (same ms).
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `temp-${crypto.randomUUID()}`
    : `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export interface BoardCard {
  id: string;
  /**
   * Stable React key that persists across the optimistic `temp-xxx` → server
   * UUID swap. Use this for list `key` props so cards don't unmount/remount
   * (and replay enter animations) when the server response arrives.
   */
  clientKey: string;
  boardId: string;
  number: number;
  label: string;
  riddle: string | null;
  originalImageUrl: string | null;
  illustrationUrl: string | null;
  savedIllustrationUrl?: string | null;
  status: CardStatus;
  errorMessage: string | null;
  isDefault: boolean;
  defaultCardId: string | null;
  preserveOriginal?: boolean;
  cropData?: Card['cropData'];
  imageVersion?: number;
  // Local state for optimistic UI
  localOriginalImage?: string; // base64 for immediate display
  localIllustration?: string; // base64 for immediate display
  isProcessing?: boolean;
}

interface UseBoardCardsReturn {
  cards: BoardCard[];
  isLoading: boolean;
  error: string | null;
  addCard: (file: File) => Promise<void>;
  addCards: (files: File[]) => Promise<void>;
  addDefaultCards: (defaultCardIds: string[]) => Promise<void>;
  updateCardLabel: (cardId: string, newLabel: string, newRiddle?: string) => Promise<void>;
  changePhotoMode: (cardId: string, photoMode: PhotoMode) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;
  reorderCards: (startIndex: number, endIndex: number) => void;
  refreshCards: () => Promise<void>;
  isUnlocked: boolean;
  cardLimit: number;
  /**
   * Render this inside your tree. It mounts a Realtime subscription per
   * processing card and updates state as the background job emits events.
   */
  CardStreamSubscriptions: React.ReactNode;
}

/**
 * Hook for managing cards for a specific board
 * Combines local state for instant UX with API persistence
 */
export function useBoardCards(
  boardId: string,
  isUnlocked: boolean = false,
  photoMode: PhotoMode = 'illustrated'
): UseBoardCardsReturn {
  const [cards, setCards] = useState<BoardCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const cardLimit = isUnlocked ? TOTAL_CARD_COUNT : FREE_CARD_LIMIT;

  const fetchCards = useCallback(async () => {
    if (!boardId) return;

    try {
      setError(null);

      const response = await fetch(`/api/boards/${boardId}/cards`);

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/sign-in');
          return;
        }
        throw new Error('Failed to fetch cards');
      }

      const data = await response.json();
      setCards(
        (data.cards || []).map((card: Card) => ({
          ...card,
          imageVersion: new Date(card.updatedAt).getTime(),
          clientKey: card.id,
          isProcessing: card.status === 'processing',
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cards');
    } finally {
      setIsLoading(false);
    }
  }, [boardId, router]);

  useEffect(() => {
    // Only the initial board load replaces the editor with a skeleton. Edits
    // refresh cards in place so the live preview and download state stay mounted.
    setIsLoading(true);
    fetchCards();
  }, [fetchCards]);

  // Safety net: Realtime messages published before the client subscribes are
  // lost (live-only WebSocket, no replay). Poll while any card is processing
  // so the UI recovers even if the terminal 'completed' message is missed.
  // This poll is silent: it does not toggle isLoading and merges server state
  // into existing cards (preserving optimistic local previews).
  const pollProcessingCards = useCallback(async () => {
    if (!boardId) return;
    try {
      const response = await fetch(`/api/boards/${boardId}/cards`);
      if (!response.ok) return;
      const data = await response.json();
      const serverById = new Map<string, Card>((data.cards || []).map((c: Card) => [c.id, c]));

      // For any card the poll discovers as newly completed, preload the
      // illustration first so the UI doesn't flash the original photo + new
      // label when we flip processing → completed.
      await Promise.all(
        Array.from(serverById.values())
          .filter((s) => s.status === 'completed' && s.illustrationUrl)
          .map((s) =>
            preloadImage(
              `/api/images/${boardId}/${s.id}/illustration?v=${new Date(s.updatedAt).getTime()}`
            )
          )
      );

      setCards((prev) =>
        prev.map((local) => {
          if (local.id.startsWith('temp-')) return local;
          const server = serverById.get(local.id);
          if (!server) return local;
          const completing = local.isProcessing && server.status === 'completed';
          return {
            ...local,
            number: server.number,
            label: server.label || local.label,
            originalImageUrl: server.originalImageUrl,
            illustrationUrl: server.illustrationUrl,
            savedIllustrationUrl: server.savedIllustrationUrl,
            preserveOriginal: server.preserveOriginal,
            cropData: server.cropData,
            imageVersion: new Date(server.updatedAt).getTime(),
            status: server.status,
            errorMessage: server.errorMessage,
            isProcessing: server.status === 'processing',
            // Drop the base64 preview once the server's illustration is cached
            // so the URL-backed image wins the display-precedence chain.
            ...(completing
              ? { localOriginalImage: undefined, localIllustration: undefined }
              : null),
          };
        })
      );
    } catch {
      // Ignore transient poll errors — next tick will retry.
    }
  }, [boardId]);

  const hasProcessing = cards.some((c) => c.isProcessing);
  useEffect(() => {
    if (!hasProcessing) return;
    const id = setInterval(pollProcessingCards, 10_000);
    return () => clearInterval(id);
  }, [hasProcessing, pollProcessingCards]);

  /**
   * Merge server-returned card state into local state, preserving the
   * base64 preview already painted by the optimistic update.
   */
  const mergeServerCard = useCallback((tempId: string, serverCard: Card) => {
    setCards((prev) =>
      prev.map((c) =>
        c.id === tempId
          ? {
              ...c,
              id: serverCard.id,
              number: serverCard.number,
              preserveOriginal: serverCard.preserveOriginal,
              cropData: serverCard.cropData,
              ...(serverCard.status === 'completed' ? { localOriginalImage: undefined } : {}),
              originalImageUrl: serverCard.originalImageUrl,
              illustrationUrl: serverCard.illustrationUrl,
              savedIllustrationUrl: serverCard.savedIllustrationUrl,
              imageVersion: new Date(serverCard.updatedAt).getTime(),
              label: serverCard.label || c.label,
              status: serverCard.status,
              errorMessage: serverCard.errorMessage,
              isProcessing: serverCard.status === 'processing',
            }
          : c
      )
    );
  }, []);

  const addCard = useCallback(
    async (file: File) => {
      const base64Image = await readFileAsDataURL(file);
      const tempId = createTempId();

      // Optimistic update — match server numbering (MAX(number) + 1), which
      // is greater than prev.length whenever the board has deleted-number gaps.
      setCards((prev) => [
        ...prev,
        {
          id: tempId,
          clientKey: tempId,
          boardId,
          number: prev.reduce((max, c) => (c.number > max ? c.number : max), 0) + 1,
          label: '',
          riddle: null,
          originalImageUrl: null,
          illustrationUrl: null,
          status: 'processing' as CardStatus,
          errorMessage: null,
          isDefault: false,
          defaultCardId: null,
          localOriginalImage: base64Image,
          isProcessing: true,
        },
      ]);

      try {
        const createResponse = await fetch(`/api/boards/${boardId}/cards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalImageBase64: base64Image,
            label: photoMode === 'original' ? filenameToLabel(file.name).slice(0, 200) : '',
          }),
        });

        if (!createResponse.ok) {
          const data = await createResponse.json();
          if (data.code === 'CARD_LIMIT_REACHED') {
            setCards((prev) => prev.filter((c) => c.id !== tempId));
            toast.error('Card limit reached', { description: data.message });
            return;
          }
          throw new Error('Failed to create card');
        }

        const { card: createdCard } = await createResponse.json();
        mergeServerCard(tempId, createdCard);
      } catch (err) {
        console.error('Error creating card:', err);
        setCards((prev) =>
          prev.map((c) =>
            c.id === tempId
              ? {
                  ...c,
                  status: 'error' as CardStatus,
                  errorMessage: 'Failed to create card',
                  isProcessing: false,
                }
              : c
          )
        );
        toast.error('Failed to create card');
      }
    },
    [boardId, mergeServerCard, photoMode]
  );

  const addCards = useCallback(
    async (files: File[]) => {
      const fileData = await Promise.all(
        files.map(async (file) => ({
          base64: await readFileAsDataURL(file),
          tempId: createTempId(),
          label: photoMode === 'original' ? filenameToLabel(file.name).slice(0, 200) : '',
        }))
      );

      setCards((prev) => {
        const maxNumber = prev.reduce((max, c) => (c.number > max ? c.number : max), 0);
        const newCards = fileData.map((fd, i) => ({
          id: fd.tempId,
          clientKey: fd.tempId,
          boardId,
          number: maxNumber + i + 1,
          label: '',
          riddle: null,
          originalImageUrl: null,
          illustrationUrl: null,
          status: 'processing' as CardStatus,
          errorMessage: null,
          isDefault: false,
          defaultCardId: null,
          localOriginalImage: fd.base64,
          isProcessing: true,
        }));
        return [...prev, ...newCards];
      });

      // Create cards on server SEQUENTIALLY to avoid number race condition
      for (const fd of fileData) {
        try {
          const res = await fetch(`/api/boards/${boardId}/cards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ originalImageBase64: fd.base64, label: fd.label }),
          });

          if (!res.ok) {
            const data = await res.json();
            if (data.code === 'CARD_LIMIT_REACHED') {
              setCards((prev) => prev.filter((c) => c.id !== fd.tempId));
              toast.error(
                data.code === 'CARD_LIMIT_REACHED'
                  ? 'Card limit reached'
                  : 'Generation limit reached',
                { description: data.message }
              );
              continue;
            }
            throw new Error('Failed to create card');
          }

          const { card: serverCard } = await res.json();
          mergeServerCard(fd.tempId, serverCard);
        } catch (err) {
          console.error('Error creating card:', err);
          setCards((prev) =>
            prev.map((c) =>
              c.id === fd.tempId
                ? {
                    ...c,
                    status: 'error' as CardStatus,
                    errorMessage: 'Failed to create card',
                    isProcessing: false,
                  }
                : c
            )
          );
          toast.error('Failed to create card');
        }
      }
    },
    [boardId, mergeServerCard, photoMode]
  );

  const addDefaultCards = useCallback(
    async (defaultCardIds: string[]) => {
      // Resolve label + URL up-front so the optimistic cards render correctly.
      const tempEntries = defaultCardIds.map((id) => {
        const def = DEFAULT_CARDS_BY_ID[id];
        if (!def) throw new Error(`Unknown default card id: ${id}`);
        return { id, def, tempId: createTempId() };
      });

      setCards((prev) => {
        const maxNumber = prev.reduce((max, c) => (c.number > max ? c.number : max), 0);
        const newCards: BoardCard[] = tempEntries.map((entry, i) => ({
          id: entry.tempId,
          clientKey: entry.tempId,
          boardId,
          number: maxNumber + i + 1,
          label: entry.def.label,
          riddle: null,
          originalImageUrl: null,
          illustrationUrl: entry.def.src,
          status: 'completed' as CardStatus,
          errorMessage: null,
          isDefault: true,
          defaultCardId: entry.id,
        }));
        return [...prev, ...newCards];
      });

      try {
        const res = await fetch(`/api/boards/${boardId}/cards/defaults`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ defaultCardIds }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          // Roll back all temps for this batch.
          setCards((prev) => prev.filter((c) => !tempEntries.some((e) => e.tempId === c.id)));
          if (data.code === 'CARD_LIMIT_REACHED') {
            toast.error('Card limit reached', { description: data.message });
            return;
          }
          if (data.code === 'ALREADY_ADDED') {
            toast.error('Already added', {
              description: 'One of those classics is already on this board.',
            });
            return;
          }
          if (data.code === 'INVALID_DEFAULT_ID') {
            toast.error('Could not add classic', { description: 'Unknown card id.' });
            return;
          }
          if (data.code === 'DUPLICATE_IDS') {
            toast.error('Could not add classics', {
              description: 'Duplicate ids in request.',
            });
            return;
          }
          throw new Error('Failed to add classics');
        }

        const { cards: serverCards } = (await res.json()) as { cards: Card[] };
        // Match each temp to its server row by defaultCardId.
        setCards((prev) =>
          prev.map((c) => {
            const matching = serverCards.find((s) => s.defaultCardId === c.defaultCardId);
            if (matching && tempEntries.some((e) => e.tempId === c.id)) {
              return {
                ...c,
                id: matching.id,
                clientKey: matching.id,
                number: matching.number,
                status: matching.status as CardStatus,
                isDefault: matching.isDefault,
                defaultCardId: matching.defaultCardId,
              };
            }
            return c;
          })
        );
      } catch (err) {
        console.error('Error adding default cards:', err);
        setCards((prev) => prev.filter((c) => !tempEntries.some((e) => e.tempId === c.id)));
        toast.error('Failed to add classics');
      }
    },
    [boardId]
  );

  const updateCardLabel = useCallback(
    async (cardId: string, newLabel: string, newRiddle?: string) => {
      // Optimistic update
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? { ...c, label: newLabel, ...(newRiddle !== undefined ? { riddle: newRiddle } : {}) }
            : c
        )
      );

      try {
        const body: { cardId: string; label: string; riddle?: string } = {
          cardId,
          label: newLabel,
        };
        if (newRiddle !== undefined) body.riddle = newRiddle;

        const response = await fetch(`/api/boards/${boardId}/cards`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error('Failed to update label');
        }
      } catch (err) {
        await fetchCards();
        toast.error('Failed to update label');
      }
    },
    [boardId, fetchCards]
  );

  const changePhotoMode = useCallback(
    async (cardId: string, photoMode: PhotoMode) => {
      const response = await fetch(`/api/boards/${boardId}/cards/${cardId}/photo-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoMode }),
      });
      if (!response.ok) throw new Error('Failed to change card photo mode');
      const { card } = await response.json();
      mergeServerCard(cardId, card);
    },
    [boardId, mergeServerCard]
  );

  const deleteCard = useCallback(
    async (cardId: string) => {
      // Optimistic update: remove card and renumber remaining cards
      setCards((prev) => {
        const filtered = prev.filter((c) => c.id !== cardId);
        return filtered.map((card, index) => ({
          ...card,
          number: index + 1,
        }));
      });

      try {
        const response = await fetch(`/api/boards/${boardId}/cards?cardId=${cardId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete card');
        }

        toast.success('Card deleted');
      } catch (err) {
        await fetchCards();
        toast.error('Failed to delete card');
      }
    },
    [boardId, fetchCards]
  );

  // Reorder saves run one at a time so a quick second drag can't land on the
  // server before the first and leave the older order persisted.
  const reorderQueue = useRef<Promise<void>>(Promise.resolve());

  const reorderCards = useCallback(
    (startIndex: number, endIndex: number) => {
      const moveCard = (list: BoardCard[]) => {
        const result = Array.from(list);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        return result.map((card, index) => ({ ...card, number: index + 1 }));
      };

      setCards(moveCard);

      // Temp cards aren't on the server yet; the server keeps any card the
      // request omits, so leaving them out is safe.
      const cardIds = moveCard(cards)
        .map((c) => c.id)
        .filter((id) => !id.startsWith('temp-'));

      reorderQueue.current = reorderQueue.current.then(async () => {
        try {
          const response = await fetch(`/api/boards/${boardId}/cards/order`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cardIds }),
          });
          if (!response.ok) {
            throw new Error('Failed to save card order');
          }
        } catch {
          toast.error('Failed to save card order');
          await fetchCards();
        }
      });
    },
    [boardId, cards, fetchCards]
  );

  const applyStreamCompletion = useCallback(
    async (cardId: string, data: { label: string; illustrationUrl: string }) => {
      // Preload the final illustration so the card doesn't flash the original
      // photo + new label while the image URL is still in flight. We keep the
      // card in the processing state until the browser has the image cached,
      // then flip atomically to completed (clearing the localOriginalImage
      // preview so the illustration URL wins the display-precedence chain).
      await preloadImage(`/api/images/${boardId}/${cardId}/illustration?v=${Date.now()}`);
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? {
                ...c,
                label: data.label,
                illustrationUrl: data.illustrationUrl,
                savedIllustrationUrl: c.preserveOriginal
                  ? c.savedIllustrationUrl
                  : data.illustrationUrl,
                imageVersion: Date.now(),
                status: 'completed' as CardStatus,
                errorMessage: null,
                isProcessing: false,
                localOriginalImage: undefined,
                localIllustration: undefined,
              }
            : c
        )
      );
    },
    [boardId]
  );

  const applyStreamError = useCallback((cardId: string, message: string) => {
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? {
              ...c,
              status: 'error' as CardStatus,
              errorMessage: message,
              isProcessing: false,
            }
          : c
      )
    );
    toast.error('Failed to process card', { description: message });
  }, []);

  // Only subscribe to cards that have a real server ID (not temp) and are still processing.
  const processingIds = useMemo(
    () => cards.filter((c) => c.isProcessing && !c.id.startsWith('temp-')).map((c) => c.id),
    [cards]
  );

  const CardStreamSubscriptions = (
    <>
      {processingIds.map((id) => (
        <CardStreamSubscription
          key={id}
          cardId={id}
          onCompleted={applyStreamCompletion}
          onError={applyStreamError}
        />
      ))}
    </>
  );

  return {
    cards,
    isLoading,
    error,
    addCard,
    addCards,
    addDefaultCards,
    updateCardLabel,
    changePhotoMode,
    deleteCard,
    reorderCards,
    refreshCards: fetchCards,
    isUnlocked,
    cardLimit,
    CardStreamSubscriptions,
  };
}

/**
 * Renders nothing — just mounts a realtime subscription for a single
 * processing card and forwards terminal events to the parent hook.
 */
function CardStreamSubscription({
  cardId,
  onCompleted,
  onError,
}: {
  cardId: string;
  onCompleted: (cardId: string, data: { label: string; illustrationUrl: string }) => void;
  onError: (cardId: string, message: string) => void;
}) {
  useCardStream(cardId, true, {
    onCompleted: (data) => onCompleted(cardId, data),
    onError: (message) => onError(cardId, message),
  });
  return null;
}
