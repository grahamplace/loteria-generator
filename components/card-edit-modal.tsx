'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LotteriaCard } from '@/lib/generate-boards';

interface CardEditModalProps {
  card: LotteriaCard;
  onSave: (newLabel: string) => void;
  onClose: () => void;
}

export function CardEditModal({ card, onSave, onClose }: CardEditModalProps) {
  const [label, setLabel] = useState(card.label);

  // Handle Escape key to close modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSave = () => {
    if (label.trim()) {
      onSave(label.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <h2 className="text-lg font-semibold">Edit card #{card.number}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Image preview - smaller and centered */}
          <div className="flex justify-center">
            <div className="w-40 aspect-[2/3] rounded-lg overflow-hidden bg-muted">
              <img
                src={card.illustration || '/placeholder.svg'}
                alt={card.label}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Label input */}
          <div>
            <label className="block text-sm font-medium mb-2">Label (in Spanish)</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter the label"
            />
            <p className="text-xs text-muted-foreground mt-1">1-3 Spanish words</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t shrink-0">
          <Button variant="outline" className="flex-1 bg-transparent" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-primary hover:bg-primary/90"
            onClick={handleSave}
            disabled={!label.trim()}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
