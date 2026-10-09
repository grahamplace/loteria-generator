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
import { BoardThemeBadge } from '@/components/board-theme-badge';
import { boardBorderStyle, getTheme, type BoardStyleOptions } from '@/lib/themes/presets';
import messages from '@/messages/en.json';

interface BoardRow {
  id: string;
  name: string;
  styleOptions: BoardStyleOptions | null;
  isUnlocked: boolean;
  imageGenerationsUsed: number;
  cardCount: number;
  ownerEmail: string;
  ownerId: string;
  updatedAt: string;
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
                <TableHead>Owner</TableHead>
                <TableHead>Cards</TableHead>
                <TableHead>Generations</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((board) => {
                return (
                  <TableRow key={board.id}>
                    <TableCell className="whitespace-nowrap">
                      <Link href={`/admin/boards/${board.id}`} className="text-sm hover:underline">
                        {board.name}
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
                    <TableCell className="whitespace-nowrap">
                      <Link
                        href={`/admin/users/${board.ownerId}`}
                        className="text-xs hover:underline"
                      >
                        {board.ownerEmail}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{board.cardCount}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm tabular-nums">
                      {board.imageGenerationsUsed}
                    </TableCell>
                    <TableCell>
                      {board.isUnlocked ? (
                        <Badge variant="default">Unlocked</Badge>
                      ) : (
                        <Badge variant="secondary">Free</Badge>
                      )}
                    </TableCell>
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
