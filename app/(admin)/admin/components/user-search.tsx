'use client';

import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { DollarSign, Loader2, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { CampaignTemplateOption } from '@/lib/email/campaigns/registry';

interface UserRow {
  id: string;
  email: string;
  name: string;
  boardCount: number;
  cardCount: number;
  paidBoardCount: number;
  createdAt: string;
  sentTemplateKeys: string[];
}

// Total column count: checkbox + Email + Name + Paid + Sent + Boards + Cards + Joined = 8
const COLUMN_COUNT = 8;

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function UserSearch({
  users,
  templateOptions,
}: {
  users: UserRow[];
  templateOptions: CampaignTemplateOption[];
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selectedKey, setSelectedKey] = useState(templateOptions[0]?.key ?? '');

  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(query.toLowerCase()) ||
      u.name.toLowerCase().includes(query.toLowerCase())
  );

  const filteredIds = filtered.map((u) => u.id);
  const selectedInFiltered = filteredIds.filter((id) => selected.has(id));
  const allFilteredSelected =
    filteredIds.length > 0 && selectedInFiltered.length === filteredIds.length;
  const someFilteredSelected =
    selectedInFiltered.length > 0 && selectedInFiltered.length < filteredIds.length;

  const selectedLabel = templateOptions.find((t) => t.key === selectedKey)?.label ?? 'campaign';

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (allFilteredSelected) {
      // deselect all filtered rows
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of filteredIds) next.delete(id);
        return next;
      });
    } else {
      // select all filtered rows
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of filteredIds) next.add(id);
        return next;
      });
    }
  }

  function handleSend() {
    const userIds = Array.from(selected);
    const n = userIds.length;
    const label = selectedLabel;
    setDialogOpen(false);
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/users/send-campaign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateKey: selectedKey, userIds }),
        });
        if (res.ok) {
          toast.success(`Queued ${label} for ${plural(n, 'user')}`);
          setSelected(new Set());
        } else {
          toast.error(`Failed to queue ${label}`);
        }
      } catch {
        toast.error(`Failed to queue ${label}`);
      }
    });
  }

  const hasTemplates = templateOptions.length > 0;

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by email or name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
        spellCheck={false}
      />

      {/* Sticky action bar — shown only when rows are selected */}
      {selected.size > 0 && (
        <div className="bg-background sticky top-0 z-10 flex items-center gap-3 rounded-md border px-4 py-2.5 shadow-sm">
          <span className="text-sm tabular-nums text-muted-foreground">
            {plural(selected.size, 'selected')}
          </span>

          {templateOptions.length > 1 && (
            <div className="flex items-center gap-2">
              <label htmlFor="campaign-template-select" className="text-sm text-muted-foreground">
                Template
              </label>
              <Select value={selectedKey} onValueChange={setSelectedKey}>
                <SelectTrigger
                  id="campaign-template-select"
                  size="sm"
                  aria-label="Select campaign template"
                  style={{ touchAction: 'manipulation' }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templateOptions.map((opt) => (
                    <SelectItem key={opt.key} value={opt.key}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="default"
                disabled={pending || !hasTemplates}
                style={{ touchAction: 'manipulation' }}
                aria-label={`Send ${selectedLabel} campaign to ${plural(selected.size, 'user')}`}
              >
                {pending && <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />}
                Send campaign
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Send the {selectedLabel} campaign?</AlertDialogTitle>
                <AlertDialogDescription>
                  Send the {selectedLabel} campaign to {plural(selected.size, 'user')}? Already-sent
                  users will be skipped automatically.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSend}>
                  Send to {plural(selected.size, 'user')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      <div className="-mx-4 overflow-x-auto px-4 md:-mx-6 md:px-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    allFilteredSelected ? true : someFilteredSelected ? 'indeterminate' : false
                  }
                  aria-label={allFilteredSelected ? 'Deselect all' : 'Select all'}
                  aria-checked={someFilteredSelected ? 'mixed' : allFilteredSelected}
                  onCheckedChange={toggleAll}
                  disabled={filteredIds.length === 0}
                  style={{ touchAction: 'manipulation' }}
                />
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-center">Paid</TableHead>
              <TableHead className="text-center">Sent</TableHead>
              <TableHead>Boards</TableHead>
              <TableHead>Cards</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={COLUMN_COUNT}
                  className="text-center text-sm text-muted-foreground"
                >
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => (
                <TableRow key={u.id} data-state={selected.has(u.id) ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(u.id)}
                      onCheckedChange={() => toggleRow(u.id)}
                      aria-label={`Select ${u.email}`}
                      style={{ touchAction: 'manipulation' }}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Link href={`/admin/users/${u.id}`} className="text-sm hover:underline">
                      {u.email}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{u.name}</TableCell>
                  <TableCell className="text-center">
                    {u.paidBoardCount > 0 ? (
                      <DollarSign
                        className="mx-auto size-4 text-accent"
                        aria-label={`${u.paidBoardCount} paid board${u.paidBoardCount === 1 ? '' : 's'}`}
                      />
                    ) : (
                      <span className="sr-only">No paid boards</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {u.sentTemplateKeys.includes(selectedKey) ? (
                      <MailCheck
                        className="mx-auto size-4 text-muted-foreground"
                        aria-label="Already received the selected campaign"
                      />
                    ) : (
                      <span className="sr-only">Not sent</span>
                    )}
                  </TableCell>
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
