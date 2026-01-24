'use client';

import React from 'react';

import { useState } from 'react';
import { Trash2, Edit2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LotteriaCard } from '@/hooks/use-cards';
import { CardEditModal } from './card-edit-modal';

interface CardGridProps {
  cards: LotteriaCard[];
  onDeleteCard: (id: string) => void;
  onUpdateLabel: (id: string, label: string) => void;
  onReorderCards: (startIndex: number, endIndex: number) => void;
}

export function CardGrid({ cards, onDeleteCard, onUpdateLabel, onReorderCards }: CardGridProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [editingCard, setEditingCard] = useState<LotteriaCard | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (dropIndex: number) => {
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      onReorderCards(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  if (cards.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold mb-6 text-foreground">Your cards</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map((card, index) => (
          <div
            key={card.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(index)}
            onDragEnd={handleDragEnd}
            className={`group relative bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all cursor-move ${
              draggedIndex === index ? 'opacity-50' : ''
            }`}
          >
            {/* Card number overlay */}
            <div className="absolute top-2 left-2 bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm z-10">
              {card.number}
            </div>

            {/* Drag handle */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 bg-black/40 rounded p-1">
              <GripVertical className="w-4 h-4 text-white" />
            </div>

            {/* Image */}
            <div className="w-full aspect-square bg-muted overflow-hidden">
              {card.isProcessing ? (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                  <div className="text-center">
                    <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Processing...</p>
                  </div>
                </div>
              ) : card.error ? (
                <div className="w-full h-full flex items-center justify-center bg-red-50">
                  <p className="text-xs text-red-600 text-center px-2">{card.error}</p>
                </div>
              ) : (
                <img
                  src={card.illustration || '/placeholder.svg'}
                  alt={card.label}
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            {/* Label */}
            <div className="p-3 bg-white">
              <p className="text-sm font-semibold text-center text-foreground line-clamp-2 mb-2">
                {card.label}
              </p>

              {/* Action buttons */}
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1 h-8 text-xs"
                  onClick={() => setEditingCard(card)}
                  disabled={card.isProcessing}
                >
                  <Edit2 className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1 h-8 text-xs"
                  onClick={() => onDeleteCard(card.id)}
                  disabled={card.isProcessing}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editingCard && (
        <CardEditModal
          card={editingCard}
          onSave={(newLabel) => {
            onUpdateLabel(editingCard.id, newLabel);
            setEditingCard(null);
          }}
          onClose={() => setEditingCard(null)}
        />
      )}
    </div>
  );
}
