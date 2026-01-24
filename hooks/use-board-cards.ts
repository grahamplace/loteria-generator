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
      if (cards.length >= cardLimit) {
        toast.error('Card limit reached', {
          description: isUnlocked
            ? `Maximum of ${cardLimit} cards allowed`
            : `Unlock this board to add more than ${cardLimit} cards`,
        });
        return;
      }

      const reader = new FileReader();

      reader.onload = async (e) => {
        const base64Image = e.target?.result as string;
        const tempId = createTempId();
        const nextNumber = cards.length + 1;

        // Optimistic update - add card immediately with local state
        setCards((prev) => [
          ...prev,
          {
            id: tempId,
            boardId,
            number: nextNumber,
            label: 'Processing...',
            originalImageUrl: null,
            illustrationUrl: null,
            status: 'processing' as CardStatus,
            errorMessage: null,
            localOriginalImage: base64Image,
            isProcessing: true,
          },
        ]);

        try {
          // Create card in database
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

          // Update card with real ID
          setCards((prev) =>
            prev.map((c) =>
              c.id === tempId
                ? {
                    ...c,
                    id: createdCard.id,
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
      };

      reader.readAsDataURL(file);
    },
    [boardId, cards.length, cardLimit, isUnlocked]
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
      setCards((prev) => prev.filter((c) => c.id !== cardId));

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
    updateCardLabel,
    deleteCard,
    reorderCards,
    refreshCards: fetchCards,
    isUnlocked,
    cardLimit,
  };
}
