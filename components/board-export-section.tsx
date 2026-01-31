'use client';

import { useState } from 'react';
import { Download, Eye, Grid3x3, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateBoardsZip, renderBoardAsPNG, BoardStyleOptions } from '@/lib/generate-boards';
import { BoardPreviewModal } from '@/components/board-preview-modal';
import { toast } from 'sonner';

interface DisplayCard {
  id: string;
  number: number;
  label: string;
  illustration: string;
  isProcessing?: boolean;
  error?: string;
}

interface BoardExportSectionProps {
  cards: DisplayCard[];
  isUnlocked: boolean;
  onUnlockRequired: () => void;
}

export function BoardExportSection({
  cards,
  isUnlocked,
  onUnlockRequired,
}: BoardExportSectionProps) {
  const [isGeneratingBoards, setIsGeneratingBoards] = useState(false);
  const [generatedBoardsCount, setGeneratedBoardsCount] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  // Hardcoded board styling options
  const boardStyleOptions: BoardStyleOptions = {
    backgroundColor: '#f5f0e1',
    cardBorderColor: '#fffddc',
    badgeColor: '#eb865a',
    labelColor: '#000000',
  };

  const handleExportJSON = () => {
    const data = cards
      .filter((c) => !c.isProcessing && !c.error)
      .map((card) => ({
        number: card.number,
        label: card.label,
        illustration: card.illustration,
      }));

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loteria-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePreviewBoard = async () => {
    const processedCards = cards.filter((c) => !c.isProcessing && !c.error);
    const first16 = processedCards.slice(0, 16);

    if (first16.length < 16) return;

    setIsGeneratingPreview(true);
    try {
      const lotteriaCards = first16.map((c) => ({
        id: c.id,
        number: c.number,
        label: c.label,
        illustration: c.illustration,
      }));

      const blob = await renderBoardAsPNG(lotteriaCards, 1, boardStyleOptions);
      const url = URL.createObjectURL(blob);
      setPreviewImageUrl(url);
      setPreviewOpen(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      toast.error('Failed to generate preview');
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleGenerateBoards = async () => {
    const processedCards = cards.filter((c) => !c.isProcessing && !c.error);

    if (processedCards.length < 16) {
      toast.error('Need at least 16 cards', {
        description: 'Upload more cards to generate boards.',
      });
      return;
    }

    // For free tier, only allow 1 board generation
    if (!isUnlocked && generatedBoardsCount >= 1) {
      onUnlockRequired();
      return;
    }

    setIsGeneratingBoards(true);

    try {
      // Convert display cards to the format expected by generateBoardsZip
      const lotteriaCards = processedCards.map((c) => ({
        id: c.id,
        number: c.number,
        label: c.label,
        illustration: c.illustration,
      }));

      const zipBlob = await generateBoardsZip(lotteriaCards, boardStyleOptions);

      // Download the zip file
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `loteria-boards-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setGeneratedBoardsCount((prev) => prev + 1);
      toast.success('Boards generated!', {
        description: '4 unique boards downloaded as a ZIP file.',
      });
    } catch (error) {
      console.error('Error generating boards:', error);
      toast.error('Failed to generate boards', {
        description: 'Please try again.',
      });
    } finally {
      setIsGeneratingBoards(false);
    }
  };

  const processedCards = cards.filter((c) => !c.isProcessing && !c.error);
  const isReady = processedCards.length > 0;
  const canGenerateBoards = processedCards.length >= 16;
  const hasUsedFreeBoardGeneration = !isUnlocked && generatedBoardsCount >= 1;

  return (
    <div className="bg-accent/5 rounded-lg p-6 border border-accent/10">
      <h3 className="text-lg font-semibold mb-4 text-foreground">Export cards</h3>
      <p className="text-sm text-muted-foreground mb-4">
        {processedCards.length} card{processedCards.length !== 1 ? 's' : ''} ready to export
      </p>

      <div className="flex gap-3 flex-wrap">
        <Button
          onClick={handleExportJSON}
          disabled={!isReady}
          className="bg-primary hover:bg-primary/90 text-white"
        >
          <Download className="w-4 h-4 mr-2" />
          Download JSON
        </Button>
        <Button
          onClick={handleGenerateBoards}
          disabled={!canGenerateBoards || isGeneratingBoards}
          variant="outline"
          className={
            hasUsedFreeBoardGeneration
              ? 'border-orange-300'
              : 'bg-accent hover:bg-accent/90 text-accent-foreground'
          }
        >
          {hasUsedFreeBoardGeneration && <Lock className="w-4 h-4 mr-2" />}
          <Grid3x3 className="w-4 h-4 mr-2" />
          {isGeneratingBoards
            ? 'Generating...'
            : hasUsedFreeBoardGeneration
              ? 'Unlock for More Boards'
              : 'Generate Boards'}
        </Button>
        <Button
          onClick={handlePreviewBoard}
          disabled={!canGenerateBoards || isGeneratingPreview}
          variant="outline"
        >
          <Eye className="w-4 h-4 mr-2" />
          {isGeneratingPreview ? 'Generating...' : 'Preview Board'}
        </Button>
      </div>

      <BoardPreviewModal
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setPreviewImageUrl(null);
        }}
        imageUrl={previewImageUrl}
      />

      {!canGenerateBoards && processedCards.length > 0 && (
        <p className="text-sm text-muted-foreground mt-4">
          Need at least 16 cards to generate boards ({processedCards.length}/16)
        </p>
      )}

      {!isUnlocked && (
        <p className="text-sm text-orange-600 mt-4">
          {hasUsedFreeBoardGeneration
            ? "You've used your free board generation. Unlock for unlimited generations."
            : 'Free tier: 1 board generation included'}
        </p>
      )}
    </div>
  );
}
