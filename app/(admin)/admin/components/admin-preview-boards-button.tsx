'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { LayoutGrid, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  generatePreviewBoardsPdf,
  type BoardStyleOptions,
  type LotteriaCard,
} from '@/lib/generate-boards';
import { adminCardImageSrc } from '@/lib/admin-card-image';
import type { Card } from '@/db/schema';

// Mirrors the consumer defaults in components/board-action-bar.tsx. Falls back to
// these when the board has no persisted styleOptions.
const DEFAULT_STYLE_OPTIONS: BoardStyleOptions = {
  backgroundColor: '#f5f0e1',
  badgeColor: '#eb865a',
  labelColor: '#000000',
};

export function AdminPreviewBoardsButton({
  boardName,
  cards,
  styleOptions,
}: {
  boardName: string;
  cards: Card[];
  styleOptions?: BoardStyleOptions | null;
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  // Only completed cards with an illustration can be rendered.
  const previewableCards = cards.filter((c) => c.status === 'completed' && c.illustrationUrl);
  const canGenerate = previewableCards.length >= 1;

  const handleGenerate = async () => {
    if (!canGenerate || isGenerating) return;

    setIsGenerating(true);
    setProgress('Starting…');

    try {
      const previewCards: LotteriaCard[] = previewableCards.flatMap((c) => {
        // Resolve the image src the same way the admin grid does: default
        // ("classic") cards serve their public illustrationUrl directly, while
        // user-uploaded cards go through the authenticated image proxy. Routing
        // a relative /default-cards/*.webp path through the proxy 404s, which
        // fails the whole PDF render (admin-board-cards-grid.tsx).
        const illustration = adminCardImageSrc(c);
        if (!illustration) return [];
        return [
          {
            id: c.id,
            number: c.number,
            label: c.label,
            illustration,
            riddle: c.riddle,
          },
        ];
      });

      const pdfBlob = await generatePreviewBoardsPdf(
        previewCards,
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
      a.download = `${slug || 'board'}-preview-boards.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Preview boards ready', {
        description: 'The preview boards PDF has been downloaded.',
      });
    } catch (error) {
      console.error('Error generating preview boards:', error);
      toast.error('Preview failed', {
        description: (error as Error).message || 'Could not generate the PDF.',
      });
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleGenerate}
      disabled={!canGenerate || isGenerating}
      title={canGenerate ? undefined : 'Need at least 1 completed card to preview'}
    >
      {isGenerating ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
      )}
      {isGenerating ? (progress ?? 'Generating…') : 'Generate Preview Boards'}
    </Button>
  );
}
