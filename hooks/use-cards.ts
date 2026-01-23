'use client';

import { useState, useCallback } from 'react';

export interface LotteriaCard {
  id: string;
  label: string;
  illustration: string; // base64 data URL
  number: number;
  isProcessing?: boolean;
  error?: string;
}

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
    'La Campana',
    'El Cazador',
    'La Chalupa',
    'El Corazón',
    'El Diablo',
    'La Escalera',
    'El Gallo',
    'La Garza',
    'El Gorro',
    'La Guitarra',
    'El Jorobado',
    'La Luna',
    'El Melón',
    'El Músico',
    'La Palma',
    'El Pescado',
    'La Rana',
    'La Rosa',
    'El Sol',
    'La Sirena',
    'El Tambor',
    'El Valiente',
    'El Venado',
  ];

  return spanishLabels[Math.floor(Math.random() * spanishLabels.length)];
}

export function useCards() {
  const [cards, setCards] = useState<LotteriaCard[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const addCard = useCallback(async (file: File, cardNumber: number) => {
    const cardId = `card-${Date.now()}-${Math.random()}`;

    // Create a reader for the file
    const reader = new FileReader();

    reader.onload = async (e) => {
      const base64Image = e.target?.result as string;

      // Add card with processing state
      setCards((prev) => [
        ...prev,
        {
          id: cardId,
          label: 'Procesando...',
          illustration: base64Image,
          number: cardNumber,
          isProcessing: true,
        },
      ]);

      try {
        // Check if AI processing should be skipped (for dev/testing)
        const skipAIProcessing = process.env.NEXT_PUBLIC_SKIP_AI_PROCESSING === 'true';

        let illustration = base64Image; // Use uploaded image by default
        let label = 'Procesando...';

        if (skipAIProcessing) {
          // Skip AI processing entirely - use uploaded image and random Spanish label
          illustration = base64Image;
          label = getRandomSpanishLabel();
        } else {
          // Generate both image and label in parallel
          const [imageResult, labelResult] = await Promise.all([
            fetch('/api/generate-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: base64Image }),
            }),
            fetch('/api/generate-label', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: base64Image }),
            }),
          ]);

          const imageData = await imageResult.json();
          const labelData = await labelResult.json();

          if (!imageResult.ok || !labelResult.ok) {
            throw new Error('Failed to process card');
          }

          illustration = imageData.illustration;
          label = labelData.label;
        }

        // Update card with generated content
        setCards((prev) =>
          prev.map((card) =>
            card.id === cardId
              ? {
                  ...card,
                  illustration,
                  label,
                  isProcessing: false,
                }
              : card
          )
        );
      } catch (error) {
        // Update card with error
        setCards((prev) =>
          prev.map((card) =>
            card.id === cardId
              ? {
                  ...card,
                  isProcessing: false,
                  error: 'Error processing card',
                }
              : card
          )
        );
      }
    };

    reader.readAsDataURL(file);
  }, []);

  const updateCardLabel = useCallback((cardId: string, newLabel: string) => {
    setCards((prev) =>
      prev.map((card) => (card.id === cardId ? { ...card, label: newLabel } : card))
    );
  }, []);

  const deleteCard = useCallback((cardId: string) => {
    setCards((prev) => prev.filter((card) => card.id !== cardId));
  }, []);

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
  }, []);

  return {
    cards,
    addCard,
    updateCardLabel,
    deleteCard,
    reorderCards,
    isProcessing,
  };
}
