'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Lock, LockOpen } from 'lucide-react';
import { BoardThemeBadge } from '@/components/board-theme-badge';
import { boardBorderStyle, getTheme, type BoardStyleOptions } from '@/lib/themes/presets';
import messages from '@/messages/en.json';
import { getGenerationLimit } from '@/db/schema';

interface BoardRow {
  id: string;
  name: string;
  styleOptions: BoardStyleOptions | null;
  isUnlocked: boolean;
  /** The owner deleted it; it stays listed here so it can be restored. */
  deleted: boolean;
  imageGenerationsUsed: number;
  generationLimitOverride: number | null;
  cardCount: number;
  exportCount: number;
  ownerEmail: string;
  ownerId: string;
  updatedAt: string;
}

export function ExportedCell({ count }: { count: number }) {
  return (
    <TableCell className="whitespace-nowrap text-sm tabular-nums">
      {count > 0 ? (
        <span>
          <span aria-hidden="true">✓ </span>
          {count === 1 ? 'Yes' : `Yes (${count}×)`}
        </span>
      ) : (
        <span className="text-muted-foreground">No</span>
      )}
    </TableCell>
  );
}

export function BoardList({ boards }: { boards: BoardRow[] }) {
  const [unlockedOnly, setUnlockedOnly] = useState(false);

  const filtered = unlockedOnly ? boards.filter((b) => b.isUnlocked) : boards;

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={unlockedOnly}
          onChange={(e) => setUnlockedOnly(e.target.checked)}
          className="rounded"
        />
        Show only unlocked boards
      </label>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No boards found</p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 md:-mx-6 md:px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Theme</TableHead>
                <TableHead>Cards</TableHead>
                <TableHead>Generations</TableHead>
                <TableHead>Exported</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((board) => {
                const genLimit = getGenerationLimit(board);
                return (
                  <TableRow key={board.id}>
                    <TableCell className="max-w-72 min-w-48 whitespace-normal">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {board.isUnlocked ? (
                          <LockOpen
                            className="size-3.5 shrink-0 text-accent"
                            aria-label="Unlocked"
                            role="img"
                          />
                        ) : (
                          <Lock
                            className="size-3.5 shrink-0 text-muted-foreground"
                            aria-label="Free"
                            role="img"
                          />
                        )}
                        <Link
                          href={`/admin/boards/${board.id}`}
                          className="min-w-0 truncate text-sm hover:underline"
                        >
                          {board.name}
                        </Link>
                        {board.deleted && (
                          <Badge variant="destructive" className="shrink-0">
                            Deleted
                          </Badge>
                        )}
                      </div>
                      <Link
                        href={`/admin/users/${board.ownerId}`}
                        className="mt-0.5 block truncate text-xs text-muted-foreground hover:underline"
                      >
                        {board.ownerEmail}
                      </Link>
                    </TableCell>
                    <TableCell className="min-w-48 max-w-64 whitespace-normal">
                      <BoardThemeBadge styles={board.styleOptions} />
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        <span className="sr-only">Font: </span>
                        {board.styleOptions?.font ?? getTheme(board.styleOptions?.presetId).font}
                        <span aria-hidden="true"> · </span>
                        <span className="sr-only">. Border: </span>
                        {messages.Themes.Builder.borders[boardBorderStyle(board.styleOptions)]}
                        <span aria-hidden="true"> · </span>
                        <span className="sr-only">. </span>
                        {board.styleOptions?.showTitle ? 'Title on' : 'Title off'}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{board.cardCount}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm tabular-nums">
                      {board.imageGenerationsUsed}/{genLimit}
                    </TableCell>
                    <ExportedCell count={board.exportCount} />
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(board.updatedAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
