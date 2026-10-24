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
import { getGenerationLimit } from '@/db/schema';

interface BoardRow {
  id: string;
  name: string;
  isUnlocked: boolean;
  imageGenerationsUsed: number;
  generationLimitOverride: number | null;
  cardCount: number;
  exportCount: number;
  payment: string | null;
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
                <TableHead>Owner</TableHead>
                <TableHead>Cards</TableHead>
                <TableHead>Generations</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Exported</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((board) => {
                const genLimit = getGenerationLimit(board);
                return (
                  <TableRow key={board.id}>
                    <TableCell className="whitespace-nowrap">
                      <Link href={`/admin/boards/${board.id}`} className="text-sm hover:underline">
                        {board.name}
                      </Link>
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
                      {board.imageGenerationsUsed}/{genLimit}
                    </TableCell>
                    <TableCell>
                      {board.isUnlocked ? (
                        <Badge variant="default">Unlocked</Badge>
                      ) : (
                        <Badge variant="secondary">Free</Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs tabular-nums">
                      {board.payment ?? <span className="text-muted-foreground">—</span>}
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
