'use client';

import { useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Upload, Package, Plus, Unlock, Sparkles } from 'lucide-react';
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

interface BoardActionBarProps {
  onFilesSelected: (files: File[]) => void;
  cardCount: number;
  maxCards: number;
  processedCount: number;
  processingCount: number;
  isUnlocked: boolean;
  cards: DisplayCard[];
  boardName: string;
  onUnlockRequired: () => void;
}

export interface BoardActionBarRef {
  triggerFileSelect: () => void;
}

export const BoardActionBar = forwardRef<BoardActionBarRef, BoardActionBarProps>(
  function BoardActionBar(
    {
      onFilesSelected,
      cardCount,
      maxCards,
      processedCount,
      processingCount,
      isUnlocked,
      cards,
      boardName,
      onUnlockRequired,
    },
    ref
  ) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragActive, setDragActive] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState<string | null>(null);
    const [generatedCount, setGeneratedCount] = useState(0);

    const isMaxReached = cardCount >= maxCards;
    const canExport = processedCount >= 16;
    const hasUsedFreeExport = !isUnlocked && generatedCount >= 1;

    useImperativeHandle(ref, () => ({
      triggerFileSelect: () => {
        if (!isMaxReached) {
          inputRef.current?.click();
        }
      },
    }));

    const handleDrag = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.type === 'dragenter' || e.type === 'dragover') {
        setDragActive(true);
      } else if (e.type === 'dragleave') {
        setDragActive(false);
      }
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
        const remaining = maxCards - cardCount;
        const validFiles = imageFiles.slice(0, remaining);
        if (validFiles.length > 0) {
          onFilesSelected(validFiles);
        }
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const imageFiles = Array.from(e.target.files).filter((f) => f.type.startsWith('image/'));
        const remaining = maxCards - cardCount;
        const validFiles = imageFiles.slice(0, remaining);
        if (validFiles.length > 0) {
          onFilesSelected(validFiles);
        }
      }
      // Reset so re-selecting the same file triggers onChange again
      e.target.value = '';
    };

    const boardStyleOptions: BoardStyleOptions = {
      backgroundColor: '#f5f0e1',
      badgeColor: '#eb865a',
      labelColor: '#000000',
    };

    const handleExport = async () => {
      if (hasUsedFreeExport) {
        onUnlockRequired();
        return;
      }
      if (!canExport) return;

      setIsExporting(true);
      setExportProgress('Starting export\u2026');

      try {
        const exportCards = cards
          .filter((c) => !c.isProcessing && !c.error)
          .map((c) => ({
            id: c.id,
            number: c.number,
            label: c.label,
            illustration: c.illustration,
          }));

        const zipBlob = await generateLoteriaSetZip(
          exportCards,
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

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Upload section */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`md:col-span-7 rounded-lg p-4 flex items-center gap-4 transition-colors border border-dashed ${
              dragActive ? 'border-primary bg-primary/5' : 'border-foreground/20 bg-muted/30'
            } ${isMaxReached ? 'opacity-50' : ''}`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleChange}
              className="hidden"
              disabled={isMaxReached}
            />
            <div className="w-12 h-12 rounded-lg bg-white border border-border text-foreground/70 flex items-center justify-center shadow-sm shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold text-[15px]">Drop photos to add cards</span>
                <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                  {cardCount}/{maxCards}
                </span>
              </div>
              <div className="h-1 bg-border rounded-full overflow-hidden mt-2">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${(cardCount / maxCards) * 100}%`,
                    background: 'linear-gradient(90deg, oklch(0.55 0.22 25), oklch(0.65 0.2 40))',
                  }}
                />
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>
                  <b className="text-foreground">{processedCount}</b> ready
                </span>
                {processingCount > 0 && (
                  <span className="flex items-center gap-1 text-primary">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    {processingCount} processing
                  </span>
                )}
                <span className="ml-auto hidden sm:inline">PNG · JPG · WebP up to 10MB</span>
              </div>
            </div>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={isMaxReached}
              className="px-3 py-2 rounded-lg bg-white border border-border text-sm font-semibold flex items-center gap-1.5 hover:border-primary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <Plus className="w-4 h-4" />
              Select
            </button>
          </div>

          {/* Export section */}
          <div
            className={`md:col-span-5 rounded-lg p-4 flex items-center gap-4 shadow-sm border relative ${
              hasUsedFreeExport ? 'border-primary border-2' : 'border-primary/20'
            }`}
            style={{ background: 'linear-gradient(135deg, #faf5e6 0%, #f2e6c8 100%)' }}
          >
            {hasUsedFreeExport && (
              <div
                className="absolute -top-2.5 right-4 border-2 border-primary rounded-md px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest text-primary bg-background"
                style={{ transform: 'rotate(-4deg)' }}
              >
                Free export used
              </div>
            )}
            <div className="w-12 h-12 rounded-lg bg-primary text-white flex items-center justify-center shadow-sm shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-[15px] block">Export Loteria set</span>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">
                {hasUsedFreeExport
                  ? 'Unlock to export again'
                  : '50 unique boards + card deck · ZIP'}
              </span>
            </div>
            <button
              onClick={handleExport}
              disabled={(!canExport && !hasUsedFreeExport) || isExporting}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                isExporting
                  ? 'bg-primary/80 text-white cursor-wait'
                  : hasUsedFreeExport
                    ? 'bg-primary text-white hover:bg-primary/90 shadow-sm'
                    : canExport
                      ? 'bg-primary text-white hover:bg-primary/90 shadow-sm'
                      : 'bg-white/70 text-muted-foreground border border-border cursor-not-allowed'
              }`}
            >
              {isExporting ? (
                <span className="text-xs" aria-live="polite">
                  {exportProgress || 'Exporting\u2026'}
                </span>
              ) : hasUsedFreeExport ? (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  Unlock · $5
                </>
              ) : canExport ? (
                <>
                  <Package className="w-4 h-4" />
                  Export
                </>
              ) : (
                `${16 - processedCount} more`
              )}
            </button>
          </div>
        </div>

        {/* Inline banner after free export is used */}
        {hasUsedFreeExport && (
          <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <div className="text-xs flex-1">
              <b>Loved your first export?</b>{' '}
              <span className="text-muted-foreground">
                Unlock for unlimited exports and the full 54-card deck.
              </span>
            </div>
            <button
              onClick={onUnlockRequired}
              className="text-[11px] font-semibold text-primary hover:underline whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
            >
              Unlock now &rarr;
            </button>
          </div>
        )}
      </div>
    );
  }
);
