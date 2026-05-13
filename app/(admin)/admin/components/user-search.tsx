'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Link from 'next/link';

interface UserRow {
  id: string;
  email: string;
  name: string;
  boardCount: number;
  cardCount: number;
  createdAt: string;
}

export function UserSearch({ users }: { users: UserRow[] }) {
  const [query, setQuery] = useState('');

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(query.toLowerCase()) ||
      u.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by email or name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
        spellCheck={false}
      />
      <div className="-mx-4 overflow-x-auto px-4 md:-mx-6 md:px-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Boards</TableHead>
              <TableHead>Cards</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="whitespace-nowrap">
                    <Link href={`/admin/users/${u.id}`} className="text-sm hover:underline">
                      {u.email}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{u.name}</TableCell>
                  <TableCell className="text-sm tabular-nums">{u.boardCount}</TableCell>
                  <TableCell className="text-sm tabular-nums">{u.cardCount}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
