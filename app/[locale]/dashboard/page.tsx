'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useBoards } from '@/hooks/use-boards';
import { useSession } from '@/hooks/use-session';
import { signOut } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import { useState } from 'react';
import posthog from 'posthog-js';
import { LanguageSwitch } from '@/components/language-switch';
import { useTranslations } from 'next-intl';

export default function DashboardPage() {
  const t = useTranslations('Dashboard');
  const router = useRouter();
  const { user, isLoading: sessionLoading } = useSession();
  const { boards, limits, isLoading: boardsLoading, createBoard, deleteBoard } = useBoards();
  const [deletingBoardId, setDeletingBoardId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const canCreateBoard = limits?.canCreateBoard ?? true;

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
    await deleteBoard(deletingBoardId);
    posthog.capture('board_deleted', { board_id: deletingBoardId });
    setDeletingBoardId(null);
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">{t('title')}</h2>
            <p className="text-muted-foreground">{t('subtitle')}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button onClick={handleCreateBoard} disabled={isCreating || !canCreateBoard}>
              <Plus className="h-4 w-4 mr-2" />
              {isCreating ? t('newBoardButtonLoading') : t('newBoardButton')}
            </Button>
            {!canCreateBoard && <p className="text-xs text-muted-foreground">{t('lockedHint')}</p>}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                </CardContent>
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
              <Button onClick={handleCreateBoard} disabled={isCreating || !canCreateBoard}>
                <Plus className="h-4 w-4 mr-2" />
                {t('emptyState.cta')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {boards.map((board) => {
              return (
                <Link key={board.id} href={`/boards/${board.id}`} prefetch>
                  <Card className="hover:shadow-md transition-shadow">
                    <div className="flex items-stretch gap-2">
                      <div className="shrink-0 w-44 px-5 py-4 self-center" aria-hidden="true">
                        {board.completedCardCount > 0 ? (
                          <Image
                            src={`/api/boards/${board.id}/preview?v=${board.updatedAt}`}
                            alt=""
                            width={492}
                            height={732}
                            unoptimized
                            className="w-full rounded-sm"
                            draggable={false}
                          />
                        ) : (
                          <div className="grid grid-cols-4 gap-0.5">
                            {Array.from({ length: 16 }, (_, i) => (
                              <div key={i} className="aspect-[2/3] bg-muted/40 rounded-[1px]" />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex items-start justify-between gap-2 py-6 pr-6">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 font-semibold">
                            <span className="truncate">{board.name}</span>
                            {board.isUnlocked ? (
                              <Unlock className="h-4 w-4 text-green-600 shrink-0" />
                            ) : (
                              <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {t('boardCard.cardsReady', {
                              completed: board.completedCardCount,
                              total: board.cardCount,
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground pt-2">
                            {board.isUnlocked
                              ? t('boardCard.unlockedAccess')
                              : t('boardCard.lockedAccess')}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
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
                </Link>
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
