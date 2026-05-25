'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { GripVertical, AlertTriangle, Plus, Sparkles, Unlock, Check } from 'lucide-react';
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
import { useTranslations } from 'next-intl';
import { BOARD_UNLOCK_PRICE_DISPLAY } from '@/lib/constants';

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
  riddle?: string | null;
  illustration: string;
  originalImage?: string;
  isProcessing?: boolean;
  error?: string;
  isDefault?: boolean;
}

interface BoardCardGridProps {
  cards: DisplayCard[];
  onDeleteCard: (id: string) => void;
  onUpdateLabel: (id: string, label: string, riddle: string) => void;
  onReorderCards: (startIndex: number, endIndex: number) => void;
  onAddMore?: () => void;
  onAddClassic?: () => void;
  isLocked?: boolean;
  atCardLimit?: boolean;
  maxCards?: number;
  onUnlockRequired?: () => void;
}

interface SortableCardProps {
  card: DisplayCard;
  onCardClick: () => void;
  isDragging?: boolean;
}

function SortableCard({ card, onCardClick, isDragging }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: card.clientKey,
    disabled: card.isProcessing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    borderRadius: '2px',
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{
        opacity: { duration: 0.2 },
        scale: { duration: 0.2 },
      }}
      className={`group relative bg-[#f5f0e1] overflow-hidden shadow-md hover:shadow-lg border-2 border-black/80 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        card.isProcessing ? 'cursor-wait' : 'cursor-pointer active:cursor-grabbing'
      } ${isDragging ? 'ring-2 ring-primary ring-offset-2' : ''}`}
      onClick={onCardClick}
      {...attributes}
      {...listeners}
    >
      <CardContent card={card} />
    </motion.div>
  );
}

function CardContent({ card, isOverlay = false }: { card: DisplayCard; isOverlay?: boolean }) {
  const t = useTranslations('BoardEditor.CardGrid');

  return (
    <>
      {/* Card number overlay */}
      <div
        className={`absolute top-2 left-2 ${card.isDefault ? 'bg-accent' : 'bg-primary'} text-primary-foreground rounded-full w-9 h-9 flex items-center justify-center font-bold text-lg z-[1] shadow-md font-caveat`}
      >
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
      <div className="relative w-full aspect-[2/3] bg-muted overflow-hidden">
        {card.isProcessing ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
            <div className="text-center">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{t('processing')}</p>
            </div>
          </div>
        ) : card.error ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-destructive/10 gap-2 px-4">
            <AlertTriangle className="w-8 h-8 text-destructive/60" />
            <p className="text-xs font-medium text-destructive">{t('generationFailed')}</p>
            <p className="text-[10px] text-destructive/60 text-center line-clamp-2">
              {t('deleteAndRetry')}
            </p>
          </div>
        ) : card.illustration ? (
          <Image
            src={card.illustration}
            alt={card.label}
            fill
            sizes="(max-width: 768px) 30vw, 180px"
            unoptimized
            className="object-cover pointer-events-none"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <p className="text-xs text-muted-foreground">{t('noImage')}</p>
          </div>
        )}
      </div>

      {/* Label */}
      <div className="p-3 bg-[#f5f0e1]">
        {card.isProcessing ? (
          <div className="h-5 bg-muted-foreground/15 rounded animate-pulse" />
        ) : (
          <p className="text-sm font-semibold text-center text-foreground line-clamp-2 uppercase tracking-wide">
            {card.label || t('noLabel')}
          </p>
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
  onAddMore,
  onAddClassic,
  isLocked = false,
  atCardLimit = false,
  maxCards = 54,
  onUnlockRequired,
}: BoardCardGridProps) {
  const t = useTranslations('BoardEditor.CardGrid');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<DisplayCard | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  // Track the live-reordered cards during drag
  const [liveCards, setLiveCards] = useState<DisplayCard[]>(cards);

  const deletingCard = deletingCardId ? cards.find((c) => c.id === deletingCardId) : null;
  const justDragged = useRef(false);

  function handleCardClick(card: DisplayCard) {
    if (justDragged.current) return;
    if (card.isProcessing) return;
    setEditingCard(card);
  }

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

    justDragged.current = true;
    setActiveId(null);
    setTimeout(() => {
      justDragged.current = false;
    }, 0);
  };

  const handleDragCancel = () => {
    justDragged.current = true;
    setActiveId(null);
    setLiveCards(cards);
    setTimeout(() => {
      justDragged.current = false;
    }, 0);
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
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-3">
            <AnimatePresence>
              {displayCards.map((card) => (
                <SortableCard
                  key={card.clientKey}
                  card={card}
                  onCardClick={() => handleCardClick(card)}
                  isDragging={activeId === card.clientKey}
                />
              ))}
            </AnimatePresence>

            {/* Inline unlock tile (Treatment C) when locked at card limit */}
            {isLocked && atCardLimit && onUnlockRequired ? (
              <div
                className="col-span-3 md:col-span-3 lg:col-span-4 xl:col-span-5 md:row-span-2 rounded-sm border-2 border-dashed border-primary/40 p-3 md:p-5 flex items-center gap-3 md:gap-5"
                style={{
                  background: 'linear-gradient(135deg, #faf5e6 0%, #f2e6c8 100%)',
                }}
              >
                <div className="shrink-0 relative">
                  <div className="w-11 h-11 md:w-14 md:h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-lg">
                    <Unlock className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-secondary text-foreground flex items-center justify-center text-[10px] font-bold shadow">
                    {BOARD_UNLOCK_PRICE_DISPLAY}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] md:text-[10px] font-mono uppercase tracking-wider text-primary mb-0.5">
                    {t('freeLimitReached')}
                  </div>
                  <div className="font-bold text-[13px] md:text-[14px] leading-tight">
                    {t('keepBuildingPrefix')}{' '}
                    <span className="font-caveat text-[18px] md:text-xl text-primary">
                      {t('moreCards', { count: maxCards - cards.length })}
                    </span>{' '}
                    {t('keepBuildingSuffix')}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-foreground/70">
                    <span className="flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" />
                      {t('featureCards')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" />
                      {t('featureExports')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" />
                      {t('featureWatermarks')}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onUnlockRequired}
                  className="px-3.5 py-2 rounded-lg bg-primary text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm whitespace-nowrap hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  {t('unlockButton')}
                </button>
              </div>
            ) : onAddMore || onAddClassic ? (
              <>
                {onAddMore ? (
                  <button
                    onClick={onAddMore}
                    className="rounded-sm flex flex-col text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    style={{ border: '1.5px dashed rgba(0,0,0,0.2)' }}
                  >
                    <div className="aspect-[2/3] flex flex-col items-center justify-center gap-1.5">
                      <div className="w-8 h-8 rounded-full bg-white border border-border flex items-center justify-center">
                        <Plus className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider">
                        {t('addMore')}
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold text-center uppercase tracking-wide opacity-0 select-none">
                        &nbsp;
                      </p>
                    </div>
                  </button>
                ) : null}
                {onAddClassic ? (
                  <button
                    onClick={onAddClassic}
                    className="rounded-sm flex flex-col text-secondary-foreground hover:text-primary hover:bg-secondary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    style={{ border: '1.5px dashed var(--secondary)' }}
                    aria-label={t('addClassicTile')}
                  >
                    <div className="aspect-[2/3] flex flex-col items-center justify-center gap-1.5">
                      <div className="w-8 h-8 rounded-full bg-secondary/15 border border-secondary/40 flex items-center justify-center">
                        <Sparkles
                          className="w-4 h-4 text-secondary-foreground"
                          aria-hidden="true"
                        />
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider">
                        {t('addClassicTile')}
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold text-center uppercase tracking-wide opacity-0 select-none">
                        &nbsp;
                      </p>
                    </div>
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </SortableContext>

        <DragOverlay>{activeCard ? <DragOverlayCard card={activeCard} /> : null}</DragOverlay>
      </DndContext>

      {editingCard && (
        <CardEditModal
          card={{
            id: editingCard.id,
            label: editingCard.label,
            illustration: editingCard.illustration,
            number: editingCard.number,
            riddle: editingCard.riddle,
          }}
          originalImage={editingCard.originalImage}
          onSave={(newLabel, newRiddle) => {
            onUpdateLabel(editingCard.id, newLabel, newRiddle);
            setEditingCard(null);
          }}
          onDelete={() => {
            setDeletingCardId(editingCard.id);
            setEditingCard(null);
          }}
          onClose={() => setEditingCard(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingCardId} onOpenChange={() => setDeletingCardId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialogTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingCard
                ? t(deletingCard.label ? 'deleteDialogDescWithLabel' : 'deleteDialogDescNoLabel', {
                    number: deletingCard.number,
                    label: deletingCard.label,
                  })
                : t('deleteDialogDescNoLabel')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('deleteDialogCancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCard} className="bg-red-600 hover:bg-red-700">
              {t('deleteDialogConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
