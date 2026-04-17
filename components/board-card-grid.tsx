'use client';

import { useState, useEffect } from 'react';
import { Trash2, Edit2, GripVertical, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CardEditModal } from './card-edit-modal';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';

interface DisplayCard {
  id: string;
  /**
   * Stable React/dnd-kit identifier that survives the optimistic `temp-xxx` →
   * server UUID swap. Prevents AnimatePresence from replaying the enter
   * animation when the server response arrives.
   */
  clientKey: string;
  number: number;
  label: string;
  illustration: string;
  isProcessing?: boolean;
  error?: string;
}

interface BoardCardGridProps {
  cards: DisplayCard[];
  onDeleteCard: (id: string) => void;
  onUpdateLabel: (id: string, label: string) => void;
  onReorderCards: (startIndex: number, endIndex: number) => void;
}

interface SortableCardProps {
  card: DisplayCard;
  onDelete: () => void;
  onEdit: () => void;
  isDragging?: boolean;
}

function SortableCard({ card, onDelete, onEdit, isDragging }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: card.clientKey, disabled: card.isProcessing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isSortableDragging ? 50 : undefined,
    borderRadius: '2px',
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: isSortableDragging ? 0.5 : 1,
        scale: 1,
      }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{
        layout: { type: 'spring', stiffness: 350, damping: 25 },
        opacity: { duration: 0.2 },
        scale: { duration: 0.2 },
      }}
      className={`group relative bg-[#f5f0e1] overflow-hidden shadow-md hover:shadow-lg border-2 border-black/80 ${
        card.isProcessing ? 'cursor-wait' : 'cursor-grab active:cursor-grabbing'
      } ${isDragging ? 'ring-2 ring-primary ring-offset-2' : ''}`}
      {...attributes}
      {...listeners}
    >
      <CardContent card={card} onDelete={onDelete} onEdit={onEdit} />
    </motion.div>
  );
}

function CardContent({
  card,
  onDelete,
  onEdit,
  isOverlay = false,
}: {
  card: DisplayCard;
  onDelete?: () => void;
  onEdit?: () => void;
  isOverlay?: boolean;
}) {
  return (
    <>
      {/* Card number overlay */}
      <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full w-9 h-9 flex items-center justify-center font-bold text-lg z-[1] shadow-md font-caveat">
        {card.number}
      </div>

      {/* Drag handle indicator */}
      {!card.isProcessing && (
        <div
          className={`absolute top-2 right-2 z-[2] bg-black/50 rounded-md p-1.5 transition-opacity ${
            isOverlay ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <GripVertical className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Image - portrait aspect ratio matching traditional Lotería cards (2:3) */}
      <div className="w-full aspect-[2/3] bg-muted overflow-hidden">
        {card.isProcessing ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
            <div className="text-center">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Processing…</p>
            </div>
          </div>
        ) : card.error ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-destructive/10 gap-2 px-4">
            <AlertTriangle className="w-8 h-8 text-destructive/60" />
            <p className="text-xs font-medium text-destructive">Generation failed</p>
            <p className="text-[10px] text-destructive/60 text-center line-clamp-2">
              Delete card &amp; retry
            </p>
          </div>
        ) : card.illustration ? (
          <img
            src={card.illustration}
            alt={card.label}
            className="w-full h-full object-cover pointer-events-none"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <p className="text-xs text-muted-foreground">No image</p>
          </div>
        )}
      </div>

      {/* Label */}
      <div className="p-3 bg-[#f5f0e1]">
        {card.isProcessing ? (
          <div className="h-5 mb-2 bg-muted-foreground/15 rounded animate-pulse" />
        ) : (
          <p className="text-sm font-semibold text-center text-foreground line-clamp-2 mb-2 uppercase tracking-wide">
            {card.label || 'No label'}
          </p>
        )}

        {/* Action buttons - hidden while processing; reserve height so the
            card doesn't jump when generation finishes */}
        {!isOverlay && card.isProcessing && <div className="h-8" />}
        {!isOverlay && !card.isProcessing && onDelete && onEdit && (
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Edit2 className="w-3 h-3 mr-1" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive hover:text-white hover:border-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

function DragOverlayCard({ card }: { card: DisplayCard }) {
  return (
    <div
      className="bg-[#f5f0e1] overflow-hidden shadow-2xl ring-2 ring-primary cursor-grabbing rotate-3 scale-105 border-2 border-black/80"
      style={{ borderRadius: '2px' }}
    >
      <CardContent card={card} isOverlay />
    </div>
  );
}

export function BoardCardGrid({
  cards,
  onDeleteCard,
  onUpdateLabel,
  onReorderCards,
}: BoardCardGridProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<DisplayCard | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  // Track the live-reordered cards during drag
  const [liveCards, setLiveCards] = useState<DisplayCard[]>(cards);

  const deletingCard = deletingCardId ? cards.find((c) => c.id === deletingCardId) : null;

  function handleDeleteCard() {
    if (!deletingCardId) return;
    onDeleteCard(deletingCardId);
    setDeletingCardId(null);
  }

  // Sync liveCards with cards prop when not dragging
  useEffect(() => {
    if (!activeId) {
      setLiveCards(cards);
    }
  }, [cards, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // 200ms delay for touch to distinguish from scroll
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeCard = activeId ? cards.find((c) => c.clientKey === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setLiveCards(cards);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setLiveCards((currentCards) => {
        const oldIndex = currentCards.findIndex((c) => c.clientKey === active.id);
        const newIndex = currentCards.findIndex((c) => c.clientKey === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          return arrayMove(currentCards, oldIndex, newIndex);
        }
        return currentCards;
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active } = event;

    // Find where the card started (in original cards array)
    const oldIndex = cards.findIndex((c) => c.clientKey === active.id);
    // Find where the card ended up (in liveCards after all drag overs)
    const newIndex = liveCards.findIndex((c) => c.clientKey === active.id);

    if (oldIndex !== newIndex) {
      onReorderCards(oldIndex, newIndex);
    }

    setActiveId(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setLiveCards(cards); // Reset to original order
  };

  if (cards.length === 0) {
    return null;
  }

  // Use liveCards for display during drag, otherwise use cards
  const displayCards = activeId ? liveCards : cards;

  return (
    <div className="w-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={displayCards.map((c) => c.clientKey)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            <AnimatePresence mode="popLayout">
              {displayCards.map((card) => (
                <SortableCard
                  key={card.clientKey}
                  card={card}
                  onDelete={() => setDeletingCardId(card.id)}
                  onEdit={() => setEditingCard(card)}
                  isDragging={activeId === card.clientKey}
                />
              ))}
            </AnimatePresence>
          </div>
        </SortableContext>

        <DragOverlay
          dropAnimation={{
            sideEffects: defaultDropAnimationSideEffects({
              styles: {
                active: {
                  opacity: '0.5',
                },
              },
            }),
          }}
        >
          {activeCard ? <DragOverlayCard card={activeCard} /> : null}
        </DragOverlay>
      </DndContext>

      {editingCard && (
        <CardEditModal
          card={{
            id: editingCard.id,
            label: editingCard.label,
            illustration: editingCard.illustration,
            number: editingCard.number,
          }}
          onSave={(newLabel) => {
            onUpdateLabel(editingCard.id, newLabel);
            setEditingCard(null);
          }}
          onClose={() => setEditingCard(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingCardId} onOpenChange={() => setDeletingCardId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this card?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingCard
                ? `This will permanently delete card #${deletingCard.number}${deletingCard.label ? ` "${deletingCard.label}"` : ''}. This action cannot be undone.`
                : 'This will permanently delete this card. This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCard} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
