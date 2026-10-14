'use client';

import { useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import posthog from 'posthog-js';
import { Link, useRouter } from '@/i18n/navigation';
import { useBoards } from '@/hooks/use-boards';
import { BoardThemeBadge } from '@/components/board-theme-badge';
import type { BoardStyleOptions } from '@/lib/themes/presets';
import { rememberBoard } from '@/lib/boards/recent-board';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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

const PAGE_SIZE = 20;
const itemClass = 'min-h-11 touch-manipulation focus:bg-primary/10 focus:text-foreground';

export function BoardSwitcher({
  board,
  onRename,
}: {
  board: { id: string; name: string; styleOptions: BoardStyleOptions | null };
  onRename: () => void;
}) {
  const t = useTranslations('BoardSwitcher');
  const themes = useTranslations('Themes.Builder');
  const locale = useLocale() === 'es-MX' ? 'es-MX' : 'en';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const renaming = useRef(false);
  const { boards, isLoading, error, createBoard, deleteBoard, refreshBoards } = useBoards(open);
  // Keep the current name/design fresh even when the list was fetched before an edit.
  const ordered = [board, ...boards.filter((item) => item.id !== board.id)];
  const pageCount = Math.ceil(ordered.length / PAGE_SIZE);
  const visible = ordered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  async function create() {
    if (creating) return;
    setCreating(true);
    const created = await createBoard();
    if (created) {
      rememberBoard(created.id);
      posthog.capture('board_created', { board_id: created.id, source: 'board_picker', locale });
      setOpen(false);
      router.push(`/boards/${created.id}`);
    }
    setCreating(false);
  }

  async function remove() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(false);
    if (await deleteBoard(board.id)) {
      posthog.capture('board_deleted', { board_id: board.id });
      // /start validates the remembered board and repairs the zero-board case.
      // A full navigation avoids reusing a prefetched /start destination.
      window.location.replace(locale === 'es-MX' ? '/es/start' : '/start');
    } else {
      setDeleteError(true);
      setDeleting(false);
    }
  }

  return (
    <>
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          if (!creating) {
            setOpen(next);
            if (next) setPage(0);
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            ref={triggerRef}
            id={`board-switcher-${board.id}`}
            type="button"
            aria-label={t('open', { name: board.name })}
            className="flex min-h-11 min-w-0 max-w-full items-center gap-1.5 rounded-lg px-2 text-left font-semibold tracking-tight transition-colors hover:bg-primary/5 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary touch-manipulation"
          >
            <span className="truncate">{board.name}</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={8}
          className="w-80 max-w-[calc(100vw-2rem)] overscroll-contain rounded-xl p-2 motion-reduce:animate-none"
          onCloseAutoFocus={(event) => {
            if (renaming.current) {
              event.preventDefault();
              renaming.current = false;
              onRename();
            }
          }}
        >
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {t('title')}
          </DropdownMenuLabel>
          <div className="max-h-[min(20rem,45dvh)] overflow-y-auto overscroll-contain">
            {visible.map((item) => (
              <DropdownMenuItem
                key={item.id}
                asChild
                textValue={item.name}
                className={`${itemClass} rounded-lg p-2 ${item.id === board.id ? 'bg-primary/5' : ''}`}
              >
                <Link
                  href={`/boards/${item.id}`}
                  prefetch={false}
                  aria-current={item.id === board.id ? 'page' : undefined}
                >
                  <span className="min-w-0 flex-1 space-y-1.5">
                    <span className="block truncate font-medium">{item.name}</span>
                    <BoardThemeBadge
                      styles={item.styleOptions}
                      locale={locale}
                      customLabel={themes('custom')}
                      themeLabel={t('theme')}
                    />
                  </span>
                  {item.id === board.id && (
                    <Check className="size-4 text-primary" aria-hidden="true" />
                  )}
                </Link>
              </DropdownMenuItem>
            ))}
            {isLoading && (
              <p role="status" className="px-2 py-3 text-xs text-muted-foreground">
                {t('loading')}
              </p>
            )}
            {error && (
              <>
                <p role="alert" className="px-2 py-2 text-sm text-destructive">
                  {t('loadError')}
                </p>
                <DropdownMenuItem
                  className={itemClass}
                  onSelect={(event) => {
                    event.preventDefault();
                    void refreshBoards();
                  }}
                >
                  {t('retry')}
                </DropdownMenuItem>
              </>
            )}
          </div>
          {pageCount > 1 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal tabular-nums text-muted-foreground">
                {t('page', { page: page + 1, count: pageCount })}
              </DropdownMenuLabel>
              {page > 0 && (
                <DropdownMenuItem
                  className={itemClass}
                  onSelect={(event) => {
                    event.preventDefault();
                    setPage(page - 1);
                  }}
                >
                  <ChevronLeft aria-hidden="true" />
                  {t('previous')}
                </DropdownMenuItem>
              )}
              {page + 1 < pageCount && (
                <DropdownMenuItem
                  className={itemClass}
                  onSelect={(event) => {
                    event.preventDefault();
                    setPage(page + 1);
                  }}
                >
                  <ChevronRight aria-hidden="true" />
                  {t('next')}
                </DropdownMenuItem>
              )}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className={itemClass}
            disabled={creating}
            onSelect={(event) => {
              event.preventDefault();
              void create();
            }}
          >
            {creating ? (
              <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <Plus aria-hidden="true" />
            )}
            {t('new')}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={itemClass}
            disabled={creating}
            onSelect={() => {
              renaming.current = true;
            }}
          >
            <Pencil aria-hidden="true" />
            {t('rename')}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={itemClass}
            disabled={creating}
            variant="destructive"
            onSelect={() => {
              setDeleteError(false);
              setConfirmDelete(true);
            }}
          >
            <Trash2 aria-hidden="true" />
            {t('delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog
        open={confirmDelete}
        onOpenChange={(next) => {
          if (!deleting) setConfirmDelete(next);
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="break-words">
              {t('deleteTitle', { name: board.name })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('deleteDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p role="alert" className="text-sm text-destructive">
              {t('deleteError')}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={deleting}>
              {t('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
            >
              {deleting && (
                <Loader2
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              )}
              {t('deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
