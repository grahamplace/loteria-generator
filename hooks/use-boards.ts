'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { Board, BoardStyleOptions } from '@/db/schema';

interface BoardSummary {
  id: string;
  name: string;
  styleOptions: BoardStyleOptions | null;
  isUnlocked: boolean;
  createdAt: Date;
  updatedAt: Date;
  cardCount: number;
  completedCardCount: number;
  previewCards: Array<{ id: string; number: number }>;
}

interface UseBoardsReturn {
  boards: BoardSummary[];
  isLoading: boolean;
  error: string | null;
  createBoard: (name?: string) => Promise<Board | null>;
  deleteBoard: (boardId: string) => Promise<boolean>;
  refreshBoards: () => Promise<void>;
}

/**
 * Hook for managing boards list
 */
export function useBoards(enabled = true): UseBoardsReturn {
  const t = useTranslations('BoardSwitcher');
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchBoards = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/boards');

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/sign-in');
          return;
        }
        throw new Error('Failed to fetch boards');
      }

      const data = await response.json();
      setBoards(data.boards || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch boards');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (enabled) void fetchBoards();
  }, [enabled, fetchBoards]);

  const createBoard = useCallback(
    async (name?: string): Promise<Board | null> => {
      try {
        const response = await fetch('/api/boards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });

        if (!response.ok) {
          const data = await response.json();

          throw new Error(data.error || 'Failed to create board');
        }

        const data = await response.json();
        await fetchBoards(); // Refresh the list

        return data.board;
      } catch {
        toast.error(t('createError'));
        return null;
      }
    },
    [fetchBoards, t]
  );

  const deleteBoard = useCallback(
    async (boardId: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/boards/${boardId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete board');
        }

        await fetchBoards(); // Refresh the list
        toast.success(t('deleted'));
        return true;
      } catch {
        toast.error(t('deleteError'));
        return false;
      }
    },
    [fetchBoards, t]
  );

  return {
    boards,
    isLoading,
    error,
    createBoard,
    deleteBoard,
    refreshBoards: fetchBoards,
  };
}

interface BoardWithCards extends Board {
  cards: Array<{
    id: string;
    number: number;
    label: string;
    originalImageUrl: string | null;
    illustrationUrl: string | null;
    status: string;
    errorMessage: string | null;
  }>;
}

interface UseBoardReturn {
  board: BoardWithCards | null;
  isLoading: boolean;
  error: string | null;
  updateBoard: (updates: {
    name?: string;
    styleOptions?: BoardStyleOptions;
    photoMode?: import('@/lib/themes/presets').PhotoMode;
  }) => Promise<boolean>;
  refreshBoard: () => Promise<void>;
}

/**
 * Hook for managing a single board
 */
export function useBoard(boardId: string): UseBoardReturn {
  const t = useTranslations('Themes.Builder');
  const [board, setBoard] = useState<BoardWithCards | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchBoard = useCallback(async () => {
    if (!boardId) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/boards/${boardId}`);

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/sign-in');
          return;
        }
        if (response.status === 404) {
          setError('Board not found');
          return;
        }
        throw new Error('Failed to fetch board');
      }

      const data = await response.json();
      setBoard(data.board);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch board');
    } finally {
      setIsLoading(false);
    }
  }, [boardId, router]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const updateBoard = useCallback(
    async (updates: {
      name?: string;
      styleOptions?: BoardStyleOptions;
      photoMode?: import('@/lib/themes/presets').PhotoMode;
    }): Promise<boolean> => {
      try {
        const response = await fetch(`/api/boards/${boardId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error('Failed to update board');
        }

        const data = await response.json();
        setBoard((prev) => (prev ? { ...prev, ...data.board } : null));
        return true;
      } catch {
        toast.error(t('saveError'));
        return false;
      }
    },
    [boardId, t]
  );

  return {
    board,
    isLoading,
    error,
    updateBoard,
    refreshBoard: fetchBoard,
  };
}
