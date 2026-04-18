'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Board, BoardStyleOptions } from '@/db/schema';

interface BoardSummary {
  id: string;
  name: string;
  isUnlocked: boolean;
  createdAt: Date;
  updatedAt: Date;
  cardCount: number;
  completedCardCount: number;
  previewCards: Array<{ id: string; number: number }>;
}

interface BoardLimits {
  current: number;
  max: number;
  unlockedCount: number;
  canCreateBoard: boolean;
}

interface UseBoardsReturn {
  boards: BoardSummary[];
  limits: BoardLimits | null;
  isLoading: boolean;
  error: string | null;
  createBoard: (name?: string) => Promise<Board | null>;
  deleteBoard: (boardId: string) => Promise<boolean>;
  refreshBoards: () => Promise<void>;
}

/**
 * Hook for managing boards list
 */
export function useBoards(): UseBoardsReturn {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [limits, setLimits] = useState<BoardLimits | null>(null);
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
      setLimits(data.limits || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch boards');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

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

          if (data.code === 'BOARD_LIMIT_REACHED') {
            toast.error('Board limit reached', {
              description: data.message,
            });
            return null;
          }

          throw new Error(data.error || 'Failed to create board');
        }

        const data = await response.json();
        await fetchBoards(); // Refresh the list

        return data.board;
      } catch (err) {
        toast.error('Failed to create board');
        return null;
      }
    },
    [fetchBoards]
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
        toast.success('Board deleted');
        return true;
      } catch (err) {
        toast.error('Failed to delete board');
        return false;
      }
    },
    [fetchBoards]
  );

  return {
    boards,
    limits,
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
  updateBoard: (updates: { name?: string; styleOptions?: BoardStyleOptions }) => Promise<boolean>;
  refreshBoard: () => Promise<void>;
}

/**
 * Hook for managing a single board
 */
export function useBoard(boardId: string): UseBoardReturn {
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
    async (updates: { name?: string; styleOptions?: BoardStyleOptions }): Promise<boolean> => {
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
      } catch (err) {
        toast.error('Failed to update board');
        return false;
      }
    },
    [boardId]
  );

  return {
    board,
    isLoading,
    error,
    updateBoard,
    refreshBoard: fetchBoard,
  };
}
