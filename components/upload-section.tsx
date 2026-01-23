'use client';

import React from 'react';

import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LotteriaCard } from '@/hooks/use-cards';

interface UploadSectionProps {
  onFilesSelected: (files: File[]) => void;
  cards: LotteriaCard[];
  maxCards?: number;
}

export function UploadSection({ onFilesSelected, cards, maxCards = 50 }: UploadSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const remainingSlots = maxCards - cards.length;
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
          {isMaxReached ? 'Card limit reached' : 'Upload your photos'}
        </h3>
        <p className="text-muted-foreground text-sm mb-4">
          {isMaxReached
            ? `You've reached the maximum of ${maxCards} cards`
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

      {cards.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-muted-foreground">
            Photos uploaded: {cards.length}/{maxCards}
          </p>
        </div>
      )}
    </div>
  );
}
