'use client';
import { useEffect, useState } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { BoardAppearance } from '@/components/board-appearance';
import { AdminExportButton } from './admin-export-button';
import { AdminPreviewBoardsButton } from './admin-preview-boards-button';
import { adminCardImageSrc } from '@/lib/admin-card-image';
import type { Board, Card } from '@/db/schema';
import messages from '@/messages/en.json';

export function AdminBoardAppearance({ board, cards }: { board: Board; cards: Card[] }) {
  const [settings, setSettings] = useState(board);
  useEffect(() => setSettings(board), [board]);
  const complete = cards
    .filter((card) => card.status === 'completed' && card.illustrationUrl)
    .map((card) => ({
      id: card.id,
      label: card.label,
      number: card.number,
      illustration: adminCardImageSrc(card)!,
      riddle: card.riddle,
    }));
  return (
    <div className="space-y-4">
      <NextIntlClientProvider locale="en" messages={{ Themes: messages.Themes }}>
        <BoardAppearance
          styles={settings.styleOptions}
          photoMode={settings.photoMode}
          boardName={settings.name}
          cards={complete}
          onSave={async (updates) => {
            const response = await fetch(`/api/admin/boards/${board.id}/settings`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updates),
            });
            if (!response.ok) return false;
            setSettings((await response.json()).board);
            return true;
          }}
        />
      </NextIntlClientProvider>
      <div className="flex flex-wrap gap-3">
        <AdminExportButton
          boardName={settings.name}
          cards={cards}
          styleOptions={settings.styleOptions}
        />
        <AdminPreviewBoardsButton
          boardName={settings.name}
          cards={cards}
          styleOptions={settings.styleOptions}
        />
      </div>
    </div>
  );
}
