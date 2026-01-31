'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface BoardPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
}

export function BoardPreviewModal({ open, onOpenChange, imageUrl }: BoardPreviewModalProps) {
  function handleOpenChange(value: boolean) {
    if (!value && imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    onOpenChange(value);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Board Preview</DialogTitle>
        </DialogHeader>
        {imageUrl && (
          <img src={imageUrl} alt="Lotería board preview" className="w-full h-auto rounded-md" />
        )}
      </DialogContent>
    </Dialog>
  );
}
