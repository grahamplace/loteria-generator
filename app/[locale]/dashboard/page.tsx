'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useBoards } from '@/hooks/use-boards';
import { useSession } from '@/hooks/use-session';
import { signOut } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardBoardTheme, DashboardBoardThumbnail } from '@/components/dashboard-board-design';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Plus, MoreVertical, Trash2, Lock, Unlock, User, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import posthog from 'posthog-js';
import { LanguageSwitch } from '@/components/language-switch';
import { useTranslations } from 'next-intl';
import { OnboardingTrigger } from '@/components/onboarding/onboarding-trigger';
import {
  ANCHOR_CREATE_BOARD,
  TOUR_DASHBOARD_START,
} from '@/components/onboarding/onboarding-steps';
import { consumePendingSignupConversion } from '@/lib/google-ads';

export default function DashboardPage() {
  const t = useTranslations('Dashboard');
  const router = useRouter();
  const { user, isLoading: sessionLoading } = useSession();
  const { boards, isLoading: boardsLoading, createBoard, deleteBoard } = useBoards();
  const [deletingBoardId, setDeletingBoardId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Completes the Google-OAuth signup conversion started on the sign-up page.
  useEffect(() => {
    consumePendingSignupConversion();
  }, []);

  async function handleCreateBoard() {
    setIsCreating(true);
    const board = await createBoard();
    setIsCreating(false);

    if (board) {
      posthog.capture('board_created', { board_id: board.id });
      router.push(`/boards/${board.id}`);
    }
  }

  async function handleDeleteBoard() {
    if (!deletingBoardId) return;
    // Capture this BEFORE awaiting: useBoards refetches after a delete, so
    // boards.length is stale/updated by the time the await resolves.
    const wasLastBoard = boards.length === 1;
    const deleted = await deleteBoard(deletingBoardId);
    posthog.capture('board_deleted', { board_id: deletingBoardId });
    setDeletingBoardId(null);
    // Deleting your only board would strand you on the empty state. '/start'
    // creates a fresh board and drops you into it.
    if (deleted && wasLastBoard) {
      router.push('/start');
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push('/');
  }

  const isLoading = sessionLoading || boardsLoading;

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Image src="/loteria-star.png" alt="" width={28} height={28} className="h-7 w-7" />
            Lotería Generator
          </h1>
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  aria-label={t('userMenu.openMenuAriaLabel')}
                >
                  {user?.image ? (
                    <Image
                      src={user.image}
                      alt={user.name || t('userAvatarAlt')}
                      width={32}
                      height={32}
                      // OAuth avatars arrive pre-sized (~3KB) from a CDN that
                      // already caches them. Routing them through /_next/image
                      // buys nothing and bills a transformation per user.
                      unoptimized
                      className="h-8 w-8 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User className="h-5 w-5" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.name || t('userFallbackName')}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/account')}>
                  {t('userMenu.accountSettings')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />
                  {t('userMenu.signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <OnboardingTrigger
          tour={TOUR_DASHBOARD_START}
          enabled={!isLoading && boards.length === 0}
        />
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">{t('title')}</h2>
            <p className="text-muted-foreground">{t('subtitle')}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button onClick={handleCreateBoard} disabled={isCreating}>
              <Plus className="h-4 w-4 mr-2" />
              {isCreating ? t('newBoardButtonLoading') : t('newBoardButton')}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 sm:p-5">
                <div className="flex items-center gap-4">
                  <Skeleton className="aspect-[17/22] w-20 shrink-0 min-[380px]:w-24 sm:w-32" />
                  <div className="min-w-0 flex-1 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-6 w-28 rounded-full" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : boards.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <div className="mx-auto w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-4">
                <Plus className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('emptyState.title')}</h3>
              <p className="text-muted-foreground mb-4">{t('emptyState.description')}</p>
              <Button id={ANCHOR_CREATE_BOARD} onClick={handleCreateBoard} disabled={isCreating}>
                <Plus className="h-4 w-4 mr-2" />
                {t('emptyState.cta')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {boards.map((board) => {
              return (
                <Card
                  key={board.id}
                  className="relative h-full p-4 transition-shadow hover:shadow-md sm:p-5"
                >
                  <Link
                    href={`/boards/${board.id}`}
                    prefetch
                    aria-label={board.name}
                    className="absolute inset-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  />
                  <div className="pointer-events-none flex items-center gap-3 sm:gap-4">
                    <div className="w-20 shrink-0 min-[380px]:w-24 sm:w-32">
                      <DashboardBoardThumbnail
                        boardId={board.id}
                        boardName={board.name}
                        updatedAt={board.updatedAt}
                        cardCount={board.previewCards.length}
                        styles={board.styleOptions}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="min-w-0 space-y-2">
                        <h3 className="flex items-center gap-2 pr-8 font-semibold">
                          <span className="line-clamp-2 break-words">{board.name}</span>
                          {board.isUnlocked ? (
                            <Unlock className="h-4 w-4 text-accent shrink-0" />
                          ) : (
                            <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </h3>
                        <DashboardBoardTheme styles={board.styleOptions} />
                        <p className="text-sm text-muted-foreground">
                          {t('boardCard.cardsReady', {
                            completed: board.completedCardCount,
                            total: board.cardCount,
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {board.isUnlocked
                            ? t('boardCard.unlockedAccess')
                            : t('boardCard.lockedAccess')}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="pointer-events-auto absolute right-2 top-2 z-10 size-11 touch-manipulation"
                            aria-label={t('boardCard.moreActionsAriaLabel', { name: board.name })}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.preventDefault();
                              setDeletingBoardId(board.id);
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('boardCard.deleteMenuItem')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingBoardId} onOpenChange={() => setDeletingBoardId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteDialog.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBoard} className="bg-red-600 hover:bg-red-700">
              {t('deleteDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
