'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  generateLoteriaSetPdf,
  type BoardStyleOptions,
  type LotteriaCard,
} from '@/lib/generate-boards';
import type { Card } from '@/db/schema';

// Mirrors the consumer defaults in components/board-action-bar.tsx. Falls back to
// these when the board has no persisted styleOptions.
const DEFAULT_STYLE_OPTIONS: BoardStyleOptions = {
  backgroundColor: '#f5f0e1',
  badgeColor: '#eb865a',
  labelColor: '#000000',
};

// generateBoards requires at least 16 completed cards.
const MIN_EXPORT_CARDS = 16;

export function AdminExportButton({
  boardName,
  cards,
  styleOptions,
}: {
  boardName: string;
  cards: Card[];
  styleOptions?: BoardStyleOptions | null;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  // Only completed cards with an illustration can be rendered into the set.
  const exportableCards = cards.filter((c) => c.status === 'completed' && c.illustrationUrl);
  const canExport = exportableCards.length >= MIN_EXPORT_CARDS;

  const handleExport = async () => {
    if (!canExport || isExporting) return;

    setIsExporting(true);
    setProgress('Starting export…');

    try {
      const exportCards: LotteriaCard[] = exportableCards.map((c) => ({
        id: c.id,
        number: c.number,
        label: c.label,
        // Admin export goes through the admin image proxy (no owner scoping),
        // matching admin-board-cards-grid.tsx.
        illustration: `/api/admin/images/${c.id}/illustration`,
        riddle: c.riddle,
      }));

      const pdfBlob = await generateLoteriaSetPdf(
        exportCards,
        styleOptions ?? DEFAULT_STYLE_OPTIONS,
        setProgress
      );

      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      const slug = boardName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      a.download = `${slug || 'board'}-loteria-set.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Export ready', {
        description: 'The Loteria set PDF has been downloaded.',
      });
    } catch (error) {
      console.error('Error exporting Loteria set:', error);
      toast.error('Export failed', {
        description: (error as Error).message || 'Could not generate the PDF.',
      });
    } finally {
      setIsExporting(false);
      setProgress(null);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleExport}
      disabled={!canExport || isExporting}
      title={
        canExport
          ? undefined
          : `Need at least ${MIN_EXPORT_CARDS} completed cards to export (${exportableCards.length} ready)`
      }
    >
      {isExporting ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="mr-1.5 h-3.5 w-3.5" />
      )}
      {isExporting ? (progress ?? 'Exporting…') : 'Export'}
    </Button>
  );
}
