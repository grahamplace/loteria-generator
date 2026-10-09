'use client';

import { useState } from 'react';
import Image from 'next/image';
import { PhotoCropDialog } from '@/components/photo-crop-dialog';
import type { PixelRect } from '@/lib/crop-image';
import { X, Trash2, ImageIcon, Sparkles, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { PhotoMode } from '@/lib/themes/presets';
import { LotteriaCard } from '@/lib/generate-boards';
import { cardImageProps, CARD_GRID_THUMB_WIDTH } from '@/lib/card-image';
import posthog from 'posthog-js';
import { useTranslations } from 'next-intl';

interface CardEditModalProps {
  card: LotteriaCard;
  originalImage?: string;
  onSave: (newLabel: string, newRiddle: string) => void;
  onDelete?: () => void;
  onClose: () => void;
  cropData?: PixelRect | null;
  onCrop?: (crop: PixelRect | null) => Promise<void>;
  preserveOriginal?: boolean;
  isProcessing?: boolean;
  processingError?: string;
  onChangePhotoMode?: (mode: PhotoMode) => Promise<void>;
}

export function CardEditModal({
  card,
  originalImage,
  onSave,
  onDelete,
  onClose,
  cropData,
  onCrop,
  preserveOriginal = false,
  isProcessing = false,
  processingError,
  onChangePhotoMode,
}: CardEditModalProps) {
  const t = useTranslations('BoardEditor.CardEditModal');
  const themeText = useTranslations('Themes.Builder');
  const [cropping, setCropping] = useState(false);
  const [label, setLabel] = useState(card.label);
  const [riddle, setRiddle] = useState(card.riddle ?? '');
  const [switching, setSwitching] = useState(false);
  const [modeError, setModeError] = useState('');
  const mode: PhotoMode = preserveOriginal ? 'original' : 'illustrated';
  async function changeMode(next: PhotoMode) {
    if (!onChangePhotoMode || switching || isProcessing) return;
    setSwitching(true);
    setModeError('');
    try {
      await onChangePhotoMode(next);
    } catch {
      setModeError(t('photoModeError'));
    } finally {
      setSwitching(false);
    }
  }

  const handleSave = () => {
    if (label.trim()) {
      posthog.capture('card_label_edited', {
        card_number: card.number,
        has_riddle: riddle.trim().length > 0,
      });
      onSave(label.trim(), riddle.trim());
    }
  };

  if (cropping && originalImage && onCrop)
    return (
      <PhotoCropDialog
        src={originalImage}
        initialCrop={cropData}
        onSave={onCrop}
        onClose={() => setCropping(false)}
      />
    );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="max-w-[calc(100%-2rem)] sm:max-w-md max-h-[90dvh] flex flex-col gap-0 p-0 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b shrink-0">
          <DialogTitle>{t('titleWithNumber', { number: card.number })}</DialogTitle>
          <button
            onClick={onClose}
            aria-label={t('closeAriaLabel')}
            className="inline-flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 md:px-6 py-3 md:py-4 space-y-3 overflow-y-auto overscroll-contain">
          {originalImage && onChangePhotoMode && (
            <fieldset disabled={switching || isProcessing} className="space-y-2">
              <legend className="mb-2 text-sm font-medium">{t('photoModeLabel')}</legend>
              <div className="grid grid-cols-2 gap-2">
                {(['original', 'illustrated'] as const).map((choice) => {
                  const Icon = choice === 'original' ? ImageIcon : Sparkles;
                  return (
                    <label key={choice} className="relative min-w-0 cursor-pointer">
                      <input
                        type="radio"
                        name={`card-photo-mode-${card.id}`}
                        value={choice}
                        checked={mode === choice}
                        onChange={() => void changeMode(choice)}
                        className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-wait"
                      />
                      <span className="flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-md border border-border px-2 py-2 text-sm text-foreground peer-checked:border-primary peer-checked:bg-primary/5 peer-checked:text-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:cursor-wait peer-disabled:opacity-60">
                        {mode === choice ? (
                          <Check className="size-4 shrink-0" aria-hidden="true" />
                        ) : (
                          <Icon className="size-4 shrink-0" aria-hidden="true" />
                        )}
                        <span>
                          {t(choice === 'original' ? 'useOriginalPhoto' : 'useIllustration')}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          {(switching || isProcessing) && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2
                className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              {t(isProcessing ? 'creatingIllustration' : 'switchingPhotoMode')}
            </p>
          )}
          {modeError && (
            <p role="alert" className="text-sm text-destructive">
              {modeError}
            </p>
          )}
          {processingError && onChangePhotoMode && (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-destructive">
                {t('illustrationFailed')}
              </p>
              <Button
                variant="outline"
                disabled={switching || isProcessing}
                onClick={() => void changeMode('illustrated')}
              >
                {switching && (
                  <Loader2
                    className="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                )}
                {t('retryIllustration')}
              </Button>
            </div>
          )}
          {/* Image preview */}
          <div className="flex justify-center gap-3">
            {originalImage && (
              <div className="min-w-0 flex-1 max-w-40 space-y-1">
                <p className="text-xs text-muted-foreground text-center">{t('originalLabel')}</p>
                <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden bg-muted">
                  <Image
                    {...cardImageProps(originalImage, CARD_GRID_THUMB_WIDTH)}
                    alt={t('originalLabel')}
                    fill
                    sizes="(max-width: 768px) 128px, 160px"
                    className="object-cover"
                  />
                </div>
              </div>
            )}
            <div className="min-w-0 flex-1 max-w-40 space-y-1">
              {originalImage && (
                <p className="text-xs text-muted-foreground text-center">
                  {preserveOriginal ? t('originalPhotoLabel') : t('illustrationLabel')}
                </p>
              )}
              <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden bg-muted">
                <Image
                  {...cardImageProps(
                    card.illustration || '/placeholder.svg',
                    CARD_GRID_THUMB_WIDTH
                  )}
                  alt={card.label}
                  fill
                  sizes="(max-width: 768px) 128px, 160px"
                  className="object-cover"
                />
              </div>
            </div>
          </div>

          {onCrop && originalImage && (
            <Button
              variant="outline"
              disabled={switching || isProcessing}
              onClick={() => setCropping(true)}
            >
              {themeText('crop')}
            </Button>
          )}

          {/* Label input */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('labelField')}</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-[16px] md:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={t('labelPlaceholder')}
              aria-label={t('labelInputAriaLabel')}
            />
            <p className="text-xs text-muted-foreground mt-1">{t('labelHint')}</p>
          </div>

          {/* Riddle input */}
          <div>
            <label className="block text-sm font-medium mb-2" htmlFor="card-riddle">
              {t('riddleField')}
            </label>
            <textarea
              id="card-riddle"
              value={riddle}
              onChange={(e) => setRiddle(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSave();
                }
              }}
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 border rounded-md text-[16px] md:text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
              placeholder={t('riddlePlaceholder')}
              aria-label={t('riddleInputAriaLabel')}
            />
            <p className="text-xs text-muted-foreground mt-1">{t('riddleHint')}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-4 md:px-6 py-3 md:py-4 border-t shrink-0">
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive hover:text-white hover:border-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
              onClick={onDelete}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {t('deleteButton')}
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" className="bg-transparent" onClick={onClose}>
            {t('cancelButton')}
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={handleSave}
            disabled={!label.trim()}
          >
            {t('saveButton')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
