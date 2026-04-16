'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, Unlock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useBoard } from '@/hooks/use-boards';
import { useBoardCards } from '@/hooks/use-board-cards';
import { BoardUploadSection } from '@/components/board-upload-section';
import { BoardCardGrid } from '@/components/board-card-grid';
import { BoardExportSection } from '@/components/board-export-section';
import { UnlockPrompt } from '@/components/unlock-prompt';
import { toast } from 'sonner';

export default function BoardEditorPage() {
  const params = useParams();
  const boardId = params.boardId as string;
  const router = useRouter();
  const searchParams = useSearchParams();

  const { board, isLoading: boardLoading, updateBoard, refreshBoard } = useBoard(boardId);
  const {
    cards,
    isLoading: cardsLoading,
    addCards,
    updateCardLabel,
    deleteCard,
    reorderCards,
    cardLimit,
  } = useBoardCards(boardId, board?.isUnlocked);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [unlockPromptOpen, setUnlockPromptOpen] = useState(false);
  const [unlockTrigger, setUnlockTrigger] = useState<'card_limit' | 'board_limit' | 'export'>(
    'card_limit'
  );

  // Handle payment success/cancel from Stripe redirect
  useEffect(() => {
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      toast.success('Board unlocked!', {
        description: 'You now have full access to this board.',
      });
      refreshBoard();
      // Clear the query param
      router.replace(`/boards/${boardId}`);
    } else if (payment === 'cancelled') {
      toast.info('Payment cancelled');
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

  function handleFilesSelected(files: File[]) {
    const slotsAvailable = cardLimit - cards.length;
    const filesToAdd = files.slice(0, slotsAvailable);

    if (files.length > slotsAvailable && !board?.isUnlocked) {
      setUnlockTrigger('card_limit');
      setUnlockPromptOpen(true);
    }

    if (filesToAdd.length > 0) {
      addCards(filesToAdd);
    }
  }

  function handleExportLimitReached() {
    setUnlockTrigger('export');
    setUnlockPromptOpen(true);
  }

  const isLoading = boardLoading || cardsLoading;
  const processedCards = cards.filter((c) => c.status === 'completed');
  const processingCards = cards.filter((c) => c.status === 'processing' || c.isProcessing);

  // Convert BoardCard to format expected by components
  const displayCards = cards.map((card) => ({
    id: card.id,
    number: card.number,
    label: card.label,
    // Use local images for immediate display, fall back to URL-based proxy
    illustration:
      card.localIllustration ||
      card.localOriginalImage ||
      (card.illustrationUrl
        ? `/api/images/${boardId}/${card.id}/illustration`
        : card.originalImageUrl
          ? `/api/images/${boardId}/${card.id}/original`
          : ''),
    isProcessing: card.isProcessing || card.status === 'processing',
    error: card.status === 'error' ? card.errorMessage || 'Error processing card' : undefined,
  }));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
        <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-48 w-full mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
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
          <h2 className="text-xl font-semibold mb-2">Board not found</h2>
          <Link href="/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>

            {isEditingName ? (
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setIsEditingName(false);
                }}
                className="max-w-[200px]"
                autoFocus
              />
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                className="text-xl font-bold hover:text-primary transition-colors flex items-center gap-2"
              >
                {board.name}
                {board.isUnlocked ? (
                  <Unlock className="h-4 w-4 text-green-600" />
                ) : (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!board.isUnlocked && (
              <Button
                variant="outline"
                onClick={() => {
                  setUnlockTrigger('card_limit');
                  setUnlockPromptOpen(true);
                }}
                className="border-orange-300 text-orange-600 hover:bg-orange-50"
              >
                <Unlock className="h-4 w-4 mr-2" />
                Unlock for $5
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Payment Success Banner */}
        {board.isUnlocked && board.unlockedAt && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-green-800">Board Unlocked</p>
              <p className="text-sm text-green-600">
                You have full access to all features for this board.
              </p>
            </div>
          </div>
        )}

        {/* Step 1: Upload */}
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">
              1
            </span>
            Upload Your Photos
          </h2>
          <BoardUploadSection
            onFilesSelected={handleFilesSelected}
            cardCount={cards.length}
            maxCards={cardLimit}
            isUnlocked={board.isUnlocked}
          />
        </section>

        {/* Step 2: Manage Cards */}
        {cards.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">
                2
              </span>
              Manage Your Cards
            </h2>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 shadow-sm border">
                <p className="text-2xl font-bold">{cards.length}</p>
                <p className="text-sm text-muted-foreground">Total cards</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm border">
                <p className="text-2xl font-bold">{processedCards.length}</p>
                <p className="text-sm text-muted-foreground">Ready</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm border">
                <p className="text-2xl font-bold">{processingCards.length}</p>
                <p className="text-sm text-muted-foreground">Processing</p>
              </div>
            </div>

            <BoardCardGrid
              cards={displayCards}
              onDeleteCard={deleteCard}
              onUpdateLabel={updateCardLabel}
              onReorderCards={reorderCards}
            />
          </section>
        )}

        {/* Step 3: Export */}
        {cards.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">
                3
              </span>
              Export & Generate Boards
            </h2>
            <BoardExportSection
              cards={displayCards}
              isUnlocked={board.isUnlocked}
              onUnlockRequired={handleExportLimitReached}
            />
          </section>
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
    </div>
  );
}
