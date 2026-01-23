'use client';

import { useRef, useState } from 'react';
import { Upload, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BoardUploadSectionProps {
  onFilesSelected: (files: File[]) => void;
  cardCount: number;
  maxCards: number;
  isUnlocked: boolean;
}

export function BoardUploadSection({
  onFilesSelected,
  cardCount,
  maxCards,
  isUnlocked,
}: BoardUploadSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const remainingSlots = maxCards - cardCount;
  const isMaxReached = remainingSlots <= 0;

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
      handleFiles(Array.from(files));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));

    const validFiles = imageFiles.slice(0, remainingSlots);

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const handleClick = () => {
    if (!isMaxReached) {
      inputRef.current?.click();
    }
  };

  return (
    <div className="w-full">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
          dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        } ${isMaxReached ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleChange}
          className="hidden"
          disabled={isMaxReached}
        />

        <Upload className="w-12 h-12 mx-auto mb-4 text-primary" />
        <h3 className="text-lg font-semibold mb-2">
          {isMaxReached ? (
            <span className="flex items-center justify-center gap-2">
              {isUnlocked ? 'Maximum cards reached' : 'Free tier limit reached'}
              {!isUnlocked && <Lock className="h-4 w-4" />}
            </span>
          ) : (
            'Upload your photos'
          )}
        </h3>
        <p className="text-muted-foreground text-sm mb-4">
          {isMaxReached
            ? isUnlocked
              ? `You've reached the maximum of ${maxCards} cards`
              : 'Unlock this board to add up to 54 cards'
            : `Drag photos here or click to select. ${remainingSlots} slots available`}
        </p>

        {!isMaxReached && (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            className="bg-primary hover:bg-primary/90"
          >
            Select photos
          </Button>
        )}
      </div>

      {cardCount > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            Photos uploaded: {cardCount}/{maxCards}
          </p>
          {!isUnlocked && cardCount >= 16 && (
            <p className="text-sm text-orange-600">Unlock for up to 54 cards</p>
          )}
        </div>
      )}
    </div>
  );
}
