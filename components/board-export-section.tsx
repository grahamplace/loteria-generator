'use client';

import { useState } from 'react';
import { Package, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateLoteriaSetZip, BoardStyleOptions } from '@/lib/generate-boards';
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
  boardName: string;
  isUnlocked: boolean;
  onUnlockRequired: () => void;
}

export function BoardExportSection({
  cards,
  boardName,
  isUnlocked,
  onUnlockRequired,
}: BoardExportSectionProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);
  const [generatedCount, setGeneratedCount] = useState(0);

  const boardStyleOptions: BoardStyleOptions = {
    backgroundColor: '#f5f0e1',
    badgeColor: '#eb865a',
    labelColor: '#000000',
  };

  const handleExportSet = async () => {
    const processedCards = cards.filter((c) => !c.isProcessing && !c.error);

    if (processedCards.length < 16) {
      toast.error('Need at least 16 cards', {
        description: 'Upload more cards to export a Loteria set.',
      });
      return;
    }

    if (!isUnlocked && generatedCount >= 1) {
      onUnlockRequired();
      return;
    }

    setIsExporting(true);
    setExportProgress('Starting export...');

    try {
      const lotteriaCards = processedCards.map((c) => ({
        id: c.id,
        number: c.number,
        label: c.label,
        illustration: c.illustration,
      }));

      const zipBlob = await generateLoteriaSetZip(
        lotteriaCards,
        boardStyleOptions,
        setExportProgress
      );

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      const slug = boardName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      a.download = `${slug}-loteria-set.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setGeneratedCount((prev) => prev + 1);
      toast.success('Loteria set exported!', {
        description: '50 unique boards and card deck downloaded as a ZIP file.',
      });
    } catch (error) {
      console.error('Error exporting Loteria set:', error);
      toast.error('Failed to export Loteria set', {
        description: 'Please try again.',
      });
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const processedCards = cards.filter((c) => !c.isProcessing && !c.error);
  const canExport = processedCards.length >= 16;
  const hasUsedFreeExport = !isUnlocked && generatedCount >= 1;

  return (
    <div className="bg-accent/5 rounded-lg p-6 border border-accent/10">
      <h3 className="text-lg font-semibold mb-4 text-foreground">Export Loteria Set</h3>
      <p className="text-sm text-muted-foreground mb-4">
        {processedCards.length} card{processedCards.length !== 1 ? 's' : ''} ready to export
      </p>

      <div className="flex gap-3 flex-wrap">
        <Button
          onClick={handleExportSet}
          disabled={!canExport || isExporting}
          className={
            hasUsedFreeExport ? 'border-orange-300' : 'bg-primary hover:bg-primary/90 text-white'
          }
          variant={hasUsedFreeExport ? 'outline' : 'default'}
        >
          {hasUsedFreeExport && <Lock className="w-4 h-4 mr-2" />}
          <Package className="w-4 h-4 mr-2" />
          {isExporting
            ? exportProgress || 'Exporting...'
            : hasUsedFreeExport
              ? 'Unlock to Export Again'
              : 'Export Loteria Set'}
        </Button>
      </div>

      {isExporting && exportProgress && (
        <p className="text-sm text-muted-foreground mt-4 animate-pulse">{exportProgress}</p>
      )}

      {!canExport && processedCards.length > 0 && (
        <p className="text-sm text-muted-foreground mt-4">
          Need at least 16 cards to export a set ({processedCards.length}/16)
        </p>
      )}

      {!isUnlocked && (
        <p className="text-sm text-orange-600 mt-4">
          {hasUsedFreeExport
            ? "You've used your free export. Unlock for unlimited exports."
            : 'Free tier: 1 export included'}
        </p>
      )}
    </div>
  );
}
