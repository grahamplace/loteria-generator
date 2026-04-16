'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Card, CardStatus } from '@/db/schema';

/**
 * Returns a random Spanish word appropriate for Loteria cards
 */
function getRandomSpanishLabel(): string {
  const spanishLabels = [
    'El Diablo',
    'La Luna',
    'El Corazón',
    'El Sol',
    'La Estrella',
    'El Árbol',
    'El Pescado',
    'La Mano',
    'El Gallo',
    'La Rosa',
    'El Cántaro',
    'La Campana',
    'El Violoncello',
    'El Venado',
    'El Perro',
    'El Catrín',
    'El Borracho',
    'La Dama',
    'El Apache',
    'El Alacrán',
    'La Araña',
    'El Arpa',
    'La Bandera',
    'El Barril',
    'La Bota',
    'El Cactus',
    'La Calavera',
    'El Camarón',
    'El Cazador',
    'La Chalupa',
    'La Escalera',
    'La Garza',
    'El Gorro',
    'La Guitarra',
    'El Jorobado',
    'El Melón',
    'El Músico',
    'La Palma',
    'La Rana',
    'La Sirena',
    'El Tambor',
    'El Valiente',
  ];
  return spanishLabels[Math.floor(Math.random() * spanishLabels.length)];
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
  boardId: string;
  number: number;
  label: string;
  originalImageUrl: string | null;
  illustrationUrl: string | null;
  status: CardStatus;
  errorMessage: string | null;
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
  updateCardLabel: (cardId: string, newLabel: string) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;
  reorderCards: (startIndex: number, endIndex: number) => void;
  refreshCards: () => Promise<void>;
  isUnlocked: boolean;
  cardLimit: number;
}

/**
 * Hook for managing cards for a specific board
 * Combines local state for instant UX with API persistence
 */
export function useBoardCards(boardId: string, isUnlocked: boolean = false): UseBoardCardsReturn {
  const [cards, setCards] = useState<BoardCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const cardLimit = isUnlocked ? 54 : 16;

  const fetchCards = useCallback(async () => {
    if (!boardId) return;

    try {
      setIsLoading(true);
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
    fetchCards();
  }, [fetchCards]);

  const addCard = useCallback(
    async (file: File) => {
      const base64Image = await readFileAsDataURL(file);
      const tempId = createTempId();

      // Optimistic update — derive number from current state to avoid stale closure
      setCards((prev) => [
        ...prev,
        {
          id: tempId,
          boardId,
          number: prev.length + 1,
          label: 'Processing…',
          originalImageUrl: null,
          illustrationUrl: null,
          status: 'processing' as CardStatus,
          errorMessage: null,
          localOriginalImage: base64Image,
          isProcessing: true,
        },
      ]);

      try {
        // Create card in database (server assigns the canonical number)
        const createResponse = await fetch(`/api/boards/${boardId}/cards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalImageBase64: base64Image,
            label: '',
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

        // Update card with real ID and server-assigned number
        setCards((prev) =>
          prev.map((c) =>
            c.id === tempId
              ? {
                  ...c,
                  id: createdCard.id,
                  number: createdCard.number,
                  originalImageUrl: createdCard.originalImageUrl,
                  status: 'processing' as CardStatus,
                }
              : c
          )
        );

        // Check if AI processing should be skipped
        const skipAIProcessing = process.env.NEXT_PUBLIC_SKIP_AI_PROCESSING === 'true';

        let illustration = base64Image;
        let label = getRandomSpanishLabel();

        if (!skipAIProcessing) {
          // Generate both image and label in parallel
          const [imageResult, labelResult] = await Promise.all([
            fetch('/api/generate-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: base64Image, boardId }),
            }),
            fetch('/api/generate-label', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: base64Image }),
            }),
          ]);

          if (imageResult.ok && labelResult.ok) {
            const imageData = await imageResult.json();
            const labelData = await labelResult.json();
            illustration = imageData.illustration;
            label = labelData.label;
          } else {
            // Check if it's a generation limit error
            if (!imageResult.ok) {
              const errorData = await imageResult.json();
              if (errorData.code === 'GENERATION_LIMIT_REACHED') {
                throw new Error(errorData.message || 'Generation limit reached');
              }
            }
            throw new Error('Failed to process card with AI');
          }
        }

        // Update card in database with generated content
        const updateResponse = await fetch(`/api/boards/${boardId}/cards`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cardId: createdCard.id,
            label,
            illustrationBase64: illustration,
            status: 'completed',
          }),
        });

        if (!updateResponse.ok) {
          throw new Error('Failed to save generated content');
        }

        const { card: updatedCard } = await updateResponse.json();

        // Update local state
        setCards((prev) =>
          prev.map((c) =>
            c.id === createdCard.id
              ? {
                  ...c,
                  label: updatedCard.label,
                  illustrationUrl: updatedCard.illustrationUrl,
                  localIllustration: illustration,
                  status: 'completed' as CardStatus,
                  isProcessing: false,
                }
              : c
          )
        );
      } catch (err) {
        console.error('Error processing card:', err);
        // Update card with error state
        setCards((prev) =>
          prev.map((c) =>
            c.id === tempId || c.localOriginalImage === base64Image
              ? {
                  ...c,
                  status: 'error' as CardStatus,
                  errorMessage: 'Failed to process card',
                  isProcessing: false,
                }
              : c
          )
        );
        toast.error('Failed to process card');
      }
    },
    [boardId, cardLimit, isUnlocked]
  );

  const processCardAI = useCallback(
    async (serverId: string, base64Image: string) => {
      try {
        const skipAIProcessing = process.env.NEXT_PUBLIC_SKIP_AI_PROCESSING === 'true';
        let illustration = base64Image;
        let label = getRandomSpanishLabel();

        if (!skipAIProcessing) {
          const [imageResult, labelResult] = await Promise.all([
            fetch('/api/generate-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: base64Image, boardId }),
            }),
            fetch('/api/generate-label', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: base64Image }),
            }),
          ]);

          if (imageResult.ok && labelResult.ok) {
            const imageData = await imageResult.json();
            const labelData = await labelResult.json();
            illustration = imageData.illustration;
            label = labelData.label;
          } else {
            if (!imageResult.ok) {
              const errorData = await imageResult.json();
              if (errorData.code === 'GENERATION_LIMIT_REACHED') {
                throw new Error(errorData.message || 'Generation limit reached');
              }
            }
            throw new Error('Failed to process card with AI');
          }
        }

        const updateResponse = await fetch(`/api/boards/${boardId}/cards`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cardId: serverId,
            label,
            illustrationBase64: illustration,
            status: 'completed',
          }),
        });

        if (!updateResponse.ok) {
          throw new Error('Failed to save generated content');
        }

        const { card: updatedCard } = await updateResponse.json();

        setCards((prev) =>
          prev.map((c) =>
            c.id === serverId
              ? {
                  ...c,
                  label: updatedCard.label,
                  illustrationUrl: updatedCard.illustrationUrl,
                  localIllustration: illustration,
                  status: 'completed' as CardStatus,
                  isProcessing: false,
                }
              : c
          )
        );
      } catch (err) {
        console.error('Error processing card:', err);
        setCards((prev) =>
          prev.map((c) =>
            c.id === serverId
              ? {
                  ...c,
                  status: 'error' as CardStatus,
                  errorMessage: 'Failed to process card',
                  isProcessing: false,
                }
              : c
          )
        );
        toast.error('Failed to process card');
      }
    },
    [boardId]
  );

  const addCards = useCallback(
    async (files: File[]) => {
      // Read all files upfront
      const fileData = await Promise.all(
        files.map(async (file) => ({
          base64: await readFileAsDataURL(file),
          tempId: createTempId(),
        }))
      );

      // Add all optimistic cards at once
      setCards((prev) => {
        const newCards = fileData.map((fd, i) => ({
          id: fd.tempId,
          boardId,
          number: prev.length + i + 1,
          label: 'Processing…',
          originalImageUrl: null,
          illustrationUrl: null,
          status: 'processing' as CardStatus,
          errorMessage: null,
          localOriginalImage: fd.base64,
          isProcessing: true,
        }));
        return [...prev, ...newCards];
      });

      // Create cards on server SEQUENTIALLY to avoid number race condition
      const created: Array<{ serverId: string; base64: string }> = [];

      for (const fd of fileData) {
        try {
          const res = await fetch(`/api/boards/${boardId}/cards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ originalImageBase64: fd.base64, label: '' }),
          });

          if (!res.ok) {
            const data = await res.json();
            if (data.code === 'CARD_LIMIT_REACHED') {
              setCards((prev) => prev.filter((c) => c.id !== fd.tempId));
              toast.error('Card limit reached', { description: data.message });
              continue;
            }
            throw new Error('Failed to create card');
          }

          const { card: serverCard } = await res.json();

          setCards((prev) =>
            prev.map((c) =>
              c.id === fd.tempId
                ? {
                    ...c,
                    id: serverCard.id,
                    number: serverCard.number,
                    originalImageUrl: serverCard.originalImageUrl,
                  }
                : c
            )
          );

          created.push({ serverId: serverCard.id, base64: fd.base64 });
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

      // Process AI for all created cards IN PARALLEL (the slow part)
      await Promise.allSettled(
        created.map(({ serverId, base64 }) => processCardAI(serverId, base64))
      );
    },
    [boardId, processCardAI]
  );

  const updateCardLabel = useCallback(
    async (cardId: string, newLabel: string) => {
      // Optimistic update
      setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, label: newLabel } : c)));

      try {
        const response = await fetch(`/api/boards/${boardId}/cards`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cardId, label: newLabel }),
        });

        if (!response.ok) {
          throw new Error('Failed to update label');
        }
      } catch (err) {
        // Revert on error
        await fetchCards();
        toast.error('Failed to update label');
      }
    },
    [boardId, fetchCards]
  );

  const deleteCard = useCallback(
    async (cardId: string) => {
      // Optimistic update
      // Optimistic update: remove card and renumber remaining cards
      setCards((prev) => {
        const filtered = prev.filter((c) => c.id !== cardId);
        // Renumber cards based on their new positions
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
        // Revert on error
        await fetchCards();
        toast.error('Failed to delete card');
      }
    },
    [boardId, fetchCards]
  );

  const reorderCards = useCallback((startIndex: number, endIndex: number) => {
    setCards((prev) => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);

      // Update numbers based on new order
      return result.map((card, index) => ({
        ...card,
        number: index + 1,
      }));
    });
    // Note: We don't persist reorder to server since card numbers
    // are mainly for display and board generation uses shuffling
  }, []);

  return {
    cards,
    isLoading,
    error,
    addCard,
    addCards,
    updateCardLabel,
    deleteCard,
    reorderCards,
    refreshCards: fetchCards,
    isUnlocked,
    cardLimit,
  };
}
