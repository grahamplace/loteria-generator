'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, Sparkles, Unlock, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useBoard } from '@/hooks/use-boards';
import { useBoardCards } from '@/hooks/use-board-cards';
import { BoardActionBar, BoardActionBarRef } from '@/components/board-action-bar';
import { BoardCardGrid } from '@/components/board-card-grid';
import { BoardWelcome } from '@/components/board-welcome';
import { UnlockPrompt } from '@/components/unlock-prompt';
import { DefaultCardsPicker } from '@/components/default-cards-picker';
import { toast } from 'sonner';
import posthog from 'posthog-js';
import { LanguageSwitch } from '@/components/language-switch';
import { useTranslations } from 'next-intl';
import { BOARD_UNLOCK_PRICE_DISPLAY } from '@/lib/constants';

export default function BoardEditorPage() {
  const t = useTranslations('BoardEditor.Page');
  const params = useParams();
  const boardId = params.boardId as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const actionBarRef = useRef<BoardActionBarRef>(null);

  const { board, isLoading: boardLoading, updateBoard, refreshBoard } = useBoard(boardId);
  const {
    cards,
    isLoading: cardsLoading,
    addCards,
    addDefaultCards,
    updateCardLabel,
    deleteCard,
    reorderCards,
    cardLimit,
    CardStreamSubscriptions,
  } = useBoardCards(boardId, board?.isUnlocked);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [unlockPromptOpen, setUnlockPromptOpen] = useState(false);
  const [defaultsPickerOpen, setDefaultsPickerOpen] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [unlockTrigger, setUnlockTrigger] = useState<'card_limit' | 'board_limit' | 'export'>(
    'card_limit'
  );

  // Handle payment success/cancel from Stripe redirect
  useEffect(() => {
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      toast.success(t('toasts.boardUnlockedTitle'), {
        description: t('toasts.boardUnlockedDesc'),
      });
      refreshBoard();
      router.replace(`/boards/${boardId}`);
    } else if (payment === 'cancelled') {
      toast.info(t('toasts.paymentCancelled'));
      router.replace(`/boards/${boardId}`);
    }
  }, [searchParams, boardId, refreshBoard, router]);

  // Update edited name when board loads
  useEffect(() => {
    if (board?.name) {
      setEditedName(board.name);
    }
  }, [board?.name]);

  async function handleSaveName() {
    if (editedName.trim() && editedName !== board?.name) {
      await updateBoard({ name: editedName.trim() });
    }
    setIsEditingName(false);
  }

  function openUnlockPrompt(trigger: 'card_limit' | 'board_limit' | 'export') {
    setUnlockTrigger(trigger);
    setUnlockPromptOpen(true);
    posthog.capture('unlock_prompt_shown', { trigger, board_id: boardId });
  }

  function handleFilesSelected(files: File[]) {
    const slotsAvailable = cardLimit - cards.length;
    const filesToAdd = files.slice(0, slotsAvailable);

    if (files.length > slotsAvailable && !board?.isUnlocked) {
      openUnlockPrompt('card_limit');
    }

    if (filesToAdd.length > 0) {
      addCards(filesToAdd);
    }
  }

  function handleExportLimitReached() {
    openUnlockPrompt('export');
  }

  function handleCardLimitReached() {
    openUnlockPrompt('card_limit');
  }

  const isLoading = boardLoading || cardsLoading;
  const processedCards = cards.filter((c) => c.status === 'completed');
  const processingCards = cards.filter((c) => c.status === 'processing' || c.isProcessing);
  const atCardLimit = !board?.isUnlocked && cards.length >= cardLimit;

  // Convert BoardCard to format expected by components
  const displayCards = cards.map((card) => ({
    id: card.id,
    clientKey: card.clientKey,
    number: card.number,
    label: card.label,
    illustration:
      card.localIllustration ||
      card.localOriginalImage ||
      (card.isDefault && card.illustrationUrl
        ? card.illustrationUrl
        : card.illustrationUrl
          ? `/api/images/${boardId}/${card.id}/illustration`
          : card.originalImageUrl
            ? `/api/images/${boardId}/${card.id}/original`
            : ''),
    originalImage:
      card.localOriginalImage ||
      (card.originalImageUrl ? `/api/images/${boardId}/${card.id}/original` : undefined),
    isProcessing: card.isProcessing || card.status === 'processing',
    error:
      card.status === 'error' ? card.errorMessage || t('toasts.errorProcessingCard') : undefined,
    isDefault: card.isDefault,
  }));

  const alreadyAddedDefaultIds = new Set(
    cards.map((c) => c.defaultCardId).filter((id): id is string => !!id)
  );
  const remainingSlots = Math.max(0, cardLimit - cards.length);

  // Show welcome state for new locked boards with no cards
  const showWelcome =
    !isLoading && board && cards.length === 0 && !board.isUnlocked && !welcomeDismissed;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-black/5 bg-white/70 backdrop-blur-sm sticky top-0 z-30">
          <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between">
            <Skeleton className="h-6 w-48" />
            <LanguageSwitch />
          </div>
        </header>
        <div className="max-w-[1400px] mx-auto px-3 md:px-6 pt-5 pb-4 hidden md:block">
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
        <main className="max-w-[1400px] mx-auto px-3 md:px-6 pb-6">
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-3">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} className="aspect-[2/3]" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">{t('boardNotFoundTitle')}</h2>
          <Link href="/dashboard">
            <Button>{t('boardNotFoundCta')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard"
              aria-label={t('backToDashboardAriaLabel')}
              className="w-9 h-9 md:w-8 md:h-8 rounded-full md:rounded-md hover:bg-black/5 flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {isEditingName ? (
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onBlur={handleSaveName}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') setIsEditingName(false);
                    }}
                    className="max-w-[200px] h-8"
                    autoFocus
                    aria-label={t('renameInputAriaLabel')}
                  />
                ) : (
                  <button
                    onClick={() => setIsEditingName(true)}
                    aria-label={t('editBoardNameAriaLabel', { name: board.name })}
                    className="font-semibold text-[17px] md:text-[15px] md:font-bold tracking-tight truncate hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
                  >
                    {board.name}
                  </button>
                )}
                {board.isUnlocked ? (
                  <span className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Unlock className="w-2.5 h-2.5" />
                    {t('unlockedBadge')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] md:text-[10px] font-mono uppercase tracking-wider md:tracking-normal md:font-medium bg-primary/10 text-primary border border-primary/20">
                    <Lock className="w-2.5 h-2.5" />
                    {t('freeBadge')}
                  </span>
                )}
              </div>
              {/* Mobile subtitle */}
              {!isEditingName && (
                <div className="md:hidden text-[11px] text-muted-foreground truncate">
                  {cards.length > 0
                    ? t('mobileSubtitleCards', { count: cards.length })
                    : t('mobileSubtitleEmpty')}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitch />
            {!board.isUnlocked && (
              <button
                onClick={() => openUnlockPrompt('card_limit')}
                className="px-3 h-8 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary/90 flex items-center gap-1 md:gap-1.5 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{t('unlockButtonPrefix')}</span>{' '}
                {t('unlockButtonShort', { price: BOARD_UNLOCK_PRICE_DISPLAY })}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {showWelcome ? (
          /* Welcome state for new locked boards */
          <BoardWelcome
            onContinue={() => setWelcomeDismissed(true)}
            onUnlock={() => openUnlockPrompt('card_limit')}
          />
        ) : (
          <>
            {/* Action bar — desktop: top of content; mobile: fixed bottom bar */}
            <div className="max-w-[1400px] mx-auto w-full px-3 md:px-6 pt-3 md:pt-5 pb-3 md:pb-4">
              <BoardActionBar
                ref={actionBarRef}
                onFilesSelected={handleFilesSelected}
                cardCount={cards.length}
                maxCards={cardLimit}
                processedCount={processedCards.length}
                processingCount={processingCards.length}
                isUnlocked={board.isUnlocked}
                cards={displayCards}
                boardName={board.name}
                onUnlockRequired={handleExportLimitReached}
                onOpenDefaults={() => setDefaultsPickerOpen(true)}
              />
            </div>

            {/* Cards */}
            {cards.length > 0 ? (
              <div className="flex-1 max-w-[1400px] w-full mx-auto px-3 md:px-6 pb-28 md:pb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {t('yourCards')}
                  </h2>
                  <span className="text-[11px] font-mono text-muted-foreground hidden md:block">
                    {t('dragToReorder')}
                  </span>
                </div>
                <BoardCardGrid
                  cards={displayCards}
                  onDeleteCard={deleteCard}
                  onUpdateLabel={updateCardLabel}
                  onReorderCards={reorderCards}
                  onAddMore={() => actionBarRef.current?.triggerFileSelect()}
                  onAddClassic={() => setDefaultsPickerOpen(true)}
                  isLocked={!board.isUnlocked}
                  atCardLimit={atCardLimit}
                  maxCards={cardLimit}
                  onUnlockRequired={handleCardLimitReached}
                />
              </div>
            ) : (
              /* Empty state for boards with no cards */
              <div className="flex-1 flex items-center justify-center px-6 py-10">
                <div className="text-center max-w-sm">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">{t('emptyStateTitle')}</h2>
                  <p className="text-sm text-muted-foreground mb-6">{t('emptyStateDesc')}</p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      onClick={() => actionBarRef.current?.triggerFileSelect()}
                      className="px-5 py-3 rounded-lg bg-primary text-white text-sm font-semibold flex items-center gap-2 shadow-sm hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      <Upload className="w-4 h-4" />
                      {t('emptyStateCta')}
                    </button>
                    <button
                      onClick={() => setDefaultsPickerOpen(true)}
                      className="px-5 py-3 rounded-lg bg-secondary/15 border border-secondary/40 text-foreground text-sm font-semibold flex items-center gap-2 hover:bg-secondary/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      <Sparkles className="w-4 h-4" aria-hidden="true" />
                      {t('emptyStateAddClassic')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Unlock Prompt */}
      <UnlockPrompt
        boardId={boardId}
        boardName={board.name}
        trigger={unlockTrigger}
        open={unlockPromptOpen}
        onOpenChange={setUnlockPromptOpen}
      />

      <DefaultCardsPicker
        open={defaultsPickerOpen}
        onClose={() => setDefaultsPickerOpen(false)}
        onAdd={(ids) => addDefaultCards(ids)}
        alreadyAddedIds={alreadyAddedDefaultIds}
        remainingSlots={remainingSlots}
        cardLimit={cardLimit}
      />

      {CardStreamSubscriptions}
    </div>
  );
}
